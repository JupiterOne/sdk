import { Entity } from '@jupiterone/integration-sdk-core';
import { toMatchGraphObjectSchema, GraphObjectSchema } from '../jest';

function generateCollectedEntity(partial?: Partial<Entity>): Entity {
  return {
    name: 'appengine.googleapis.com',
    _class: ['Service'],
    _type: 'google_cloud_api_service',
    _key:
      'google_cloud_api_service_projects/123/services/appengine.googleapis.com',
    displayName: 'App Engine Admin API',
    category: ['infrastructure'],
    description: "Provisions and manages developers' App Engine applications.",
    state: 'ENABLED',
    enabled: true,
    usageRequirements: ['serviceusage.googleapis.com/tos/cloud'],
    _rawData: [
      {
        name: 'default',
        rawData: {
          name: 'projects/123/services/appengine.googleapis.com',
          config: {
            name: 'appengine.googleapis.com',
            title: 'App Engine Admin API',
            documentation: {
              summary:
                "Provisions and manages developers' App Engine applications.",
            },
            quota: {},
            authentication: {},
            usage: {
              requirements: ['serviceusage.googleapis.com/tos/cloud'],
            },
          },
          state: 'ENABLED',
          parent: 'projects/123',
        },
      },
    ],
    ...partial,
  };
}

function generateGraphObjectSchema(
  partialProperties?: Record<string, any>,
): GraphObjectSchema {
  return {
    additionalProperties: false,
    properties: {
      _type: { const: 'google_cloud_api_service' },
      category: { const: ['infrastructure'] },
      state: {
        type: 'string',
        enum: ['STATE_UNSPECIFIED', 'DISABLED', 'ENABLED'],
      },
      enabled: { type: 'boolean' },
      usageRequirements: {
        type: 'array',
        items: { type: 'string' },
      },
      _rawData: {
        type: 'array',
        items: { type: 'object' },
      },
      ...partialProperties,
    },
  };
}

describe('#toMatchGraphObjectSchema', () => {
  test('should match custom entity schema with single class', () => {
    const result = toMatchGraphObjectSchema(generateCollectedEntity(), {
      _class: 'Service',
      schema: generateGraphObjectSchema(),
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });

  test('should match custom entity schema with array of classes', () => {
    const result = toMatchGraphObjectSchema(generateCollectedEntity(), {
      _class: ['Service'],
      schema: generateGraphObjectSchema(),
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });

  test('should match array of custom entities using schema', () => {
    const result = toMatchGraphObjectSchema(
      [generateCollectedEntity(), generateCollectedEntity()],
      {
        _class: ['Service'],
        schema: generateGraphObjectSchema(),
      },
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });

  test('should not pass if entity does not match schema', () => {
    const data = generateCollectedEntity();
    const result = toMatchGraphObjectSchema(data, {
      _class: ['Service'],
      schema: generateGraphObjectSchema({
        enabled: { type: 'string' },
      }),
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    const expectedSerialzedErrors = JSON.stringify(
      [
        {
          keyword: 'type',
          dataPath: '.enabled',
          schemaPath: '#/properties/enabled/type',
          params: {
            type: 'string',
          },
          message: 'should be string',
        },
      ],
      null,
      2,
    );

    expect(result.message()).toEqual(
      `Error validating graph object against schema (data=${JSON.stringify(
        data,
        null,
        2,
      )}, errors=${expectedSerialzedErrors}, index=0)`,
    );
  });

  test('should not pass if using an unknown class', () => {
    const data = generateCollectedEntity();
    const result = toMatchGraphObjectSchema(data, {
      _class: ['INVALID_DATA_MODEL_CLASS'],
      schema: generateGraphObjectSchema(),
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toEqual(
      `Error loading schemas for class (err=Invalid _class passed in schema for "toMatchGraphObjectSchema" (_class=#INVALID_DATA_MODEL_CLASS))`,
    );
  });
});
