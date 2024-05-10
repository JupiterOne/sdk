# Authentication

Defines the authentication method to use for the API. The template currently
supports two options for Authentication.

## Option 1 - Endpoint:

Use this method if you need to hit an endpoint to get authentication headers.

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
  authHeaders: Object
}
```

Note: `authHeaders` represents the authentication headers that will be present
on all API requests the client makes, aside from the initial
`verifyAuthentication` request. The `authHeaders` object should contain at least
the `Authorization` property, which is typically a bearer token or API key.

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
  "authHeaders": {
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

## Option 2 - Config Fields:

Use this method if the authentication headers will be provided in the instance
config.

|                     |                  |
| ------------------- | ---------------- |
| Property            | `authentication` |
| Type                | `Object`         |
| Required            | `true`           |
| Available templates | `config`         |

```ts
{
  strategy: 'configField',
  authHeaders: Object
}
```

Example:

```json
{
  "strategy": "configField",
  "authHeaders": {
    "x-api-user": "%config.email%",
    "x-api-token": "%config.token%"
  }
}
```

Using this authentication schema will result in an incomplete
verifyAuthentication() function in the generated client. This is because the
graph-project generator does not know what endpoint to use for verifying
authentication. <b>You will need to manually update the generated
verifyAuthentication() function and choose what endpoint should be used for
verifying authentication.</b>
