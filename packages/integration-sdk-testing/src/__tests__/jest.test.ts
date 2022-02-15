import {
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  ExplicitRelationship,
  GraphObjectSchema,
  IntegrationInvocationConfig,
  IntegrationSpecConfig,
  IntegrationStep,
  MappedRelationship,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';
import {
  toMatchGraphObjectSchema,
  toMatchDirectRelationshipSchema,
  toTargetEntities,
  registerMatchers,
  toImplementSpec,
} from '../jest';
import { v4 as uuid } from 'uuid';
import { toMatchStepMetadata } from '..';

describe('#toMatchGraphObjectSchema', () => {
  function generateCollectedEntity(partial?: Partial<Entity>): Entity {
    return {
      name: 'appengine.googleapis.com',
      _class: ['Service'],
      _type: 'google_cloud_api_service',
      _key:
        'google_cloud_api_service_projects/123/services/appengine.googleapis.com',
      displayName: 'App Engine Admin API',
      category: ['infrastructure'],
      description:
        "Provisions and manages developers' App Engine applications.",
      state: 'ENABLED',
      enabled: true,
      usageRequirements: ['serviceusage.googleapis.com/tos/cloud'],
      function: ['other'],
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

  test('should match custom entity schema with single class', () => {
    const result = toMatchGraphObjectSchema(
      generateCollectedEntity({ _class: 'Service' }),
      {
        _class: 'Service',
        schema: generateGraphObjectSchema(),
      },
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });

  test('should require matching `_type` if `_type` is provided', () => {
    const entity = generateCollectedEntity({
      _class: 'Service',
      _type: 'entity-type',
    });

    const result = toMatchGraphObjectSchema(entity, {
      _class: entity._class,
      _type: 'different-entity-type',
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toMatch(`errors=[
  {
    "instancePath": "/_type",
    "schemaPath": "#/properties/_type/const",
    "keyword": "const",
    "params": {
      "allowedValue": "different-entity-type"
    },
    "message": "must be equal to constant"
  }
]`);
  });

  test('should match class schema with no custom schema', () => {
    const result = toMatchGraphObjectSchema(
      generateCollectedEntity({ _class: 'Service' }),
      {
        _class: 'Service',
      },
    );

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

  test('should dedup "required" and "type" properties', () => {
    const googleComputeDisk = {
      id: '6905138577447433802',
      name: 'testvm',
      status: 'READY',
      _class: ['DataStore', 'Disk'],
      _type: 'google_compute_disk',
      _key:
        'https://www.googleapis.com/compute/v1/projects/j1-gc-integration-dev/zones/us-central1-a/disks/testvm',
      displayName: 'testvm',
      createdOn: 1597245605930,
      zone: 'us-central1-a',
      sizeGB: '10',
      active: true,
      sourceImage:
        'https://www.googleapis.com/compute/v1/projects/debian-cloud/global/images/debian-9-stretch-v20200805',
      sourceImageId: '6709658075886210235',
      type: 'pd-standard',
      licenses: [
        'https://www.googleapis.com/compute/v1/projects/debian-cloud/global/licenses/debian-9-stretch',
      ],
      guestOsFeatures: ['VIRTIO_SCSI_MULTIQUEUE'],
      lastAttachTimestamp: 1597245605930,
      labelFingerprint: '42WmSpB8rSM=',
      licenseCodes: ['1000205'],
      physicalBlockSizeBytes: '4096',
      kind: 'compute#disk',
      encrypted: true,
      classification: null,
      _rawData: [
        {
          name: 'default',
          rawData: {
            id: '6905138577447433802',
            creationTimestamp: '2020-08-12T08:20:05.930-07:00',
            name: 'testvm',
            sizeGb: '10',
            zone:
              'https://www.googleapis.com/compute/v1/projects/j1-gc-integration-dev/zones/us-central1-a',
            status: 'READY',
            selfLink:
              'https://www.googleapis.com/compute/v1/projects/j1-gc-integration-dev/zones/us-central1-a/disks/testvm',
            sourceImage:
              'https://www.googleapis.com/compute/v1/projects/debian-cloud/global/images/debian-9-stretch-v20200805',
            sourceImageId: '6709658075886210235',
            type:
              'https://www.googleapis.com/compute/v1/projects/j1-gc-integration-dev/zones/us-central1-a/diskTypes/pd-standard',
            licenses: [
              'https://www.googleapis.com/compute/v1/projects/debian-cloud/global/licenses/debian-9-stretch',
            ],
            guestOsFeatures: [
              {
                type: 'VIRTIO_SCSI_MULTIQUEUE',
              },
            ],
            lastAttachTimestamp: '2020-08-12T08:20:05.930-07:00',
            users: [
              'https://www.googleapis.com/compute/v1/projects/j1-gc-integration-dev/zones/us-central1-a/instances/testvm',
            ],
            labelFingerprint: '42WmSpB8rSM=',
            licenseCodes: ['1000205'],
            physicalBlockSizeBytes: '4096',
            kind: 'compute#disk',
            classification: null,
          },
        },
      ],
    };

    const result = toMatchGraphObjectSchema(googleComputeDisk, {
      _class: ['DataStore', 'Disk'],
      schema: {
        additionalProperties: false,
        properties: {
          _type: { const: 'google_compute_disk' },
          _rawData: {
            type: 'array',
            items: { type: 'object' },
          },
          description: { type: 'string' },
          zone: { type: 'string' },
          sizeGB: { type: 'string' },
          status: { type: 'string' },
          sourceImage: { type: 'string' },
          sourceImageId: { type: 'string' },
          type: { type: 'string' },
          licenses: {
            type: 'array',
            items: { type: 'string' },
          },
          guestOsFeatures: {
            type: 'array',
            items: { type: 'string' },
          },
          lastAttachTimestamp: { type: 'number' },
          labelFingerprint: { type: 'string' },
          licenseCodes: {
            type: 'array',
            items: { type: 'string' },
          },
          physicalBlockSizeBytes: { type: 'string' },
          kind: { type: 'string' },
          encrypted: true,
        },
      },
    });

    expect(result.message()).toEqual('Success!');
    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });
  });

  test('should match array of custom entities using schema', () => {
    const result = toMatchGraphObjectSchema(
      [
        generateCollectedEntity({ _key: uuid() }),
        generateCollectedEntity({ _key: uuid() }),
      ],
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

  test('should fail if entities have non-unique keys', () => {
    const result = toMatchGraphObjectSchema(
      [
        generateCollectedEntity({ _key: 'non-unique-key' }),
        generateCollectedEntity({ _key: 'non-unique-key' }),
      ],
      {
        _class: ['Service'],
        schema: generateGraphObjectSchema(),
      },
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toEqual(
      'Object `_key` properties array is not unique: [non-unique-key,non-unique-key]',
    );
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
          instancePath: '/enabled',
          schemaPath: '#/properties/enabled/type',
          keyword: 'type',
          params: {
            type: 'string',
          },
          message: 'must be string',
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
      )}, errors=${expectedSerialzedErrors}, index=0)

Find out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/main/src/schemas
`,
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
      `Error loading schemas for class (err=Invalid _class passed in schema for "toMatchGraphObjectSchema" (_class=#INVALID_DATA_MODEL_CLASS)

Find out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/main/src/schemas
)`,
    );
  });

  test('should try to merge two enum set properties in array of classes', () => {
    const entity: Entity = {
      _class: ['Host', 'Device'],
      _type: 'user_endpoint',
      _key: 'enum-set-test',
      name: 'test',
      displayName: 'test',
      category: 'endpoint',
      make: 'Apple',
      model: 'MacBookPro14,3',
      serial: 'C0123',
      platform: 'darwin',
      specialProp: 'abc',
    };

    const result = toMatchGraphObjectSchema(entity, {
      _class: ['Host', 'Device'],
      schema: {
        additionalProperties: false,
        properties: {
          _type: { const: 'user_endpoint' },
          specialProp: { type: 'string' },
        },
      },
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });
});

describe('#toMatchDirectRelationshipSchema', () => {
  function generateCollectedDirectRelationship(
    partial?: Partial<ExplicitRelationship>,
  ): ExplicitRelationship {
    return {
      _class: 'HAS',
      _type: 'some_account_has_user',
      _key: 'some-account-has-some-user',
      _toEntityKey: 'to-some-entity',
      _fromEntityKey: 'from-some-entity',
      ...partial,
    };
  }

  test('should pass for valid direct relationship', () => {
    const result = toMatchDirectRelationshipSchema(
      generateCollectedDirectRelationship({
        string: 'abc',
        number: 123,
        boolean: true,
        null: null,
      }),
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });

    expect(result.message()).toEqual('Success!');
  });

  test('should fail for relationship with duplicate keys', () => {
    const result = toMatchDirectRelationshipSchema([
      generateCollectedDirectRelationship({ _key: 'non-unique-key' }),
      generateCollectedDirectRelationship({ _key: 'non-unique-key' }),
    ]);

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toEqual(
      'Object `_key` properties array is not unique: [non-unique-key,non-unique-key]',
    );
  });

  test('should fail for relationship with array property', () => {
    const result = toMatchDirectRelationshipSchema([
      generateCollectedDirectRelationship({
        someAdditionalProperty: ['arrays', 'are', 'invalid'] as any,
      }),
    ]);

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message())
      .toEqual(`Error validating graph object against schema (data={
  "_class": "HAS",
  "_type": "some_account_has_user",
  "_key": "some-account-has-some-user",
  "_toEntityKey": "to-some-entity",
  "_fromEntityKey": "from-some-entity",
  "someAdditionalProperty": [
    "arrays",
    "are",
    "invalid"
  ]
}, errors=[
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/0/type",
    "keyword": "type",
    "params": {
      "type": "boolean"
    },
    "message": "must be boolean"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/1/type",
    "keyword": "type",
    "params": {
      "type": "integer"
    },
    "message": "must be integer"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/2/type",
    "keyword": "type",
    "params": {
      "type": "null"
    },
    "message": "must be null"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/3/type",
    "keyword": "type",
    "params": {
      "type": "number"
    },
    "message": "must be number"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/4/type",
    "keyword": "type",
    "params": {
      "type": "string"
    },
    "message": "must be string"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf",
    "keyword": "anyOf",
    "params": {},
    "message": "must match a schema in anyOf"
  }
], index=0)

Find out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/main/src/schemas
`);
  });

  test('should fail for relationship with object property', () => {
    const result = toMatchDirectRelationshipSchema([
      generateCollectedDirectRelationship({
        someAdditionalProperty: { objects: 'are-invalid' } as any,
      }),
    ]);

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message())
      .toEqual(`Error validating graph object against schema (data={
  "_class": "HAS",
  "_type": "some_account_has_user",
  "_key": "some-account-has-some-user",
  "_toEntityKey": "to-some-entity",
  "_fromEntityKey": "from-some-entity",
  "someAdditionalProperty": {
    "objects": "are-invalid"
  }
}, errors=[
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/0/type",
    "keyword": "type",
    "params": {
      "type": "boolean"
    },
    "message": "must be boolean"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/1/type",
    "keyword": "type",
    "params": {
      "type": "integer"
    },
    "message": "must be integer"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/2/type",
    "keyword": "type",
    "params": {
      "type": "null"
    },
    "message": "must be null"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/3/type",
    "keyword": "type",
    "params": {
      "type": "number"
    },
    "message": "must be number"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf/4/type",
    "keyword": "type",
    "params": {
      "type": "string"
    },
    "message": "must be string"
  },
  {
    "instancePath": "/someAdditionalProperty",
    "schemaPath": "#/additionalProperties/anyOf",
    "keyword": "anyOf",
    "params": {},
    "message": "must match a schema in anyOf"
  }
], index=0)

Find out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/main/src/schemas
`);
  });

  test('should require matching `_type` if `_type` is provided', () => {
    const relationship = generateCollectedDirectRelationship({
      string: 'abc',
      number: 123,
      boolean: true,
      null: null,
      _type: 'relationship-type',
    });

    const result = toMatchDirectRelationshipSchema(relationship, {
      _type: 'different-relationship-type',
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toMatch(`errors=[
  {
    "instancePath": "/_type",
    "schemaPath": "#/properties/_type/const",
    "keyword": "const",
    "params": {
      "allowedValue": "different-relationship-type"
    },
    "message": "must be equal to constant"
  }
]`);
  });

  test('should require matching `_class` if `_class` is provided', () => {
    const relationship = generateCollectedDirectRelationship({
      string: 'abc',
      number: 123,
      boolean: true,
      null: null,
      _class: RelationshipClass.HAS,
    });

    const result = toMatchDirectRelationshipSchema(relationship, {
      _class: RelationshipClass.IS,
    });

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });

    expect(result.message()).toMatch(`errors=[
  {
    "instancePath": "/_class",
    "schemaPath": "#/properties/_class/const",
    "keyword": "const",
    "params": {
      "allowedValue": "IS"
    },
    "message": "must be equal to constant"
  }
]`);
  });
});

describe('#toTargetEntities', () => {
  test('should pass if mapped relationship targets any entities', () => {
    const targetEntityKey = uuid();
    const targetEntityType = 'entity-type';
    const result = toTargetEntities(
      [
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          source: {
            _class: 'Entity',
            _key: uuid(),
            _type: '',
          },
          target: {
            _type: targetEntityType,
            _key: targetEntityKey,
          },
        }),
      ],
      [
        createIntegrationEntity({
          entityData: {
            source: {},
            assign: {
              _class: 'Entity',
              _type: targetEntityType,
              _key: targetEntityKey,
            },
          },
        }),
      ],
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });
  });

  test('should pass if mapped relationship targets multiple entities', () => {
    const targetEntityKey = uuid();
    const targetEntityType = 'entity-type';

    const targetEntity = createIntegrationEntity({
      entityData: {
        source: {},
        assign: {
          _class: 'Entity',
          _type: targetEntityType,
          _key: targetEntityKey,
        },
      },
    });
    const result = toTargetEntities(
      [
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          source: {
            _class: 'Entity',
            _key: uuid(),
            _type: '',
          },
          target: {
            _type: targetEntityType,
            _key: targetEntityKey,
          },
        }),
      ],
      [targetEntity, targetEntity],
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });
  });

  test('should fail if mapped relationship targets more than one entity and enforceSingleTarget = true', () => {
    const targetEntityKey = uuid();
    const targetEntityType = 'entity-type';

    const targetEntity = createIntegrationEntity({
      entityData: {
        source: {},
        assign: {
          _class: 'Entity',
          _type: targetEntityType,
          _key: targetEntityKey,
        },
      },
    });
    const result = toTargetEntities(
      [
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          source: {
            _class: 'Entity',
            _key: uuid(),
            _type: '',
          },
          target: {
            _type: targetEntityType,
            _key: targetEntityKey,
          },
        }),
      ],
      [targetEntity, targetEntity],
      { enforceSingleTarget: true },
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });
    expect(result.message()).toMatch(
      'Multiple target entities found for mapped relationship, expected exactly one: {',
    );
  });

  test('should fail if mapped relationship targets unknown entities', () => {
    const targetEntityType = 'entity-type';
    const result = toTargetEntities(
      [
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          source: {
            _class: 'Entity',
            _key: uuid(),
            _type: '',
          },
          target: {
            _type: targetEntityType,
            _key: uuid(),
          },
        }),
      ],
      [
        createIntegrationEntity({
          entityData: {
            source: {},
            assign: {
              _class: 'Entity',
              _type: targetEntityType,
              _key: uuid(),
            },
          },
        }),
      ],
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });
    expect(result.message()).toMatch(
      'No target entity found for mapped relationship: {',
    );
  });
});

describe('#toImplementSpec', () => {
  const executionHandler = () => {
    undefined;
  };

  test('should pass if integration matches implemented spec', () => {
    const implementation: IntegrationInvocationConfig = {
      integrationSteps: [
        {
          id: 'step-1',
          name: 'Step 1',
          entities: [
            {
              resourceName: 'resource-1',
              _type: 'resource_1',
              _class: 'Record',
            },
          ],
          relationships: [],
          dependsOn: [],
          executionHandler,
        },
        {
          id: 'step-2',
          name: 'Step 2',
          entities: [
            {
              resourceName: 'resource-2',
              _type: 'resource_2',
              _class: 'Record',
            },
          ],
          relationships: [
            {
              _type: 'resource_1_has_resource_2',
              sourceType: 'resource_1',
              _class: RelationshipClass.HAS,
              targetType: 'resource_2',
            },
          ],
          dependsOn: ['step-1'],
          executionHandler,
        },
      ],
    };

    const spec: IntegrationSpecConfig = {
      integrationSteps: [
        {
          id: 'step-1',
          name: 'Step 1',
          entities: [
            {
              resourceName: 'resource-1',
              _type: 'resource_1',
              _class: 'Record',
            },
          ],
          relationships: [],
          dependsOn: [],
          implemented: true,
        },
        {
          id: 'step-2',
          name: 'Step 2',
          entities: [
            {
              resourceName: 'RESOURCE-3',
              _type: 'resource_3',
              _class: 'Record',
            },
          ],
          relationships: [
            {
              _type: 'resource_1_has_resource_3',
              sourceType: 'resource_1',
              _class: RelationshipClass.HAS,
              targetType: 'resource_3',
            },
          ],
          dependsOn: ['step-1'],
          implemented: false,
        },
      ],
    };
    const result = toImplementSpec(implementation, spec);

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });
  });

  test('should fail if integration does not match implemented spec', () => {
    const implementation: IntegrationInvocationConfig = {
      integrationSteps: [
        {
          id: 'step-1',
          name: 'Step 1',
          entities: [
            {
              resourceName: 'resource-1',
              _type: 'resource_1',
              _class: 'Record',
            },
          ],
          relationships: [],
          dependsOn: [],
          executionHandler,
        },
        {
          id: 'step-2',
          name: 'Step 2',
          entities: [
            {
              resourceName: 'resource-2',
              _type: 'resource_2',
              _class: 'Record',
            },
          ],
          relationships: [
            {
              _type: 'resource_1_has_resource_2',
              sourceType: 'resource_1',
              _class: RelationshipClass.HAS,
              targetType: 'resource_2',
            },
          ],
          dependsOn: ['step-1'],
          executionHandler,
        },
      ],
    };

    const spec: IntegrationSpecConfig = {
      integrationSteps: [
        {
          id: 'step-1',
          name: 'Step 1',
          entities: [
            {
              resourceName: 'resource-1',
              _type: 'resource_1',
              _class: 'Record',
            },
          ],
          relationships: [],
          dependsOn: [],
          implemented: true,
        },
        {
          id: 'step-2',
          name: 'Step 2',
          entities: [
            {
              resourceName: 'RESOURCE-3',
              _type: 'resource_3',
              _class: 'Record',
            },
          ],
          relationships: [
            {
              _type: 'resource_1_has_resource_3',
              sourceType: 'resource_1',
              _class: RelationshipClass.HAS,
              targetType: 'resource_3',
            },
          ],
          dependsOn: ['step-1'],
          implemented: true,
        },
      ],
    };
    const result = toImplementSpec(implementation, spec);

    expect(result).toEqual({
      message: expect.any(Function),
      pass: false,
    });
  });
});

describe('#toMatchStepMetadata', () => {
  function getMockInvocationConfig(
    config?: Partial<IntegrationInvocationConfig>,
  ): IntegrationInvocationConfig {
    return {
      integrationSteps: [],
      ...config,
    };
  }

  function getMockIntegrationStep(
    config?: Partial<IntegrationStep>,
  ): IntegrationStep {
    return {
      id: 'id',
      name: 'name',
      entities: [],
      relationships: [],
      executionHandler: () => undefined,
      ...config,
    };
  }

  test('should pass with no declared entities or relationships', () => {
    const result = toMatchStepMetadata(
      { collectedEntities: [], collectedRelationships: [] },
      {
        stepId: 'step-id',
        invocationConfig: getMockInvocationConfig({
          integrationSteps: [
            getMockIntegrationStep({
              id: 'step-id',
              entities: [],
              relationships: [],
            }),
          ],
        }),
      },
    );

    expect(result).toEqual({
      message: expect.any(Function),
      pass: true,
    });
  });

  test('should throw if stepId is not present in invocation config', () => {
    expect(() =>
      toMatchStepMetadata(
        { collectedEntities: [], collectedRelationships: [] },
        {
          stepId: 'missing-step-id',
          invocationConfig: getMockInvocationConfig(),
        },
      ),
    ).toThrow('Node does not exist: missing-step-id');
  });

  describe.only('entities', () => {
    function getMockEntity(e?: Partial<Entity>): Entity {
      return {
        _class: 'Record',
        _type: 'entity-type',
        _key: uuid(),
        name: '',
        displayName: '',
        ...e,
      };
    }

    test('should pass if encountered entity type has been declared', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [
            getMockEntity({ _type: 'declared-type', _class: 'Record' }),
          ],
          collectedRelationships: [],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                entities: [
                  {
                    resourceName: '',
                    _class: 'Record',
                    _type: 'declared-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: true });
    });

    test('should fail if declared entity type has not been encountered', () => {
      const result = toMatchStepMetadata(
        { collectedEntities: [], collectedRelationships: [] },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                entities: [
                  {
                    resourceName: '',
                    _class: 'Record',
                    _type: 'declared-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toBe(
        'Expected >0 entities of _type=declared-type, got 0.',
      );
    });

    test('should fail if undeclared entity type has been encountered', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [getMockEntity({ _type: 'undeclared-type' })],
          collectedRelationships: [],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                entities: [],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toBe(
        'Expected 0 additional entities, got 1. (declaredTypes=, encounteredTypes=undeclared-type)',
      );
    });

    test('should fail if declared entity type does not match schema', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [
            getMockEntity({ _type: 'declared-type', _class: 'Record' }),
          ],
          collectedRelationships: [],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                entities: [
                  {
                    resourceName: '',
                    _class: 'Entity',
                    _type: 'declared-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toMatch(
        'Error validating graph object against schema',
      );
    });
  });

  describe.only('relationships', () => {
    function getMockRelationship(r?: Partial<Relationship>): Relationship {
      return {
        _class: RelationshipClass.HAS,
        _type: 'relationship-type',
        _key: uuid(),
        _fromEntityKey: uuid(),
        _toEntityKey: uuid(),
        ...r,
      };
    }

    test('should pass if encountered relationship type has been declared', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [],
          collectedRelationships: [
            getMockRelationship({
              _type: 'declared-type',
              _class: RelationshipClass.HAS,
            }),
          ],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                relationships: [
                  {
                    _type: 'declared-type',
                    _class: RelationshipClass.HAS,
                    sourceType: 'source-entity-type',
                    targetType: 'target-entity-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: true });
    });

    test('should fail if declared relationship type has not been encountered', () => {
      const result = toMatchStepMetadata(
        { collectedEntities: [], collectedRelationships: [] },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                relationships: [
                  {
                    _type: 'declared-type',
                    _class: RelationshipClass.HAS,
                    sourceType: 'source-entity-type',
                    targetType: 'target-entity-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toBe(
        'Expected >0 relationships of _type=declared-type, got 0.',
      );
    });

    test('should fail if undeclared relationship type has been encountered', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [],
          collectedRelationships: [
            getMockRelationship({ _type: 'undeclared-type' }),
          ],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                relationships: [],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toBe(
        'Expected 0 additional relationships, got 1. (declaredTypes=, encounteredTypes=undeclared-type)',
      );
    });

    test('should fail if declared relationship type does not match schema', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [],
          collectedRelationships: [
            getMockRelationship({
              _type: 'declared-type',
              _class: RelationshipClass.IS,
            }),
          ],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
                relationships: [
                  {
                    _type: 'declared-type',
                    _class: RelationshipClass.HAS,
                    sourceType: 'source-entity-type',
                    targetType: 'target-entity-type',
                  },
                ],
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toMatch(
        'Error validating graph object against schema',
      );
    });
  });

  describe('mappedRelationships', () => {
    function getMockMappedRelationship(
      mr?: Partial<MappedRelationship>,
    ): MappedRelationship {
      return {
        _class: RelationshipClass.HAS,
        _type: 'mapped-relationship-type',
        _key: uuid(),
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: uuid(),
          targetFilterKeys: [['_key']],
          targetEntity: {},
        },
        ...mr,
      };
    }

    test('should throw if step.mappedRelationships exists', () => {
      expect(() =>
        toMatchStepMetadata(
          { collectedEntities: [], collectedRelationships: [] },
          {
            stepId: 'step-id',
            invocationConfig: getMockInvocationConfig({
              integrationSteps: [
                getMockIntegrationStep({
                  id: 'step-id',
                  mappedRelationships: [
                    {
                      _class: RelationshipClass.IS,
                      _type: 'type',
                      sourceType: 'source-type',
                      targetType: 'target-type',
                      direction: RelationshipDirection.FORWARD,
                    },
                  ],
                }),
              ],
            }),
          },
        ),
      ).toThrow('toMatchStepMetadata does not support mapped relationships.');
    });

    test('should fail if collectedRelationships contains mapped relationships', () => {
      const result = toMatchStepMetadata(
        {
          collectedEntities: [],
          collectedRelationships: [
            getMockMappedRelationship({ _type: 'undeclared-type' }),
          ],
        },
        {
          stepId: 'step-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-id',
              }),
            ],
          }),
        },
      );

      expect(result).toMatchObject({ pass: false });
      expect(result.message()).toBe(
        'Expected 0 mapped relationships, got 1. (declaredTypes=undefined, encounteredTypes=undeclared-type',
      );
    });
  });
});

describe('#registerMatchers', () => {
  test('should register all test matchers', () => {
    const mockJestExtendFn = jest.fn();
    const mockExpect = ({
      extend: mockJestExtendFn,
    } as unknown) as jest.Expect;

    registerMatchers(mockExpect);

    expect(mockJestExtendFn).toHaveBeenCalledTimes(1);
    expect(mockJestExtendFn).toHaveBeenCalledWith({
      toMatchGraphObjectSchema,
      toMatchDirectRelationshipSchema,
      toTargetEntities,
      toImplementSpec,
    });
  });
});
