# The Template File

In order to generate the graph project code, Bocchi interprets a
developer-provided JSON template file. This JSON template defines key components
of the integration, such as instance configuration fields, the authentication
method, as well as what steps the integration should have.

Contents:

- [Format](#format)
- [Fields](#fields)
  - [Instance Config Fields](#instance-config-fields)
  - [Base URL](#base-url)
  - [Token Bucket](#token-bucket)
  - [Authentication](#authentication)
  - [Steps](#steps)

## Format

```ts
{
    instanceConfigFields: Object,
    baseUrl: string,
    tokenBucket: Object
    authentication: Object,
    steps: Array<Object>
}
```

## Fields

### Instance Config Fields

Lists out the config fields used by this integration.

Schema:

|          |                        |
| -------- | ---------------------- |
| Property | `instanceConfigFields` |
| Type     | `Object`               |
| Required | `true`                 |

```ts
{
    [configFieldName]: {
        type?: 'string' | 'json' | 'boolean',
        mask?: Boolean,
        optional?: Boolean
    }
}
```

Example:

```json
{
  "accessKey": {
    "type": "string"
  },
  "accessKeyId": {
    "type": "string",
    "optional": false
  },
  "example": {
    "type": "boolean",
    "mask": true,
    "optional": true
  }
}
```

### Base URL

Template for the base URL of the API.

Schema:

|                     |           |
| ------------------- | --------- |
| Property            | `baseUrl` |
| Type                | `string`  |
| Required            | `true`    |
| Available templates | `config`  |

Examples:

`https://api.github.com/octocat`

`https://%config.tenant%.example.com`

### Token Bucket

Allows you to define a rate limit across all steps. Useful for an API where the
rate limit is per API key rather than per endpoint.

Can be used in combination with step-level token buckets.

Schema:

|          |               |
| -------- | ------------- |
| Property | `tokenBucket` |
| Type     | `Object`      |
| Required | `false`       |

```ts
{
    maximumCapacity: number,
    refillRate: number
}
```

Examples:

10 API calls / second

```json
{
  "maximumCapacity": 10,
  "refillRate": 10
}
```

10 API calls / second, 50 Burst

```json
{
  "maximumCapacity": 50,
  "refillRate": 10
}
```

### Authentication

[Authentication](./authentication.md)

### Steps

[Steps](./steps.md)
