# Steps

Defines the steps that should be created for the graph project. Each step object
defines the API request and response needed to create graph objects, the
entities and relationships that should be made, as well as parent entity
association.

Contents:

- [Format](#format)
- [Fields](#fields)
  - [id](#id)
  - [name](#name)
  - [entity](#entity)
    - [name](#name-1)
    - [\_type](#_type)
    - [\_class](#_class)
    - [\_keyPath](#_keyPath)
    - [fieldMappings](#fieldMappings)
    - [staticFields](#staticFields)
  - [parentAssociation](#parentAssociation)
    - [parentEntityType](#parentEntityType)
    - [relationshipClass](#relationshipClass)
  - [request](#request)
    - [urlTemplate](#urlTemplate)
    - [method](#method)
    - [params](#parms)
  - [response](#response)
    - [dataPath](#dataPath)
    - [responseType](#responseType)
    - [nextTokenPath](#nextTokenPath)
  - [directRelationships](#directrelationships)
    - [targetKey](#targetKey)
    - [targetType](#targetType)
    - [\_class](#_class-1)
    - [direction](#direction)
  - [mappedRelationships](#mappedrelationships)
    - [\_class](#_class-2)
    - [direction](#direction-1)
    - [fieldMappings](#fieldMappings-1)
  - [dependsOn](#dependson)

# Format

```ts
{
    id: string,
    name: string,
    entity: {
        _type: string,
        _class: string | Array<string>,
        _keyFormat: string,
        staticFields?: {
          [fieldName: string]: string | boolean | number | string[] | boolean[] | number[]
        },
        fieldMappings?: {
          [entityProperty: string]: string
        },
        parentRelationship?: {
          _class: RelationshipClass
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

# Fields

## id

|          |          |
| -------- | -------- |
| Property | `id`     |
| Type     | `String` |
| Required | `true`   |

Unique identifier of the step

Example: `fetch-github-users`

## name

|          |          |
| -------- | -------- |
| Property | `name`   |
| Type     | `String` |
| Required | `true`   |

User-facing name of the step

Example: `Fetch GitHub Users`

## entity

|          |          |
| -------- | -------- |
| Property | `entity` |
| Type     | `Object` |
| Required | `true`   |

The type entity that will be ingested for this step.

### name

|          |          |
| -------- | -------- |
| Property | `name`   |
| Type     | `String` |
| Required | `true`   |

Name of the entity.

Example: `Cloud WAF Instance`

### \_type

|          |          |
| -------- | -------- |
| Property | `_type`  |
| Type     | `String` |
| Required | `true`   |

Type of the entity.

Example: `github_user`

### \_class

|          |                     |
| -------- | ------------------- |
| Property | `_class`            |
| Type     | `String` `String[]` |
| Required | `true`              |

Class(es) of the entity.

Example: `User`

### \_keyPath

|          |            |
| -------- | ---------- |
| Property | `_keyPath` |
| Type     | `String`   |
| Required | `true`     |

The property path in the entity that should serve as the entity's \_key.

Example: `email`

Note: You do <b>not</b> need to use templating here (i.e. `%entity.id%`). You
simply need to enter the name of the property you would like to use as the
entity's \_key.

### staticFields

|          |                |
| -------- | -------------- |
| Property | `staticFields` |
| Type     | `Object`       |
| Required | `false`        |

Properties that will appear on all generated entities in the step.

Example:

```
{
  bocchi: "the rock"
  shiba: "inu"
}
```

### fieldMappings

|          |                 |
| -------- | --------------- |
| Property | `fieldMappings` |
| Type     | `Object`        |
| Required | `false`         |

Optionally specify mappings to convert data to entity properties.

Example:

<i>Original data:</i>

```json
{
  "id": 1,
  "foo": {
    "bar": 2,
    "baz": ["123"]
  }
}
```

<i>fieldMappings:</i>

```json
{
  "id": "id",
  "name": "foo.bar",
  "groups": "foo.baz"
}
```

<i>Resulting entity:</i>

```json
{
  "id": 1,
  "name": 2,
  "groups": ["123"]
}
```

## parentAssociation

|          |                    |
| -------- | ------------------ |
| Property | `parentEntityType` |
| Type     | `Object`           |
| Required | `false`            |

To be used if the step follows the
[Fetch Child Entities](https://github.com/JupiterOne/sdk/blob/main/docs/integrations/step-patterns.md#fetch-child-entities-step-pattern)
pattern - that is, to get the entities associated with this step, a parent
entity's \_key is needed.

Note: while `parentAssociation` is optional, if it is provided, then both of its
fields, `parentEntityType` and `relationshipClass` (below), are required.

Example:

```
{
  "parentEntityType": "bocchi_organization",
  "relationshipClass": "HAS"
}
```

### parentEntityType

|          |                    |
| -------- | ------------------ |
| Property | `parentEntityType` |
| Type     | `string`           |
| Required | `true`             |

The type of the parent entity.

Example: `signal_sciences_organization`

### relationshipClass

|          |                     |
| -------- | ------------------- |
| Property | `relationshipClass` |
| Type     | `string`            |
| Required | `true`              |

The class of relationship to the parent entity. The value should be a valid
relationship class.

Example: `HAS`

## request

|          |           |
| -------- | --------- |
| Property | `request` |
| Type     | `Object`  |
| Required | `true`    |

Information about the API request for this step.

Example:

```json
{
  "urlTemplate": "/users",
  "method": "GET"
}
```

### urlTemplate

|                     |                      |
| ------------------- | -------------------- |
| Property            | `urlTemplate`        |
| Type                | `String`             |
| Required            | `true`               |
| Available templates | `parent` `nextToken` |

The URL to make a request to. You can iterate entities with this step by
including the format `%parent.PROPERTY%` in the URL.

Example:

```json
{
  "urlTemplate": "/users?nextPage=%nextToken%&limit=100"
}
```

```json
{
  "urlTemplate": "/corps/%parent._key%/test/%parent._otherKey%/cloudwafInstances"
}
```

### method

|          |          |
| -------- | -------- |
| Property | `method` |
| Type     | `String` |
| Required | `false`  |

The request method. Accepts `GET` or `POST`. Defaults to `GET`.

### params

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

## response

|          |            |
| -------- | ---------- |
| Property | `response` |
| Type     | `Object`   |
| Required | `true`     |

Information about the API response for this step.

Example:

```json
{
  "dataPath": "data",
  "responseType": "LIST",
  "nextTokenPath": "next"
}
```

### dataPath

|          |            |
| -------- | ---------- |
| Property | `dataPath` |
| Type     | `String`   |
| Required | `true`     |

Path in the API response to iterate.

Example:

<i>API Response</i>:

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
```

<i>Template:</i>

```json
{
  "dataPath": "response.data"
}
```

### responseType

|          |                |
| -------- | -------------- |
| Property | `responseType` |
| Type     | `String`       |
| Required | `true`         |

The type of response object. `SINGLETON` means that there is only a single thing
in the response we should make an entity for. `LIST` means that there are
multiple things we need to make entities for.

Example:

<i>Original Response:</i>

```json
{
  "data": { "bocchi": "the rock" }
}
```

Should be a `SINGLETON`. Whereas,

<i>Original Response:</i>

```json
{
  "data": [{ "bocchi": "the rock" }, { "japan": "is nice" }]
}
```

would be a `LIST`.

### nextTokenPath

|          |            |
| -------- | ---------- |
| Property | `dataPath` |
| Type     | `String`   |
| Required | `false`    |

Path in the API response to the nextToken.

Example:

<i>API Response:</i>

```json
{
  "response": {
    "data": ["..."],
    "pagination": {
      "limit": 100,
      "cursor": "abcd1234"
    }
  }
}
```

<i>Template:</i>

```json
{
  "nextTokenPath": "response.pagination.cursor"
}
```

## directRelationships

|          |                       |
| -------- | --------------------- |
| Property | `directRelationships` |
| Type     | `Object[]`            |
| Required | `false`               |

Example:

```json
[
  {
    "targetKey": "corps",
    "targetType": "signal_sciences_user",
    "_class": "HAS",
    "direction": "FORWARD"
  },
  {
    "targetKey": "corps",
    "targetType": "signal_sciences_user",
    "_class": "HAS",
    "direction": "REVERSE"
  }
]
```

### targetKey

|          |             |
| -------- | ----------- |
| Property | `targetKey` |
| Type     | `String`    |
| Required | `true`      |

The `_key` property of the target entity.

Example: `%entity.organizationId%`

### targetType

|          |              |
| -------- | ------------ |
| Property | `targetType` |
| Type     | `String`     |
| Required | `true`       |

The `_type` of the target entity.

### \_class

|          |          |
| -------- | -------- |
| Property | `_class` |
| Type     | `String` |
| Required | `true`   |

The `_class` of the relationship.

### direction

|          |             |
| -------- | ----------- |
| Property | `direction` |
| Type     | `String`    |
| Required | `true`      |

The direction of the relationship. `FORWARD` to build the relationship FROM
entity TO target. `REVERSE` to build the relationship TO target FROM reverse.

## mappedRelationships

|          |                       |
| -------- | --------------------- |
| Property | `mappedRelationships` |
| Type     | `Object[]`            |
| Required | `false`               |

Example:

```json
[
  {
    "_class": "IS",
    "direction": "REVERSE",
    "fieldMappings": [
      {
        "targetValue": "google_user",
        "targetProperty": "_type"
      },
      {
        "sourceProperty": "email",
        "targetProperty": "email"
      }
    ]
  }
]
```

### \_class

|          |          |
| -------- | -------- |
| Property | `_class` |
| Type     | `String` |
| Required | `true`   |

`_class` of the relationship. Should be a valid relationship class.

### direction

|          |             |
| -------- | ----------- |
| Property | `direction` |
| Type     | `String`    |
| Required | `true`      |

The direction of the mapped relationship. `FORWARD` to build the relationship
FROM entity TO target. `REVERSE` to build the relationship TO target FROM
reverse.

### fieldMappings

|          |                 |
| -------- | --------------- |
| Property | `fieldMappings` |
| Type     | `Object`        |
| Required | `false`         |

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

## dependsOn

|          |             |
| -------- | ----------- |
| Property | `dependsOn` |
| Type     | `String[]`  |
| Required | `false`     |

List of steps this step depends on.

Example: `["fetch-organizations"]`
