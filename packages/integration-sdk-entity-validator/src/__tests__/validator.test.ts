import { AnySchema } from 'ajv';
import { EntityValidator } from '../validator';

const RESOLVED_SCHEMAS_URL =
  'https://raw.githubusercontent.com/JupiterOne/data-model/main/external/resolvedSchemas.json';

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
