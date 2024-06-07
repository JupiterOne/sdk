import { Type } from '@sinclair/typebox';
import { typeboxClassSchemaMap } from '@jupiterone/data-model';
import { createIntegrationHelpers } from '../createIntegrationHelpers';
import { EntityValidator } from '@jupiterone/integration-sdk-entity-validator';
import { entitySchemas } from '@jupiterone/data-model';

describe('createIntegrationHelpers', () => {
  const { createEntityType, createEntityMetadata } = createIntegrationHelpers({
    integrationName: 'test',
    classSchemaMap: typeboxClassSchemaMap,
  });

  test('createEntityType', () => {
    expect(createEntityType('entity')).toBe('test_entity');
  });

  test('createIntegrationEntity createEntity', () => {
    const [, createEntity] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: Type.Object({
        id: Type.String(),
        name: Type.String(),
      }),
    });

    expect(
      createEntity({
        id: '1',
        name: 'entity',
        _key: 'id:123456',
        displayName: 'Entity',
      }),
    ).toEqual({
      id: '1',
      name: 'entity',
      _key: 'id:123456',
      displayName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
    });
  });

  test('createIntegrationEntity schema', () => {
    const [{ schema }] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: Type.Object({
        id: Type.String(),
        name: Type.String(),
        someNewProperty: Type.String(),
        thisOneIsNotRequired: Type.Optional(Type.String()),
      }),
    });

    expect(schema).toEqual({
      $id: '#entity',
      description: 'Entity description',
      allOf: [
        { $ref: '#Entity' },
        {
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            _class: {
              type: 'array',
              items: [
                {
                  const: 'Entity',
                  type: 'string',
                },
              ],
              additionalItems: false,
              maxItems: 1,
              minItems: 1,
            },
            _type: { const: 'entity', type: 'string' },
            someNewProperty: {
              type: 'string',
            },
            thisOneIsNotRequired: {
              type: 'string',
            },
          },
          required: ['_class', '_type', 'id', 'name', 'someNewProperty'],
          type: 'object',
        },
      ],
    });
  });

  test('createIntegrationEntity schema should validate createEntity return', () => {
    const validator = new EntityValidator({
      schemas: Object.values(entitySchemas),
    });

    const [{ schema }, createEntity] = createEntityMetadata({
      resourceName: 'Type',
      _class: ['Entity'],
      _type: 'type',
      description: 'Type description',
      schema: Type.Object({
        id: Type.String(),
        name: Type.String(),
        aNewProperty: Type.Number(),
      }),
    });
    validator.addSchemas(schema);

    const { errors } = validator.validateEntity(
      createEntity({
        id: '1',
        name: 'type',
        _key: 'id:123456789',
        displayName: 'Type',
        aNewProperty: 22,
      }),
    );

    expect(errors).toEqual(null);
  });
});
