import { AnySchema } from 'ajv';
import { EntityValidator } from '../validator';

const RESOLVED_SCHEMAS_URL =
  'https://api.us.jupiterone.io/data-model/schemas/classes';

const ENTITY_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: '#type',
  type: 'object',
  propertyNames: { pattern: '^(_|tag\\.)?[A-Za-z0-9. -]+$' },
  properties: {
    _key: {
      description:
        'An identifier unique within the scope containing the object. For example, for a Bitbucket repo, this will be the GUID of the repo as assigned by Bitbucket. For an IAM Role, this will be the ARN of the role.',
      type: 'string',
      minLength: 10,
    },
    _class: {
      description:
        "One or more classes conforming to a standard, abstract security data model. For example, an EC2 instance will have '_class':'Host'.",
      oneOf: [
        { type: 'string', minLength: 2 },
        {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 2 },
        },
      ],
    },
    _type: {
      description:
        "The type of object, typically reflecting the vendor and resource type. For example, 'aws_iam_user'. In some cases, a system knows about a type of entity that other systems know about, such as 'user_endpoint' or 'cve'.",
      type: 'string',
      minLength: 3,
    },
    ip: {
      description: 'An IPv4 or IPv6 address',
      type: 'string',
      format: 'ip',
    },
    ipCidr: {
      description: 'An IPv4 or IPv6 CIDR',
      type: 'string',
      format: 'ipCidr',
    },
  },
  patternProperties: {
    '^tag\\.': {
      description:
        "Named tags assigned to the entity (i.e., 'tag.Name', 'tag.OtherName')",
      anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
    },
  },
  required: ['_key', '_class', '_type'],
};

describe('validator', () => {
  let entityValidator: EntityValidator;
  let classSchemas: AnySchema[] = [];

  beforeAll(async () => {
    classSchemas = await fetch(RESOLVED_SCHEMAS_URL)
      .then((response) => response.json())
      .then((data) => Object.values(data));
  });

  beforeEach(() => {
    entityValidator = new EntityValidator({});
  });

  test('should skip class and type validation if class and type schemas are not loaded', () => {
    expect(
      entityValidator.validateEntity({ _class: ['class'], _type: 'type' }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#type',
          reason: 'not-found',
          type: 'type',
        },
        {
          schemaId: '#class',
          reason: 'not-found',
          type: 'class',
        },
      ],
    });
  });

  test('should validate if entity class schema is loaded', () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#type',
          reason: 'not-found',
          type: 'type',
        },
      ],
    });
  });

  test('should validate with error if entity class schema is loaded and missing key', () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
      }),
    ).toEqual({
      isValid: false,
      errors: [
        {
          schemaId: '#GraphObject',
          validation: 'required',
          message: "must have required property '_key'",
          property: '_key',
        },
      ],
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#type',
          reason: 'not-found',
          type: 'type',
        },
      ],
    });
  });

  test('should validate if entity type schema is loaded', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate with type if both entity type and class schemas are loaded', () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate both type and class if schemas are loaded and forceClassValidationWithValidatedType config is set', () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity(
        {
          _class: ['GraphObject'],
          _type: 'type',
          _key: '0123456789',
        },
        { forceClassValidationWithValidatedType: true },
      ),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: null,
    });
  });

  test('should validate with error if _key is missing', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
      }),
    ).toEqual({
      isValid: false,
      errors: [
        {
          schemaId: '#type',
          validation: 'required',
          message: "must have required property '_key'",
          property: '_key',
        },
      ],
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate with error if _key length is invalid', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123',
      }),
    ).toEqual({
      isValid: false,
      errors: [
        {
          schemaId: '#type',
          validation: 'minLength',
          message: 'must NOT have fewer than 10 characters',
          property: '_key',
        },
      ],
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate IPV4 using ip format', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
        ip: '10.10.10.10',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate IPV6 using ip format', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
        ip: 'FE80:0000:0000:0000:0202:B3FF:FE1E:8329',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should validate IPV4 CIDR using ipCidr format', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
        ipCidr: '10.10.10.10/32',
      }),
    ).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });

  test('should not validate IPV4 CIDR using ip format', () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
        ip: '10.10.10.10/32',
      }),
    ).toEqual({
      isValid: false,
      errors: [
        {
          schemaId: '#type',
          property: 'ip',
          message: 'must match format "ip"',
          validation: 'format',
        },
      ],
      warnings: null,
      skippedSchemas: [
        {
          schemaId: '#GraphObject',
          reason: 'type-already-validated',
          type: 'class',
        },
      ],
    });
  });
});

describe('validator — permissive enum properties', () => {
  // In-memory NHI-shaped schema. The shape mirrors the data-model's NHI class
  // additions in M001/S02: `_nhiType`, `_nhiOwnerStatus`, `_aiConfidence` are
  // enum-constrained; `_isAi` is a bare boolean (type, not enum).
  const NHI_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: '#NHI',
    type: 'object',
    properties: {
      _key: { type: 'string', minLength: 10 },
      _class: {
        oneOf: [
          { type: 'string', minLength: 2 },
          {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 2 },
          },
        ],
      },
      _type: { type: 'string', minLength: 3 },
      _nhiType: {
        type: 'string',
        enum: ['service_account', 'api_key', 'workload_identity'],
      },
      _nhiOwnerStatus: {
        type: 'string',
        enum: ['active', 'inactive', 'orphaned'],
      },
      _aiConfidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      _isAi: { type: 'boolean' },
    },
    required: ['_key', '_class', '_type'],
  };

  const validNhiEntity = {
    _class: ['NHI'],
    _type: 'NHI',
    _key: '0123456789',
    _nhiType: 'service_account',
    _nhiOwnerStatus: 'active',
    _aiConfidence: 'high',
    _isAi: true,
  };

  test('valid NHI entity produces no errors and no warnings', () => {
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    expect(validator.validateEntity(validNhiEntity)).toEqual({
      isValid: true,
      errors: null,
      warnings: null,
      skippedSchemas: [
        { schemaId: '#NHI', reason: 'type-already-validated', type: 'class' },
      ],
    });
  });

  test('unknown _nhiType becomes a warning, not an error', () => {
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _nhiType: 'unknown_subtype',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
    expect(result.warnings).toEqual([
      {
        schemaId: '#NHI',
        property: '_nhiType',
        message: expect.stringContaining('must be equal to one of'),
        validation: 'enum',
      },
    ]);
  });

  test('unknown _nhiOwnerStatus becomes a warning', () => {
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _nhiOwnerStatus: 'mystery',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0].property).toBe('_nhiOwnerStatus');
    expect(result.warnings![0].validation).toBe('enum');
  });

  test('unknown _aiConfidence becomes a warning', () => {
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _aiConfidence: 'extremely high',
    });
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0].property).toBe('_aiConfidence');
  });

  test('type mismatch on a permissive property still hard-errors', () => {
    // _isAi: 'yes' is a string where boolean is required. The property is not
    // in the permissive set anyway, but the point is: keyword === 'type' is
    // not 'enum', so even a permissive property would still hard-fail here.
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _isAi: 'yes',
    });
    expect(result.isValid).toBe(false);
    expect(result.warnings).toBeNull();
    expect(result.errors).toEqual([
      {
        schemaId: '#NHI',
        property: '_isAi',
        message: expect.stringContaining('must be boolean'),
        validation: 'type',
      },
    ]);
  });

  test('type mismatch on a permissive enum property is still an error', () => {
    // _nhiType is in the permissive set, but a number-shaped value triggers
    // keyword === 'type' (not 'enum'), so it must hard-error.
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _nhiType: 42,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      {
        schemaId: '#NHI',
        property: '_nhiType',
        message: expect.stringContaining('must be string'),
        validation: 'type',
      },
    ]);
  });

  test('mixed: permissive enum violation + missing _key produces both warnings and errors', () => {
    const validator = new EntityValidator({ schemas: [NHI_SCHEMA] });
    const { _key, ...entityWithoutKey } = validNhiEntity;
    const result = validator.validateEntity({
      ...entityWithoutKey,
      _nhiType: 'unknown_subtype',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      {
        schemaId: '#NHI',
        property: '_key',
        message: "must have required property '_key'",
        validation: 'required',
      },
    ]);
    expect(result.warnings).toEqual([
      {
        schemaId: '#NHI',
        property: '_nhiType',
        message: expect.stringContaining('must be equal to one of'),
        validation: 'enum',
      },
    ]);
  });

  test('permissiveEnumProperties: [] makes enum violations hard-error again', () => {
    const validator = new EntityValidator({
      schemas: [NHI_SCHEMA],
      permissiveEnumProperties: [],
    });
    const result = validator.validateEntity({
      ...validNhiEntity,
      _nhiType: 'unknown_subtype',
    });
    expect(result.isValid).toBe(false);
    expect(result.warnings).toBeNull();
    expect(result.errors).toEqual([
      {
        schemaId: '#NHI',
        property: '_nhiType',
        message: expect.stringContaining('must be equal to one of'),
        validation: 'enum',
      },
    ]);
  });

  test('permissiveEnumProperties can be extended with additional properties', () => {
    const validator = new EntityValidator({
      schemas: [NHI_SCHEMA],
      permissiveEnumProperties: ['_nhiType', '_aiConfidence', '_customField'],
    });
    // _nhiOwnerStatus is no longer permissive in this configuration.
    const result = validator.validateEntity({
      ...validNhiEntity,
      _nhiOwnerStatus: 'mystery',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].property).toBe('_nhiOwnerStatus');
    expect(result.errors![0].validation).toBe('enum');
  });
});
