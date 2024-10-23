import { typeboxClassSchemaMap } from '@jupiterone/data-model';
import { createIntegrationHelpers } from '../createIntegrationHelpers';
import { EntityValidator } from '@jupiterone/integration-sdk-entity-validator';
import { entitySchemas } from '@jupiterone/data-model';
import { SchemaType } from '../..';

describe('createIntegrationHelpers', () => {
  const {
    createEntityType,
    createEntityMetadata,
    createMultiClassEntityMetadata,
  } = createIntegrationHelpers({
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
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
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
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
      }),
    });

    expect(schema).toEqual({
      $id: '#entity',
      description: 'Entity description',
      allOf: [
        { $ref: '#Entity' },
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
    });
  });

  test('createIntegrationEntity entity', () => {
    const [ENTITY] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
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
      },
    });
  });

  test('createMultiClassEntityMetadata', () => {
    const [MULTI, createMulti] = createMultiClassEntityMetadata({
      resourceName: 'Multi',
      _type: 'multi',
      _class: [typeboxClassSchemaMap['Device'], typeboxClassSchemaMap['Host']],
      description: 'Multi description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
      }),
    });

    const yoEntity = createMulti({
      id: '1',
      _key: createEntityType('multi'),
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      someNewProperty: 'someNewProperty',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
      ipv4Addresses: null,
      ipv6Addresses: null,
      macAddresses: null,
      publicIpAddresses: null,
      privateIpAddresses: null,
      fqdn: null,
      osName: null,
      osType: 'other',
      osDetails: null,
      osVersion: null,
    });

    // @ts-expect-error lacks someNewProperty
    createMulti({
      id: '1',
      _key: createEntityType('multi'),
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
    });

    // @ts-expect-error has all Entity+Host required properties
    createMulti({
      id: 'id',
      someNewProperty: 'someNewProperty',
      _key: 'test_multi',
      name: 'entity',
      displayName: 'hey',
      hostname: 'yolo',
    });

    // @ts-expect-error has all Entity+Device required properties
    createMulti({
      id: 'id',
      someNewProperty: 'someNewProperty',
      _key: 'test_multi',
      name: 'entity',
      displayName: 'hey',
      serial: '123456',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      category: 'yolo',
      lastSeenOn: 0,
    });

    expect(yoEntity).toEqual({
      id: '1',
      _key: 'test_multi',
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      someNewProperty: 'someNewProperty',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
      _class: ['Device', 'Host'],
      _type: 'multi',
      ipv4Addresses: null,
      ipv6Addresses: null,
      macAddresses: null,
      publicIpAddresses: null,
      privateIpAddresses: null,
      fqdn: null,
      osName: null,
      osType: 'other',
      osDetails: null,
      osVersion: null,
    });

    const validator = new EntityValidator({
      schemas: Object.values(entitySchemas),
    });

    validator.addSchemas(MULTI.schema);

    const { errors } = validator.validateEntity(createMulti({} as any));

    expect(errors).toMatchSnapshot();

    expect(MULTI).toEqual({
      resourceName: 'Multi',
      _class: ['Device', 'Host'],
      _type: 'multi',
      schema: {
        $id: '#multi',
        description: 'Multi description',
        allOf: [
          { $ref: '#Device' },
          { $ref: '#Host' },
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
              _type: { const: 'multi', type: 'string' },
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
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        aNewProperty: SchemaType.Number(),
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
