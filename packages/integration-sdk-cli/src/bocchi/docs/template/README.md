# Template Format

```ts
{
    instanceConfigFields: Object,
    baseUrl: string,
    authentication: Object,
    tokenBucket: Object
    steps: Array<Object>
}
```

- [Template Format](#template-format)
  - [Fields](#fields)
    - [Instance Config Fields](#instance-config-fields)
    - [Base URL](#base-url)
    - [Authentication](#authentication)
    - [Token Bucket](#token-bucket)
    - [Steps](#steps)

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
    [configName]: {
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

### Authentication

[Authentication](./authentication.md)

### Token Bucket

Allows you to define a rate limit across all steps. Useful for an API where the
rate limit is per API key rather than per endpoint.

Can be used in combination with step-level token buckets.

Schema:

|                     |               |
| ------------------- | ------------- |
| Property            | `tokenBucket` |
| Type                | `Object`      |
| Required            | `false`       |
| Available templates |               |

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

### Steps

[Steps](./steps.md)
