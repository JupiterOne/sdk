# createIntegrationHelpers

This function is used to create typeful integration helpers .

```typescript
function createIntegrationHelpers(
  options: CreateIntegrationHelpersOptions,
): IntegrationHelpers;
```

#### Parameters

- `options` - An object containing the following properties:
  - `integrationName`: Integration name. **_Example: 'aws', 'microsoft_365'_**
  - `classSchemaMap`: Typebox class schema map.

#### Returns

An object containing the following properties:

- `createEntityType`: A function to generate entity types with
  `${integrationName}_${entityName}` pattern.
- `createIntegrationEntity`: A function to create a entity metadata and a typed
  create entity function.

#### Example

```typescript
import { createIntegrationHelpers } from '@jupiterone/integration-sdk-core';
import { classSchemaTypeboxMap } from '@jupiterone/data-model';

const { createEntityType, createIntegrationEntity } = createIntegrationHelpers({
  integrationName: 'my_awesome_integration',
  schemaMap: classSchemaTypeboxMap,
});

const [USER_ENTITY, createUserAssignEntity] = createIntegrationEntity({
  resourceName: 'User',
  _class: ['User'],
  _type: createEntityType('user'), // This will generate "my_awesome_integration_user", but you are free to not use the createEntityType helper
  description: 'Entity description', // This will be used in the json schema
  schema: Type.Object({
    name: Type.String(),
  }),
});

// _type and _class will be generated automatically
createUserAssignEntity({
  _key: `${Entities.ACCOUNT._type}|${_integrationInstanceId}`,
  name,
});
```

# How to use it in a current graph integration

1. Create a file named helpers.ts in the src folder of your integration
2. Add the following code to the file:

```typescript
import { createIntegrationHelpers } from '@jupiterone/integration-sdk-core';
import { classSchemaTypeboxMap } from '@jupiterone/data-model';

export const { createEntityType, createIntegrationEntity } =
  createIntegrationHelpers({
    integrationName: INTEGRATION_NAME,
    schemaMap: classSchemaTypeboxMap,
  });
```

3. Replace INTEGRATION_NAME with the name of your integration
4. Create a file named entities.ts in the src folder of your integration and add
   all entities as the following EXAMPLE code:

```typescript
import { createEntityType, createIntegrationEntity } from './helpers';

export const [UserEntityMetadata, createUserAssignEntity] =
  createIntegrationEntity({
    resourceName: 'User',
    _class: ['User'],
    _type: createEntityType('user'), // This will generate `${INTEGRATION_NAME}_user`, but you are free to not use the createEntityType helper
    description: 'Entity description', // This will be used in the json schema
    schema: Type.Object({
      name: Type.String(),
    }),
  });
```

5. Edit the constants.ts files and replace every entity with the new entities
   created in the entities.ts file as the following EXAMPLE code:

```typescript
import { UserEntityMetadata } from './entities';

export const Entities: Record<
  | 'USER'
  StepEntityMetadata
> = {
  USER: UserEntityMetadata,
};
```

6. Now you can go into every step converter and add your create entity helper to
   `createIntegrationEntity` assign property and have full autocomplete as the
   following EXAMPLE code:

```diff
export function createUserEntity(name: string): Entity {
  return createIntegrationEntity({
    entityData: {
      source: {},
-     assign: {
+     assign: createUserAssignEntity({
        _key: `${Entities.ACCOUNT._type}|${_integrationInstanceId}`,
        name,
-     },
+     }),
    },
  });
}
```
