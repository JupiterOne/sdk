# Authentication

Defines the authentication type for the API.

## Schema 1 - Endpoint:

Use this method if you must hit an endpoint to get authentication headers.

|                     |                     |
| ------------------- | ------------------- |
| Property            | `authentication`    |
| Type                | `Object`            |
| Required            | `true`              |
| Available templates | `config` `response` |

```ts
{
    strategy: 'endpoint',
    params: {
        path: String,
        method: 'GET' | 'POST',
        body?: Object,
        headers?: Object
    }
    outputHeaders: Object
}
```

Example:

```json
{
  "strategy": "endpoint",
  "params": {
    "path": "/auth",
    "method": "POST",
    "headers": {
      "user-agent": "JupiterOne",
      "tenant": "%config.tenant%"
    },
    "body": {
      "exampleBody": "%config.exampleConfigValue%"
    }
  },
  "outputHeaders": {
    "user-agent": "JupiterOne",
    "tenant": "%config.tenant%",
    "Authorization": "bearer %response.auth.token%"
  }
}
```

Using this authentication schema will result in a verifyAuthentication()
function in the generated client that is ready-to-use; that is, the function
requires no manual updates, and when your integration runs, it will hit the
provided endpoint to verify authentication.

## Schema 2 - Config Fields:

|                     |                  |
| ------------------- | ---------------- |
| Property            | `authentication` |
| Type                | `Object`         |
| Required            | `true`           |
| Available templates | `config`         |

```ts
{
    strategy: 'configField',
    outputHeaders: Object
}
```

Example:

```json
{
  "strategy": "configField",
  "outputHeaders": {
    "user-agent": "JupiterOne",
    "Authorization": "bearer %config.apiKey%"
  }
}
```

Using this authentication schema will result in an incomplete
verifyAuthentication() function in the generated client. This is because the
graph-project generator does not know what endpoint to use for verifying
authentication. <b>You will need to manually update the generated
verifyAuthentication() function and choose what endpoint should be used for
verifying authentication.</b>
