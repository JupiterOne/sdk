# @jupiterone/integration-sdk-http-client

The Base API Client is a foundational class designed to simplify interactions
with RESTful APIs. It abstracts common tasks such as making HTTP requests,
handling retries, and managing rate limits. Built with flexibility in mind, it
allows for easy extension to accommodate specific API endpoints of different
services.

## Features

- **Automatic Retries:** Implements an exponential backoff strategy for handling
  transient network and server errors.
- **Pagination Support:** Includes utility methods for handling API pagination,
  making it easier to iterate over large data sets.
- **Rate Limit Handling:** Monitors API usage against provided rate limit
  headers to prevent hitting API limits.
- **Token Bucket Rate Limiting:** Optionally integrates a token bucket algorithm
  for fine-grained control over request rate limiting.
- **Extensible Authentication:** Abstract method for setting authorization
  headers allows for flexible integration with different authentication
  mechanisms.
- **Error Handling:** Provides a structured approach to handle and log API
  request errors, including support for custom error handling logic.

## Installation

```bash
npm install node-fetch @jupiterone/integration-sdk-http-client
```

## Usage

To use the Base API Client, extend it to create a custom client for your
specific API. Implement the getAuthorizationHeaders method to provide the
necessary authentication headers for your API requests.

The `getAuthorizationHeaders` method doesn't need to be called manually, it's
going to be called on the first request and saved and used for subsequent
requests.

Below are the details of each option available in the BaseAPIClient constructor:

`baseUrl` (required)

- **Type:** `string`
- **Description:** The base URL for the API endpoints. All requests made through
  the client will use this URL as the base for constructing the full endpoint
  path. Exception: When a complete URL is sent to `request` or
  `retryableRequest` that will be used instead.

`logger` (required)

- **Type:** `IntegrationLogger`
- **Description:** An instance of `IntegrationLogger` used by the client to log
  messages. This is typically provided by the integration context and should
  support various log levels (e.g., info, warn, error).

`retryOptions` (optional)

- **Type:** `Partial<RetryOptions>`
- **Description:** Configuration options for controlling the behavior of request
  retries in case of failures. This is enabled by default.
  - `maxAttempts`: The maximum number of retry attempts.
  - `delay`: The initial delay between retries in milliseconds.
  - `timeout`: The maximum time to wait for a response before timing out.
  - `factor`: The factor by which the delay increases after each attempt (for
    exponential backoff).
  - `handleError`: A custom function invoked when an error occurs during a
    request attempt. This function allows for sophisticated error handling
    strategies, including conditional retries based on the type or severity of
    the error encountered.

`logErrorBody` (optional)

- **Type:** `boolean`
- **Description:** Indicates whether the body of a response should be logged
  when an error occurs. Defaults to `false` to prevent logging sensitive
  information.

`rateLimitThrottling` (optional)

- **Type:** `RateLimitThrottlingOptions`
- **Description:** Configuration options for handling API rate limits. A
  treshold needs to be specified to enable this feature.
  - `threshold`: A value between 0 and 1 indicating the percentage of rate limit
    utilization at which to start throttling requests.
  - `resetMode`: Specifies how to interpret the rate limit reset header. Options
    include `'remaining_epoch_s'` and `'datetime_epoch_s'`. Default is
    `remaining_epoch_s`.
  - `rateLimitHeaders`: Customizes the header names used to determine rate
    limits. Includes `limit`, `remaining`, and `reset` fields. Defaults are:
    `ratelimit-limit`, `ratelimit-remaining` and `ratelimit-reset`.

`tokenBucket` (optional)

- **Type:** `TokenBucketOptions`
- **Description:** Configuration options for a token bucket rate limiting
  mechanism.
  - `maximumCapacity`: The maximum number of tokens the bucket can hold.
  - `refillRate`: The rate at which tokens are added to the bucket in a second.

#### Example: Extending BaseAPIClient for a Custom API

```typescript
import { BaseAPIClient } from '@jupiterone/integration-sdk-http-client';

class CustomAPIClient extends BaseAPIClient {
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig, logger: IntegrationLogger) {
    super({
      baseUrl: `https://${config.accountId}.example.com/api`,
      logger,
    });
    this.config = config;
  }

  protected async getAuthorizationHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
    };
  }

  // Add methods to interact with your specific API endpoints
  async fetchResource(): Promise<any> {
    const response = await this.retryableRequest('/your-api-endpoint');
    return await response.json();
  }
}

// Usage
const client = new CustomAPIClient(config, logger);
const data = await client.fetchResource();
```

There's some APIs that require to send a request first to get the Bearer token,
that is also possible:

```typescript
protected async getAuthorizationHeaders(): Promise<Record<string, string>> {
  const tokenResponse = await this.request('/oauth/token', {
    method: 'POST',
    body: {
      username: this.username,
      password: this.password,
    },
    authorize: false, // This is important to set when doing this request because otherwise `request()` is going to call this method going in a infinite loop.
  });
  const data = await tokenResponse.json();
  return {
    Authorization: `Bearer ${data.access_token}`,
  };
}
```

---

### Pagination Support:

To effectively use pagination with the BaseAPIClient class, you'll generally
follow a pattern where you make an initial request to an endpoint that supports
pagination and then continue to fetch subsequent pages of data based on the
information provided in the response of each request. This process is often
necessary for APIs that return large sets of data in chunks (pages) to reduce
load on their servers and improve response times.

The BaseAPIClient class provides an abstracted method, `paginate`, to facilitate
the implementation of pagination in your API requests. Here's how you can use
it:

You'll need to send 3 parameters to the `paginate` method:

- An initial request configuration (endpoint and options).
- A path to the items in the API response.
- A callback function that determines the parameters for fetching the next page,
  based on the current response.

##### Example: Cursor-based pagination

```typescript
async iterateResources(iteratee: (resource: any) => Promise<void>): Promise<void> {
  const baseEndpoint = '/resources?limit=100';
  const iterator = this.paginate(
    { endpoint: baseEndpoint },
    'data.items', // This is the path to access the array items, in this example we would iterate over the items in a response like { "data": { "items": [{ "id": 1, "name": "test-1" }, { "id": 2, "name": "test-2" }] } }
    (data) => {
      const { body } = data;
      // Assuming the nextPageData.body includes a `nextCursor` property
      const nextCursor = body.nextCursor;
      if (!nextCursor) {
        return; // No more pages
      }
      return {
        nextUrl: `${baseEndpoint}&cursor=${nextCursor}`,
      };
    }
  );

  for await (const resource of iterator) {
    await iteratee(resource);
  }
}
```
