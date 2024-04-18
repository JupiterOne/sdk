# Steps

- [Steps](#steps)
  - [Format](#format)
    - [id](#id)
    - [name](#name)
    - [dataPath](#datapath)
    - [nextTokenPath](#nexttokenpath)
    - [tokens](#tokens)
    - [request](#request)
      - [urlTemplate](#urltemplate)
      - [method](#method)
      - [params](#params)
    - [entity](#entity)
      - [\_type](#_type)
      - [\_class](#_class)
      - [\_keyFormat](#_keyformat)
      - [parentRelationship](#parentrelationship)
      - [fieldMappings](#fieldmappings)
    - [directRelationships](#directrelationships)
      - [targetKey](#targetkey)
      - [targetType](#targettype)
      - [\_class](#_class-1)
      - [direction](#direction)
    - [mappedRelationships](#mappedrelationships)
      - [\_class](#_class-2)
      - [direction](#direction-1)
      - [fieldMappings](#fieldmappings-1)
    - [dependsOn](#dependson)

## Format

```ts
{
    id: string,
    name: string,
    entity: {
        _type: string,
        _class: string | Array<string>,
        _keyFormat: string,
        parentRelationship?: {
            _class: RelationshipClass
        },
        fieldMappings?: {
          [entityProperty: string]: string
        }
    },
    request: {
        urlTemplate: string,
        method?: 'GET' | 'POST',
        params?:
    },
    dataPath: string,
    nextTokenPath?: string,
    tokens?: number,
    directRelationships?: {
        targetKey: string,
        targetType: string,
        _class: RelationshipClass
        direction: 'FORWARD' | 'REVERSE'
    }[],
    mappedRelationships?: {
        _class: RelationshipClass,
        direction: 'FORWARD' | 'REVERSE',
        fieldMappings: {
            sourceProperty: string,
            targetProperty: string
        } | {
            targetValue: string,
            targetProperty: string
        }
    }[],
    dependsOn?: Array<string>
}
```

### id

Unique identifier of the step

Example: `fetch-github-users`

### name

User-facing name of the step

Example: `Fetch GitHub Users`

### dataPath

Path to the data to iterate

Examples:

```json
{
    "response": {
        "data": [
            { "..." },
            { "..." },
            { "..." },
            "..."
        ]
    }
}

dataPath: "response.data"
```

```json
[
    { "..." },
    { "..." },
    { "..." },
    "..."
]

dataPath: ""
```

### nextTokenPath

Path in the data to the nextToken

Example:

```json
{
    "response": {
        "data": [
            "..."
        ],
        "pagination": {
            "limit": 100,
            "cursor": "abcd1234"
        }
    }
}

dataPath: "response.pagination.cursor"
```

### tokens

Number of tokens and tokens/second refill rate.

Example: 20 calls/second = `tokens: 20`

### request

Information about the API call.

#### urlTemplate

You can iterate entities with this step by including the format
`%entity.TYPE.PROPERTY%` in the URL.

|                     |               |
| ------------------- | ------------- |
| Property            | `urlTemplate` |
| Type                | `string`      |
| Required            | `true`        |
| Available templates | `nextToken`   |

Example:

```json
{
  "urlTemplate": "/users?nextPage=%nextToken%&limit=100"
}
```

```json
{
  "urlTemplate": "/organizations/%entity.github_organizations.id%/users?nextPage=%nextToken%&limit=100"
}
```

#### method

|                     |          |
| ------------------- | -------- |
| Property            | `method` |
| Type                | `string` |
| Required            | `false`  |
| Available templates |          |

Accepts `GET` or `POST`. Defaults to `GET`.

#### params

|                     |             |
| ------------------- | ----------- |
| Property            | `params`    |
| Type                | `Object`    |
| Required            | `false`     |
| Available templates | `nextToken` |

Specifies the POST body.

Example:

```json
{
  "urlTemplate": "/findings",
  "method": "POST",
  "params": {
    "nextPage": "%nextToken%",
    "filter": {
      "active": true
    }
  }
}
```

### entity

#### \_type

Type of the entity.

Example: `github_user`

#### \_class

Class(es) of the entity.

Example: `User`

#### \_keyFormat

|                     |                   |
| ------------------- | ----------------- |
| Property            | `_keyFormat`      |
| Type                | `string`          |
| Required            | `true`            |
| Available templates | `entity` `parent` |

Examples:

`%entity.user_name%`

`%parent.organization_id%/%entity.id%`

#### parentRelationship

Specify this if you would like to build a relationship between the current
entity and its parent. The value should be a valid relationship class.

#### fieldMappings

Optionally specify mappings to convert data to entity properties.

Example:

Data:

```json
{
  "id": 1,
  "foo": {
    "bar": 2,
    "baz": ["123"]
  }
}
```

fieldMappings:

```json
{
  "id": "id",
  "name": "foo.bar",
  "groups": "foo.baz"
}
```

Resulting entity:

```json
{
  "id": 1,
  "name": 2,
  "groups": ["123"]
}
```

### directRelationships

#### targetKey

This should be the `_key` property of the target entity.

|                     |             |
| ------------------- | ----------- |
| Property            | `targetKey` |
| Type                | `string`    |
| Required            | `false`     |
| Available templates | `entity`    |

Example: `%entity.organizationId%`

#### targetType

`_type` of the target entity.

#### \_class

`_class` of the relationship.

#### direction

`FORWARD` to build the relationship FROM entity TO target. `REVERSE` to build
the relationship TO target FROM reverse.

### mappedRelationships

#### \_class

`_class` of the relationship.

#### direction

`FORWARD` to build the relationship FROM entity TO target. `REVERSE` to build
the relationship TO target FROM reverse.

#### fieldMappings

`targetProperty` are the `targetFilterKeys` of the mapped relationship.

You can use `sourceProperty` to use a property from the current entity or
`targetValue` to use a static value.

Example:

```json
[
  {
    "targetProperty": "_type",
    "targetValue": "CIDR"
  },
  {
    "targetProperty": "cidr",
    "sourceProperty": "_key"
  }
]
```

### dependsOn

List of steps this step depends on.

Example: `["fetch-organizations"]`
