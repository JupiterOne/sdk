# @jupiterone/integration-sdk-runtime

_NOTE:_ This project is currently under development and the API interface is not
stable. Use at your own risk.

This package contains the runtime code required for executing an integration.

## Installation

```
npm install @jupiterone/integration-sdk-runtime

# or

yarn add @jupiterone/integration-sdk-runtime
```

## HTTP Client

The SDK runtime now uses a lightweight HTTP client built on top of `undici`
instead of `@lifeomic/alpha`. This provides:

- **Lightweight**: Minimal dependencies, built on Node.js native `undici`
- **Proxy Support**: Full HTTP/HTTPS proxy support via the `proxy` option
- **Node 22 Ready**: Compatible with Node.js 18+ including Node 22
- **Retry Logic**: Built-in exponential backoff retry mechanism
- **Interceptor Support**: Compatible with existing interceptor patterns

### Usage with Proxy

```typescript
import { createApiClient } from '@jupiterone/integration-sdk-runtime';

const client = createApiClient({
  apiBaseUrl: 'https://api.us.jupiterone.io',
  account: 'your-account',
  accessToken: 'your-token',
  proxy: 'http://proxy.example.com:8080', // HTTP proxy
  // or
  proxy: 'https://proxy.example.com:8443', // HTTPS proxy
  timeout: 30000, // 30 seconds
  retryOptions: {
    attempts: 3,
    factor: 2,
    maxTimeout: 30000,
  },
});
```

### Environment Variables

You can also configure the proxy via environment variables:

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8443
```

## Features

- **Synchronization**: Upload collected data to JupiterOne
- **Execution**: Run integration steps with dependency management
- **Storage**: File system and in-memory storage options
- **Logging**: Structured logging with Bunyan
- **Metrics**: Performance monitoring and reporting
