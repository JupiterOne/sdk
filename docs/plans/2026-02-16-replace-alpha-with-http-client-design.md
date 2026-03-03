# Design: Replace @lifeomic/alpha with integration-sdk-http-client

**Ticket**: [PLATENG-800](https://jupiterone.atlassian.net/browse/PLATENG-800)
**Date**: 2026-02-16 **Scope**: `packages/integration-sdk-runtime` only

## Context

`@lifeomic/alpha` is a deprecated HTTP client used by `integration-sdk-runtime`
for all API calls to the JupiterOne persister service. The goal is to replace it
with `@jupiterone/integration-sdk-http-client`, which already lives in the SDK
monorepo and is publicly published.

### Why integration-sdk-http-client (not platform-sdk-fetch)

- Already in the SDK monorepo — no cross-repo dependency
- Already public on npm — no publishing changes needed
- Ryan's directive: use what's already available in the monorepo

### Prior art

- PR #487 (platform-sdk): drop-in `platform-sdk-fetch` replacement — superseded
  by this approach
- PR #492 (platform-sdk): made 17 packages public — no longer needed for this
  effort
- PR #1188 (sdk): original migration to `platform-sdk-fetch` — superseded

## Architecture

```
┌─────────────────────────────────────────────────┐
│  integration-sdk-runtime                        │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  JupiterOneApiClient                      │  │
│  │  extends BaseAPIClient                    │  │
│  │                                           │  │
│  │  + post<T>(url, data?, config?)           │  │
│  │  + get<T>(url, config?)                   │  │
│  │  + getAuthorizationHeaders()              │  │
│  │  + _compressUploads: boolean              │  │
│  │                                           │  │
│  │  Overrides:                               │  │
│  │  # request() — rawBody/Buffer support     │  │
│  │                                           │  │
│  │  Private:                                 │  │
│  │  - executeRequest<T>() — response mapping │  │
│  │  - redactAuthHeaders() — error interceptor│  │
│  └──────────────┬────────────────────────────┘  │
│                 │ extends                        │
│  ┌──────────────┴────────────────────────────┐  │
│  │  BaseAPIClient (from http-client pkg)     │  │
│  │  - request()        — raw HTTP            │  │
│  │  - retryableRequest() — retry + rate limit│  │
│  │  - getAuthorizationHeaders() — abstract   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Key principle**: Adapter lives entirely in `integration-sdk-runtime`. The
shared `integration-sdk-http-client` package is not modified.

## Implementation Details

### JupiterOneApiClient class

New file: `src/api/apiClient.ts` (~80-120 lines)

```typescript
import { BaseAPIClient } from '@jupiterone/integration-sdk-http-client';

interface ApiClientResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

interface ApiClientRequestConfig {
  headers?: Record<string, string>;
  rawBody?: Buffer;
}

class JupiterOneApiClient extends BaseAPIClient {
  _compressUploads: boolean;

  private account: string;
  private accessToken: string;

  constructor(config: {
    baseUrl: string;
    account: string;
    accessToken: string;
    compressUploads?: boolean;
  }) {
    super({ baseUrl: config.baseUrl });
    this.account = config.account;
    this.accessToken = config.accessToken;
    this._compressUploads = config.compressUploads !== false;
  }

  getAuthorizationHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'JupiterOne-Account': this.account,
      'Content-Type': 'application/json',
    };
  }

  async post<T>(
    url: string,
    data?: object,
    config?: ApiClientRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.executeRequest<T>(url, {
      method: 'POST',
      body: data,
      rawBody: config?.rawBody,
      headers: config?.headers,
    });
  }

  async get<T>(
    url: string,
    config?: ApiClientRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.executeRequest<T>(url, {
      method: 'GET',
      headers: config?.headers,
    });
  }
}
```

### Response mapping

`BaseAPIClient.request()` returns a raw `node-fetch` `Response`. The adapter's
`executeRequest()` wraps it into the `{ data, status, headers }` shape that all
consumers expect:

```typescript
private async executeRequest<T>(url, options): Promise<ApiClientResponse<T>> {
  // Use retryableRequest for built-in retry + rate limiting
  const response = await this.retryableRequest(url, options);
  const data = await response.json() as T;
  return {
    data,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  };
}
```

### Gzip / rawBody handling

`BaseAPIClient.request()` only accepts `body: Record<string, unknown> | string`
— no `Buffer` support. The `bodyType` options (`json`, `text`, `form`,
`urlencoded`) all force their own `Content-Type`.

**Solution**: Override `request()` in the subclass to handle the `rawBody` case
before delegating to the parent:

```typescript
protected async request(url, options) {
  if (options.rawBody) {
    // Direct node-fetch call with Buffer body + Content-Encoding: gzip
    const fetchOptions = {
      method: options.method || 'POST',
      body: options.rawBody,
      headers: {
        ...this.getAuthorizationHeaders(),
        ...options.headers,
      },
    };
    return fetch(this.withBaseUrl(url), fetchOptions);
  }
  // Standard path — delegate to parent
  return super.request(url, options);
}
```

This keeps the gzip path self-contained in the adapter. `uploadDataChunk()`
continues to call
`.post(url, undefined, { rawBody: buffer, headers: { 'Content-Encoding': 'gzip' } })`
— same interface, just wired to the override.

### Auth header redaction

Current code registers a response interceptor that redacts `Authorization` from
error objects. The adapter handles this in `executeRequest()`:

```typescript
private async executeRequest<T>(url, options): Promise<ApiClientResponse<T>> {
  try {
    const response = await this.retryableRequest(url, options);
    const data = await response.json() as T;
    return { data, status: response.status, headers: ... };
  } catch (err) {
    this.redactAuthHeaders(err);
    throw err;
  }
}

private redactAuthHeaders(err: any): void {
  if (err?.config?.headers?.Authorization) {
    err.config.headers.Authorization = '[REDACTED]';
  }
}
```

### Compression flag

`_compressUploads` is set in the constructor based on `compressUploads` config
(defaults to `true`). `isUploadCompressionEnabled()` in `api/index.ts` continues
to read this property — no change needed.

## Error Handling

| Concern                    | Handled by                             |
| -------------------------- | -------------------------------------- |
| Retry on 429 / 5xx         | `BaseAPIClient.retryableRequest()`     |
| Rate limit throttling      | `BaseAPIClient` token bucket           |
| Auth refresh on 401        | `BaseAPIClient` `refreshAuth` callback |
| Auth header redaction      | Adapter `executeRequest()` catch block |
| App-level retry (finalize) | `@lifeomic/attempt` — unchanged        |

`@lifeomic/attempt` stays. It handles application-level retry in
`finalizeSynchronization()` and is independent of the HTTP client.

## Testing Strategy

### Unit tests for JupiterOneApiClient

New file: `src/api/__tests__/apiClient.test.ts`

- `getAuthorizationHeaders()` returns correct headers
- `.post()` returns `{ data, status, headers }` shape
- `.get()` returns same shape
- Compressed upload: `.post()` with `rawBody: Buffer` sends raw body with
  `Content-Encoding: gzip`
- Uncompressed upload: `.post()` with object body JSON-serializes it
- `_compressUploads` flag set correctly from config
- Auth header redaction on error

### Existing test updates

- `src/api/__tests__/index.test.ts` — update mocks from Alpha to new client
- `src/synchronization/__tests__/index.test.ts` — swap mock setup, same
  assertions

### Mock strategy

Mock `node-fetch` at module level. The existing `createMockResponse<T>()`
pattern maps well — update to return the new response shape.

### What doesn't change

- `@lifeomic/attempt` retry tests in `finalizeSynchronization`
- Event publishing tests — same `.post()` interface
- Integration-level tests using `createApiClient()` — returns new type
  transparently

## Files to Modify

All within `packages/integration-sdk-runtime/`:

| File                                  | Change                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/api/apiClient.ts`                | **New** — `JupiterOneApiClient` class (~80-120 lines)                                                                   |
| `src/api/index.ts`                    | Replace `createApiClient()` impl. Drop `Alpha` import, instantiate `JupiterOneApiClient`. Export same `ApiClient` type. |
| `src/synchronization/index.ts`        | Remove `RequestConfigWithRawBody` type cast. The adapter's `.post()` natively handles `rawBody`.                        |
| `src/api/__tests__/apiClient.test.ts` | **New** — unit tests for adapter class                                                                                  |
| `src/api/__tests__/index.test.ts`     | Update mocks and assertions for new client type                                                                         |
| `package.json`                        | Add `@jupiterone/integration-sdk-http-client` as workspace dep. Remove `@lifeomic/alpha`.                               |

## What We Do NOT Touch

- `integration-sdk-http-client` package
- `@lifeomic/attempt` — stays as application-level retry
- Any other package in the SDK monorepo

## PR Scope

Single PR, ~200-300 lines changed, limited to `integration-sdk-runtime`.
