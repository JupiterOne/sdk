import { Entity } from '@jupiterone/integration-sdk-core';
import {
  toMatchGraphObjectSchema,
  GraphObjectSchema,
  registerMatchers,
} from '../jest';

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
    });
  });
});
