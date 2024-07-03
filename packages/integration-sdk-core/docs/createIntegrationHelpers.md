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

- `createEntityType`: A function to generate entity types with the
  `${integrationName}_${entityName}` pattern.
- `createEntityMetadata`: A function to create an entity metadata and a typed
  create entity function.
- `createMultiClassEntityMetadata`: A function to create an entity metadata and
  a typed create entity function for entities with multiple classes.

#### Example

```typescript
import {
  createIntegrationHelpers,
  SchemaType,
} from '@jupiterone/integration-sdk-core';
import { typeboxClassSchemaMap } from '@jupiterone/data-model';

const { createEntityType, createEntityMetadata } = createIntegrationHelpers({
  integrationName: 'my_awesome_integration',
  classSchemaMap: typeboxClassSchemaMap,
});

const [USER_ENTITY, createUserAssignEntity] = createEntityMetadata({
  resourceName: 'User',
  _class: ['User'], // only supports one class
  _type: createEntityType('user'), // This will generate "my_awesome_integration_user", but you are free to not use the createEntityType helper
  description: 'Entity description', // This will be used in the json schema
  schema: SchemaType.Object({
    employeeId: SchemaType.String(),
  }),
});

// _type and _class will be generated automatically
createUserAssignEntity({
  _key: `${Entities.ACCOUNT._type}|${_integrationInstanceId}`,
  employeeId: '12345',
});
```

#### Example for Entities with Multiple Classes

In order to support entities with more than one class, you can use the
`createMultiClassEntityMetadata` function. This function is similar to
`createEntityMetadata`, but it accepts an array of explicit Typebox class
schemas instead of an array of strings:

```typescript
import {
  createIntegrationHelpers,
  SchemaType,
} from '@jupiterone/integration-sdk-core';
import { typeboxClassSchemaMap } from '@jupiterone/data-model';

const {
  createEntityType,
  createMultiClassEntityMetadata, // now importing this function
} = createIntegrationHelpers({
  integrationName: 'some_vendor',
  classSchemaMap: typeboxClassSchemaMap,
});

const [MACHINE_ENTITY, createComputerEntity] = createMultiClassEntityMetadata({
  resourceName: 'Machine',

  // the old way
  // _class: ['Device', 'Host'],

  // now we use the typebox class schemas directly
  _class: [typeboxClassSchemaMap['Device'], typeboxClassSchemaMap['Host']],
  _type: createEntityType('machine'), // some_vendor_machine
  description: 'A computer issued to an employee',
  schema: SchemaType.Object({
    becomesObsoleteOn: SchemaType.Date(),
  }),
});
```

# How to use it in a current graph integration

1. Create a file named helpers.ts in the src folder of your integration
2. Add the following code to the file:

```typescript
import { createIntegrationHelpers } from '@jupiterone/integration-sdk-core';
import { typeboxClassSchemaMap } from '@jupiterone/data-model';

export const { createEntityType, createEntityMetadata } =
  createIntegrationHelpers({
    integrationName: INTEGRATION_NAME, // Should be lowercase (i.e. aws)
    classSchemaMap: typeboxClassSchemaMap,
  });
```

3. Replace INTEGRATION_NAME with the name of your integration
4. Create a file named entities.ts in the src folder of your integration and add
   all entities as the following EXAMPLE code:

```typescript
import { SchemaType } from '@jupiterone/integration-sdk-core';
import { createEntityType, createEntityMetadata } from './helpers';

export const [UserEntityMetadata, createUserAssignEntity] =
  createEntityMetadata({
    resourceName: 'User',
    _class: ['User'],
    _type: createEntityType('user'), // This will generate `${INTEGRATION_NAME}_user`, but you are free to not use the createEntityType helper
    description: 'Entity description', // This will be used in the json schema
    schema: SchemaType.Object({
      name: SchemaType.String(),
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
+ import { createUserAssignEntity } from '../../entities';

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

7. In order for the integration to successfully publish these new entity schemas
   for consumption outside the integraion, the package `platform-sdk-cli` must
   be >= version `12.8.1` in the integration's deployment package.json.

### Notes/Gotchas:

1. To set up nullable fields, you can use
   `SchemaType.Union([SchemaType.String(), SchemaType.Null()])`

2. If a property's type you have added to the new schema is not being respected,
   check to see if it already exists on the \_class. If it does, you will need
   to make sure the type complies with the \_class schema. You will not be able
   to override it on a \_type level.
