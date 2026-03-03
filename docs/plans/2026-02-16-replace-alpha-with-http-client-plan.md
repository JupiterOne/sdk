# Replace @lifeomic/alpha with integration-sdk-http-client — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Replace `@lifeomic/alpha` and `@jupiterone/platform-sdk-fetch` in
`integration-sdk-runtime` with an adapter class built on
`@jupiterone/integration-sdk-http-client` (already in the SDK monorepo).

**Architecture:** `JupiterOneApiClient` extends `BaseAPIClient` from
`integration-sdk-http-client`. It lives entirely in `integration-sdk-runtime` —
the shared package is untouched. The adapter provides `.post()` / `.get()`
convenience methods that return `{ data, status, headers }` (matching the
current response shape), and overrides `request()` to handle `rawBody: Buffer`
for gzip-compressed uploads.

**Tech Stack:** TypeScript, node-fetch (via BaseAPIClient), @lifeomic/attempt
(retained for app-level retry), Jest

**Design doc:** `docs/plans/2026-02-16-replace-alpha-with-http-client-design.md`

**Ticket:** [PLATENG-800](https://jupiterone.atlassian.net/browse/PLATENG-800)

---

## Task 1: Create JupiterOneApiClient — types and constructor (TDD)

**Files:**

- Create: `packages/integration-sdk-runtime/src/api/apiClient.ts`
- Create: `packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts
import { JupiterOneApiClient } from '../apiClient';

// Minimal mock logger that satisfies IntegrationLogger
const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  isHandledError: jest.fn(),
} as any;

describe('JupiterOneApiClient', () => {
  describe('constructor', () => {
    it('sets _compressUploads to true by default', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'test-account',
        accessToken: 'test-token',
      });
      expect(client._compressUploads).toBe(true);
    });

    it('sets _compressUploads to false when explicitly disabled', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'test-account',
        accessToken: 'test-token',
        compressUploads: false,
      });
      expect(client._compressUploads).toBe(false);
    });
  });

  describe('getAuthorizationHeaders', () => {
    it('returns correct headers with Bearer token', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'my-account',
        accessToken: 'my-token',
      });
      // Access protected method via type assertion for testing
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer my-token',
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
    });

    it('omits Authorization header when no accessToken provided', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'my-account',
      });
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
      expect(headers.Authorization).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/apiClient' --no-coverage`
Expected: FAIL — `Cannot find module '../apiClient'`

**Step 3: Write minimal implementation**

```typescript
// packages/integration-sdk-runtime/src/api/apiClient.ts
import fetch, { Response } from 'node-fetch';
import { BaseAPIClient } from '@jupiterone/integration-sdk-http-client';
import type { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import type { RequestOptions } from '@jupiterone/integration-sdk-http-client';

/**
 * Response shape matching the existing ApiClient contract.
 * Consumers expect { data, status, headers } — not raw fetch Response.
 */
export interface ApiClientResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiClientRequestConfig {
  headers?: Record<string, string>;
  rawBody?: Buffer;
}

interface JupiterOneApiClientConfig {
  baseUrl: string;
  logger: IntegrationLogger;
  account: string;
  accessToken?: string;
  compressUploads?: boolean;
}

/**
 * Extended request options that include rawBody for gzip-compressed uploads.
 */
interface ExtendedRequestOptions extends RequestOptions {
  rawBody?: Buffer;
}

export class JupiterOneApiClient extends BaseAPIClient {
  _compressUploads: boolean;

  private account: string;
  private accessToken?: string;

  constructor(config: JupiterOneApiClientConfig) {
    super({
      baseUrl: config.baseUrl,
      logger: config.logger,
      integrationConfig: {},
    });
    this.account = config.account;
    this.accessToken = config.accessToken;
    this._compressUploads = config.compressUploads !== false;
  }

  protected getAuthorizationHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'JupiterOne-Account': this.account,
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    return headers;
  }
}
```

**Step 4: Run test to verify it passes**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/apiClient' --no-coverage`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/integration-sdk-runtime/src/api/apiClient.ts packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts
git commit -m "feat(runtime): add JupiterOneApiClient scaffold with constructor and auth headers"
```

---

## Task 2: Add .post(), .get(), and response mapping (TDD)

**Files:**

- Modify: `packages/integration-sdk-runtime/src/api/apiClient.ts`
- Modify: `packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts`

**Step 1: Write the failing tests**

Append to `apiClient.test.ts`:

```typescript
// Mock node-fetch at the top of the file, BEFORE imports
// Move this above the import of JupiterOneApiClient:
jest.mock('node-fetch', () => {
  const actual = jest.requireActual('node-fetch');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(),
  };
});
import nodeFetch from 'node-fetch';
const mockFetch = nodeFetch as jest.MockedFunction<typeof nodeFetch>;

// Inside the describe('JupiterOneApiClient') block:
describe('post', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends POST request and returns { data, status, headers } shape', async () => {
    const responseBody = { job: { id: 'job-1' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new (jest.requireActual('node-fetch').Headers)({
        'content-type': 'application/json',
      }),
      json: jest.fn().mockResolvedValueOnce(responseBody),
      body: null,
    } as any);

    const client = new JupiterOneApiClient({
      baseUrl: 'https://api.example.com',
      logger: mockLogger,
      account: 'test-account',
      accessToken: 'test-token',
    });

    const result = await client.post('/some/endpoint', { key: 'value' });

    expect(result.data).toEqual(responseBody);
    expect(result.status).toBe(200);
    expect(result.headers).toHaveProperty('content-type', 'application/json');
  });
});

describe('get', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends GET request and returns { data, status, headers } shape', async () => {
    const responseBody = { job: { id: 'job-1', status: 'AWAITING_UPLOADS' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new (jest.requireActual('node-fetch').Headers)({
        'content-type': 'application/json',
      }),
      json: jest.fn().mockResolvedValueOnce(responseBody),
      body: null,
    } as any);

    const client = new JupiterOneApiClient({
      baseUrl: 'https://api.example.com',
      logger: mockLogger,
      account: 'test-account',
      accessToken: 'test-token',
    });

    const result = await client.get('/some/endpoint');

    expect(result.data).toEqual(responseBody);
    expect(result.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/apiClient' --no-coverage`
Expected: FAIL — `client.post is not a function` /
`client.get is not a function`

**Step 3: Write implementation**

Add to `JupiterOneApiClient` in `apiClient.ts`:

```typescript
  /**
   * Override request() to handle rawBody (Buffer) for gzip-compressed uploads.
   * When rawBody is present, we call node-fetch directly with the Buffer as body,
   * bypassing BaseAPIClient's body serialization which doesn't support Buffer.
   */
  protected async request(
    endpoint: string,
    options?: ExtendedRequestOptions,
  ): Promise<Response> {
    if (options?.rawBody) {
      if (!this.authorizationHeaders) {
        this.authorizationHeaders = await this.getAuthorizationHeaders();
      }

      let url: string;
      try {
        url = new URL(endpoint).toString();
      } catch {
        url = this.withBaseUrl(endpoint);
      }

      return fetch(url, {
        method: options.method || 'POST',
        body: options.rawBody,
        headers: {
          ...this.authorizationHeaders,
          ...options.headers,
        },
      });
    }
    return super.request(endpoint, options);
  }

  async post<T>(
    url: string,
    data?: Record<string, unknown>,
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

  /**
   * Executes a request and maps the raw node-fetch Response to our
   * { data, status, headers } contract.
   */
  private async executeRequest<T>(
    url: string,
    options: ExtendedRequestOptions,
  ): Promise<ApiClientResponse<T>> {
    try {
      const response = await this.retryableRequest(url, options);
      const data = (await response.json()) as T;
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { data, status: response.status, headers };
    } catch (err) {
      this.redactAuthHeaders(err);
      throw err;
    }
  }

  /**
   * Redacts Authorization headers from error objects to prevent leaking tokens in logs.
   */
  private redactAuthHeaders(err: any): void {
    if (err?.config?.headers) {
      err.config.headers = '[REDACTED]';
    }
    if (err?.response?.config?.headers) {
      err.response.config.headers = '[REDACTED]';
    }
  }
```

**Step 4: Run test to verify it passes**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/apiClient' --no-coverage`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add packages/integration-sdk-runtime/src/api/apiClient.ts packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts
git commit -m "feat(runtime): add post/get methods with response mapping and rawBody override"
```

---

## Task 3: Add gzip rawBody and auth redaction tests (TDD)

**Files:**

- Modify: `packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts`

**Step 1: Write the failing tests**

Append to `apiClient.test.ts`:

```typescript
describe('post with rawBody (gzip)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends Buffer directly as body with gzip headers', async () => {
    const responseBody = { ok: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new (jest.requireActual('node-fetch').Headers)({}),
      json: jest.fn().mockResolvedValueOnce(responseBody),
      body: null,
    } as any);

    const client = new JupiterOneApiClient({
      baseUrl: 'https://api.example.com',
      logger: mockLogger,
      account: 'test-account',
      accessToken: 'test-token',
    });

    const gzipBuffer = Buffer.from('fake-gzip-data');
    const result = await client.post('/upload', undefined, {
      rawBody: gzipBuffer,
      headers: { 'Content-Encoding': 'gzip' },
    });

    expect(result.data).toEqual(responseBody);
    // Verify node-fetch was called with the Buffer body directly
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/upload',
      expect.objectContaining({
        method: 'POST',
        body: gzipBuffer,
        headers: expect.objectContaining({
          'Content-Encoding': 'gzip',
          Authorization: 'Bearer test-token',
          'JupiterOne-Account': 'test-account',
        }),
      }),
    );
  });
});

describe('error handling', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('redacts auth headers from error objects', async () => {
    const error: any = new Error('Request failed');
    error.config = {
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
      },
    };
    error.retryable = false;

    mockFetch.mockRejectedValueOnce(error);

    const client = new JupiterOneApiClient({
      baseUrl: 'https://api.example.com',
      logger: mockLogger,
      account: 'test-account',
      accessToken: 'test-token',
    });

    await expect(client.post('/endpoint', {})).rejects.toThrow(
      'Request failed',
    );

    // Verify auth headers were redacted
    expect(error.config.headers).toBe('[REDACTED]');
  });
});
```

**Step 2: Run tests**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/apiClient' --no-coverage`
Expected: PASS (7 tests) — these should pass with existing implementation from
Task 2

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/src/api/__tests__/apiClient.test.ts
git commit -m "test(runtime): add gzip rawBody and auth redaction tests for JupiterOneApiClient"
```

---

## Task 4: Rewire createApiClient() to use JupiterOneApiClient

**Files:**

- Modify: `packages/integration-sdk-runtime/src/api/index.ts:1-139`

**Step 1: Update the implementation**

Replace the entire `createApiClient()` function and related imports. The file
becomes:

```typescript
// packages/integration-sdk-runtime/src/api/index.ts
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';

import { JupiterOneApiClient } from './apiClient';
import type { ApiClientResponse, ApiClientRequestConfig } from './apiClient';

/**
 * Public API client type used by consumers.
 */
export type ApiClient = JupiterOneApiClient;

export type { ApiClientResponse, ApiClientRequestConfig };

export interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  compressUploads?: boolean;
}

/**
 * Internal-only type for detecting removed options and throwing clear errors.
 * Not exported — callers should not see these fields in the public API.
 */
interface UnsupportedCreateApiClientInput {
  alphaOptions?: unknown;
  proxyUrl?: unknown;
  retryOptions?: unknown;
}

/**
 * Configures an api client for hitting JupiterOne APIs.
 */
export function createApiClient({
  apiBaseUrl,
  account,
  accessToken,
  compressUploads,
  alphaOptions,
  proxyUrl,
}: CreateApiClientInput & UnsupportedCreateApiClientInput): ApiClient {
  if (alphaOptions !== undefined) {
    process.emitWarning(
      'alphaOptions is no longer supported and will be ignored. Use retryOptions instead.',
      'DeprecationWarning',
    );
  }
  if (proxyUrl !== undefined) {
    process.emitWarning(
      'proxyUrl is no longer supported and will be ignored. Use environment-level proxy configuration (e.g., HTTPS_PROXY) instead.',
      'DeprecationWarning',
    );
  }

  // Construct a minimal logger for the HTTP client (BaseAPIClient requires one).
  // Integration consumers pass a real logger at the synchronization level,
  // but createApiClient itself doesn't receive one.
  const noopLogger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => noopLogger,
    isHandledError: () => false,
  } as any;

  return new JupiterOneApiClient({
    baseUrl: apiBaseUrl,
    logger: noopLogger,
    account,
    accessToken,
    compressUploads,
  });
}

/**
 * Helper to check if an API client has upload compression enabled
 */
export function isUploadCompressionEnabled(client: ApiClient): boolean {
  return client._compressUploads === true;
}

// --- Everything below is unchanged ---

interface GetApiBaseUrlInput {
  dev: boolean;
}

export const JUPITERONE_PROD_API_BASE_URL = 'https://api.us.jupiterone.io';
export const JUPITERONE_DEV_API_BASE_URL = 'https://api.dev.jupiterone.io';

export function getApiBaseUrl({ dev }: GetApiBaseUrlInput = { dev: false }) {
  if (dev) {
    return JUPITERONE_DEV_API_BASE_URL;
  } else {
    return JUPITERONE_PROD_API_BASE_URL;
  }
}

function getFromEnv(
  variableName: string,
  missingError: new () => IntegrationError,
): string {
  dotenvExpand(dotenv.config());

  const value = process.env[variableName];

  if (!value) {
    throw new missingError();
  }

  return value;
}

export const getApiKeyFromEnvironment = () =>
  getFromEnv('JUPITERONE_API_KEY', IntegrationApiKeyRequiredError);

export const getAccountFromEnvironment = () =>
  getFromEnv('JUPITERONE_ACCOUNT', IntegrationAccountRequiredError);
```

**Step 2: Run existing api tests to verify they still pass**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/index' --no-coverage`
Expected: Some tests will FAIL because they mock `createRequestClient` from
`platform-sdk-fetch` which no longer exists.

**Step 3: Update api/index tests**

Rewrite `packages/integration-sdk-runtime/src/api/__tests__/index.test.ts` —
remove all `platform-sdk-fetch` mocking, test `createApiClient()` directly
against the real `JupiterOneApiClient`:

```typescript
// packages/integration-sdk-runtime/src/api/__tests__/index.test.ts
import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
  isUploadCompressionEnabled,
} from '../index';
import { JupiterOneApiClient } from '../apiClient';

describe('getApiBaseUrl', () => {
  test('returns development base url if dev option is set to true', () => {
    expect(getApiBaseUrl({ dev: true })).toEqual(
      'https://api.dev.jupiterone.io',
    );
  });

  test('returns production base url if dev option is set to false', () => {
    expect(getApiBaseUrl({ dev: false })).toEqual(
      'https://api.us.jupiterone.io',
    );
  });

  test('defaults to returning the production base url', () => {
    expect(getApiBaseUrl()).toEqual('https://api.us.jupiterone.io');
  });
});

describe('getApiKeyFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_API_KEY;
  });

  test('returns JUPITERONE_API_KEY environment variable value', () => {
    const apiKey = getApiKeyFromEnvironment();
    expect(apiKey).toEqual('test-key');
  });

  test('throws error if JUPITERONE_API_KEY is not set', () => {
    delete process.env.JUPITERONE_API_KEY;
    expect(() => getApiKeyFromEnvironment()).toThrow(
      /JUPITERONE_API_KEY environment variable must be set/,
    );
  });
});

describe('getAccountFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_ACCOUNT = 'test-account';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_ACCOUNT;
  });

  test('returns JUPITERONE_ACCOUNT environment variable value', () => {
    const account = getAccountFromEnvironment();
    expect(account).toEqual('test-account');
  });

  test('throws error if JUPITERONE_ACCOUNT is not set', () => {
    delete process.env.JUPITERONE_ACCOUNT;
    expect(() => getAccountFromEnvironment()).toThrow(
      /JUPITERONE_ACCOUNT environment variable must be set/,
    );
  });
});

describe('createApiClient', () => {
  test('returns a JupiterOneApiClient instance', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
    });

    expect(client).toBeInstanceOf(JupiterOneApiClient);
    expect(client.post).toBeDefined();
    expect(client.get).toBeDefined();
  });

  test('sets _compressUploads flag when compressUploads is true', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
    });

    expect(client._compressUploads).toBe(true);
    expect(isUploadCompressionEnabled(client)).toBe(true);
  });

  test('does not set _compressUploads flag when compressUploads is false', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: false,
    });

    expect(client._compressUploads).toBe(false);
    expect(isUploadCompressionEnabled(client)).toBe(false);
  });

  test('warns when alphaOptions is provided', () => {
    const warnSpy = jest.spyOn(process, 'emitWarning').mockImplementation();
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      alphaOptions: {},
    } as any);
    expect(warnSpy).toHaveBeenCalledWith(
      'alphaOptions is no longer supported and will be ignored. Use retryOptions instead.',
      'DeprecationWarning',
    );
    warnSpy.mockRestore();
  });

  test('warns when proxyUrl is provided', () => {
    const warnSpy = jest.spyOn(process, 'emitWarning').mockImplementation();
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      proxyUrl: 'http://proxy:8080',
    } as any);
    expect(warnSpy).toHaveBeenCalledWith(
      'proxyUrl is no longer supported and will be ignored. Use environment-level proxy configuration (e.g., HTTPS_PROXY) instead.',
      'DeprecationWarning',
    );
    warnSpy.mockRestore();
  });
});

describe('isUploadCompressionEnabled', () => {
  it('should return true when _compressUploads is true', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      compressUploads: true,
    });

    expect(isUploadCompressionEnabled(client)).toBe(true);
  });

  it('should return true when compressUploads is undefined (default enabled)', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
    });

    expect(isUploadCompressionEnabled(client)).toBe(true);
  });
});
```

Note: The "real RequestClient request with fake API key" integration test is
removed — it tested platform-sdk-fetch's interceptor behavior which no longer
applies. Auth redaction is covered by `apiClient.test.ts`.

**Step 4: Run tests**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='api/__tests__/index' --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/integration-sdk-runtime/src/api/index.ts packages/integration-sdk-runtime/src/api/__tests__/index.test.ts
git commit -m "feat(runtime): rewire createApiClient to use JupiterOneApiClient"
```

---

## Task 5: Update synchronization/index.ts — remove platform-sdk-fetch imports

**Files:**

- Modify:
  `packages/integration-sdk-runtime/src/synchronization/index.ts:34-48,538-548,641-645`

**Step 1: Update imports and remove platform-sdk-fetch references**

Changes to make in `synchronization/index.ts`:

1. **Remove** lines 34-38 (platform-sdk-fetch imports):

   ```typescript
   // DELETE these:
   import type {
     RequestClient,
     RequestClientRequestConfig,
   } from '@jupiterone/platform-sdk-fetch';
   import { isRequestClientError } from '@jupiterone/platform-sdk-fetch';
   ```

2. **Remove** lines 40-48 (`RequestConfigWithRawBody` interface) — no longer
   needed.

3. **Update** `UploadDataChunkParams` (line 410-416): change
   `apiClient: RequestClient` to `apiClient: ApiClient`:

   ```typescript
   interface UploadDataChunkParams<
     T extends UploadDataLookup,
     K extends keyof T,
   > {
     logger: IntegrationLogger;
     apiClient: ApiClient; // was: RequestClient
     jobId: string;
     type: K;
     batch: T[K][];
   }
   ```

4. **Update** the compressed upload call (line 542-548): remove
   `as RequestConfigWithRawBody` cast:

   ```typescript
   await apiClient.post(url, undefined, {
     headers: {
       ...baseHeaders,
       'Content-Encoding': 'gzip',
     },
     rawBody: compressedData,
   });
   ```

5. **Update** `cleanRequestError` (lines 641-645): replace
   `isRequestClientError` with a simple type guard:
   ```typescript
   function cleanRequestError(err: unknown) {
     const error = err as any;
     if (error?.config?.headers?.Authorization) {
       delete error.config.headers.Authorization;
     }
   }
   ```

**Step 2: Run synchronization tests**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='synchronization/__tests__/index' --no-coverage`
Expected: PASS — the tests mock `apiClient.post` via `jest.spyOn` which still
works on the new type

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/src/synchronization/index.ts
git commit -m "refactor(runtime): remove platform-sdk-fetch imports from synchronization"
```

---

## Task 6: Update synchronization/events.ts — remove platform-sdk-fetch import

**Files:**

- Modify: `packages/integration-sdk-runtime/src/synchronization/events.ts:2,17`

**Step 1: Update the import and type reference**

1. **Remove** line 2:

   ```typescript
   // DELETE:
   import type { RequestClientRequestConfig } from '@jupiterone/platform-sdk-fetch';
   ```

2. **Update** line 17 — change parameter type:

   ```typescript
   // Before:
   config?: RequestClientRequestConfig,
   // After:
   config?: ApiClientRequestConfig,
   ```

3. **Add** import of the new type:
   ```typescript
   import type { ApiClientRequestConfig } from '../api/apiClient';
   ```

**Step 2: Run events tests (if they exist) or the full sync test suite**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='synchronization' --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/src/synchronization/events.ts
git commit -m "refactor(runtime): remove platform-sdk-fetch import from events"
```

---

## Task 7: Update test utility — remove platform-sdk-fetch types

**Files:**

- Modify: `packages/integration-sdk-runtime/test/util/request.ts`

**Step 1: Update the test utility**

Replace the file contents:

```typescript
// packages/integration-sdk-runtime/test/util/request.ts
import { RequestHeaders } from '../../src';
import type { ApiClientResponse } from '../../src/api/apiClient';

export function getExpectedRequestHeaders() {
  return {
    headers: {
      [RequestHeaders.CorrelationId]: expect.any(String),
    },
  };
}

/**
 * Creates a mock ApiClientResponse for use in tests
 */
export function createMockResponse<T>(data: T): ApiClientResponse<T> {
  return {
    data,
    status: 200,
    headers: {},
  };
}
```

**Step 2: Run sync tests to verify mock response shape still works**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='synchronization/__tests__/index' --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/test/util/request.ts
git commit -m "refactor(runtime): update test util to use ApiClientResponse type"
```

---

## Task 8: Update synchronization test — remove RequestClientError import

**Files:**

- Modify:
  `packages/integration-sdk-runtime/src/synchronization/__tests__/index.test.ts:37,583-591`

**Step 1: Update the test file**

1. **Remove** line 37:

   ```typescript
   // DELETE:
   import { RequestClientError } from '@jupiterone/platform-sdk-fetch';
   ```

2. **Update** the "should clean errors before throwing" test (around line
   583-591). Replace `RequestClientError` with a plain error object:

   ```typescript
   jest.spyOn(context.apiClient, 'post').mockImplementation(() => {
     const error: any = new Error('thing went bad');
     error.config = {
       headers: {
         Authorization: 'some fake token',
         'content-type': 'application/json',
       },
     };
     throw error;
   });
   ```

   And update the assertion (around line 607):

   ```typescript
   // The cleanRequestError function deletes the Authorization key
   expect(requestError.config.headers.Authorization).toBeUndefined();
   ```

**Step 2: Run sync tests**

Run:
`npx nx test integration-sdk-runtime -- --testPathPattern='synchronization/__tests__/index' --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/src/synchronization/__tests__/index.test.ts
git commit -m "refactor(runtime): remove RequestClientError import from sync tests"
```

---

## Task 9: Update package.json — swap dependencies

**Files:**

- Modify: `packages/integration-sdk-runtime/package.json`

**Step 1: Update dependencies**

1. **Add** `@jupiterone/integration-sdk-http-client` to dependencies (workspace
   version):

   ```json
   "@jupiterone/integration-sdk-http-client": "^17.2.1"
   ```

2. **Remove** `@jupiterone/platform-sdk-fetch` from dependencies.

3. Keep `@lifeomic/attempt` — it's still used in `synchronization/index.ts`.

**Step 2: Install dependencies**

Run: `npm install` (from repo root) Expected: Clean install, no errors

**Step 3: Commit**

```bash
git add packages/integration-sdk-runtime/package.json package-lock.json
git commit -m "chore(runtime): swap platform-sdk-fetch for integration-sdk-http-client dep"
```

---

## Task 10: Final validation — build and full test suite

**Files:** None (validation only)

**Step 1: Type check**

Run: `npx nx typecheck integration-sdk-runtime` Expected: PASS — no type errors

**Step 2: Build**

Run: `npx nx build integration-sdk-runtime` Expected: PASS

**Step 3: Run full test suite**

Run: `npx nx test integration-sdk-runtime --no-coverage` Expected: All tests
PASS

**Step 4: Run affected tests across the monorepo**

Run: `npx nx affected -t test --base=main` Expected: All affected packages pass.
If other packages import from `integration-sdk-runtime`, they should still work
because the public API (`createApiClient`, `ApiClient`,
`isUploadCompressionEnabled`) maintains the same shape.

**Step 5: Verify no remaining platform-sdk-fetch references in runtime**

Run: `grep -r "platform-sdk-fetch" packages/integration-sdk-runtime/` Expected:
No matches

**Step 6: Commit if any fixes were needed, then squash or keep as-is for PR**

```bash
# If clean, no commit needed.
# If fixes were made during validation, commit them:
git add -A packages/integration-sdk-runtime/
git commit -m "fix(runtime): address validation findings"
```

---

## Task 11: E2E Validation — Canary release + AWS integration deploy

This task validates the changes end-to-end in the `jupiterone-dev` environment
by publishing a canary version of `integration-sdk-runtime`, installing it in
the integrations repo, and deploying the AWS integration.

**Repos involved:**

- `~/Documents/sdk` — SDK monorepo (this repo)
- `~/Documents/integrations` — integrations monorepo

**Prerequisites:**

- All Tasks 1-10 complete and passing
- AWS SSO session active for `jupiterone-dev`

### Step 1: Push changes and create/update PR in SDK repo

```bash
cd ~/Documents/sdk
git push origin feat/PLATENG-800-replace-lifeomic-alpha
```

If a PR doesn't already exist, create one. If PR #1188 is still open from the
prior approach, update it or create a new one.

### Step 2: Trigger canary release

Comment `/canary-release` on the SDK PR. This triggers the `canary.yaml` GitHub
Actions workflow.

```bash
# If PR number is known (e.g., 1188 or new):
gh pr comment <PR_NUMBER> --body "/canary-release"
```

### Step 3: Wait for canary release to complete

```bash
# Watch the canary workflow run
gh run watch
```

Expected: Workflow succeeds, publishes canary versions like
`17.2.2-canary-<PR>-<RUN_ID>.0`.

### Step 4: Note the canary version

From the workflow output, grab the exact canary version string for
`@jupiterone/integration-sdk-runtime`. It will look like:

```
@jupiterone/integration-sdk-runtime@17.2.2-canary-XXXX-YYYYYYYYYY.0
```

### Step 5: Update integrations repo with canary version

The integrations repo at `~/Documents/integrations` already has pnpm overrides
in `package.json` (lines 96-101). Update the override to point to the new canary
version:

```bash
cd ~/Documents/integrations
```

Edit `package.json` pnpm overrides section:

```json
"pnpm": {
  "overrides": {
    "typescript": "catalog:",
    "@types/bunyan": "1.8.11",
    "@jupiterone/integration-sdk-runtime": "<NEW_CANARY_VERSION>"
  }
}
```

**Important:** Remove the `@jupiterone/platform-sdk-fetch` override (line 100) —
the new runtime no longer depends on it.

Then install:

```bash
pnpm install
```

### Step 6: Log into AWS

```bash
aws sso login --profile jupiterone-dev
```

Verify login:

```bash
aws sts get-caller-identity --profile jupiterone-dev
```

### Step 7: Deploy AWS integration to jupiterone-dev

```bash
cd ~/Documents/integrations/deployments/aws
pnpm run build
pnpm dlx --package @jupiterone/ci-tools@latest ci-tools local deploy -a apply -e jupiterone-dev
```

### Step 8: Hand off to manual E2E testing

At this point, the deployment is live. **You (the user) take over** to:

1. Log into the JupiterOne platform (dev environment)
2. Trigger an integration job for the AWS integration
3. Verify the job completes successfully — entities and relationships sync
   correctly
4. Verify gzip-compressed uploads work (default behavior)
5. Check logs for any unexpected errors

### Step 9: Clean up after validation

Once E2E passes:

1. Remove the pnpm override from `~/Documents/integrations/package.json` (it was
   only for canary testing)
2. The canary version will be replaced by the real release once the SDK PR
   merges

```bash
cd ~/Documents/integrations
# Revert the override changes
git checkout -- package.json pnpm-lock.yaml
```
