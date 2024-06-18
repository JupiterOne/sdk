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
          allOf: [
            {
              properties: {
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
              },
              type: 'object',
              required: ['_class', '_type'],
            },
            {
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                someNewProperty: {
                  type: 'string',
                },
                thisOneIsNotRequired: {
                  type: 'string',
                },
              },
              type: 'object',
              required: ['id', 'name', 'someNewProperty'],
            },
          ],
          type: 'object',
        },
      ],
    });
  });

  test('createIntegrationEntity entity', () => {
    const [ENTITY] = createEntityMetadata({
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

    expect(ENTITY).toEqual({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      schema: {
        $id: '#entity',
        description: 'Entity description',
        allOf: [
          { $ref: '#Entity' },
          {
            allOf: [
              {
                properties: {
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
                },
                type: 'object',
                required: ['_class', '_type'],
              },
              {
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  someNewProperty: {
                    type: 'string',
                  },
                  thisOneIsNotRequired: {
                    type: 'string',
                  },
                },
                required: ['id', 'name', 'someNewProperty'],
                type: 'object',
              },
            ],
            type: 'object',
          },
        ],
      },
    });
  });

  test.only('yo', () => {
    const [YO, createYo] = createEntityMetadata({
      resourceName: 'Yo',
      _class: ['Device', 'Host'],
      _type: 'yo',
      description: 'Yo description',
      schema: Type.Object({
        id: Type.String(),
        name: Type.String(),
        someNewProperty: Type.String(),
        thisOneIsNotRequired: Type.Optional(Type.String()),
      }),
    });

    createYo({
      id: '1',
      _key: 'id:123',
      // hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      // someNewProperty: 'someNewProperty',
      make: 'here',
      model: 'there',
      deviceId: 'yolo',
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
      // _class: ['Device', 'Host'],
      // _type: 'yo'
    });

    // const validator = new EntityValidator({
    //   schemas: Object.values(entitySchemas),
    // });

    // validator.addSchemas(YO.schema);

    // const { errors } = validator.validateEntity(
    //   createYo({
    //     id: '1',
    //     _key: 'id:123',
    //     serial: '123456',
    //     name: 'entity',
    //   }),
    // );

    // expect(errors).toEqual([
    //   {
    //     dataPath: '',
    //     keyword: 'required',
    //     message: "should have required property 'someNewProperty'",
    //     params: { missingProperty: 'someNewProperty' },
    //     schemaPath: '#/required',
    //   },
    // ]);

    expect(YO).toEqual({
      resourceName: 'Yo',
      _class: ['Device', 'Host'],
      _type: 'yo',
      schema: {
        $id: '#yo',
        description: 'Yo description',
        allOf: [
          { $ref: '#Device' },
          { $ref: '#Host' },
          {
            allOf: [
              {
                properties: {
                  _class: {
                    type: 'array',
                    items: [
                      {
                        const: 'Device',
                        type: 'string',
                      },
                      {
                        const: 'Host',
                        type: 'string',
                      },
                    ],
                    additionalItems: false,
                    maxItems: 2,
                    minItems: 2,
                  },
                  _type: { const: 'yo', type: 'string' },
                },
                type: 'object',
                required: ['_class', '_type'],
              },
              {
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  someNewProperty: {
                    type: 'string',
                  },
                  thisOneIsNotRequired: {
                    type: 'string',
                  },
                },
                required: ['id', 'name', 'someNewProperty'],
                type: 'object',
              },
            ],
            type: 'object',
          },
        ],
      },
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
