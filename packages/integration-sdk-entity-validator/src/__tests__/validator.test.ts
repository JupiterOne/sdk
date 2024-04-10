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

  test('Should throw on validate if class and type schemas are not loaded', async () => {
    await expect(
      entityValidator.validateEntity({ _class: ['class'], _type: 'type' }),
    ).rejects.toThrow(Error);
  });

  test('Should validate if entity class schema is loaded', async () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    await expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).resolves.toEqual({
      isValid: true,
      errors: null,
      validationType: 'class',
    });
  });

  test('Should validate if entity type schema is loaded', async () => {
    entityValidator.addSchemas(ENTITY_SCHEMA);
    await expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).resolves.toEqual({
      isValid: true,
      errors: null,
      validationType: 'type',
    });
  });

  test('Should validate with type if both entity type and class schemas are loaded', async () => {
    const graphObjectSchema = classSchemas.find(
      (s) => typeof s === 'object' && s.$id === '#GraphObject',
    );
    entityValidator.addSchemas(graphObjectSchema!);
    entityValidator.addSchemas(ENTITY_SCHEMA);
    await expect(
      entityValidator.validateEntity({
        _class: ['GraphObject'],
        _type: 'type',
        _key: '0123456789',
      }),
    ).resolves.toEqual({
      isValid: true,
      errors: null,
      validationType: 'type',
    });
  });
});
