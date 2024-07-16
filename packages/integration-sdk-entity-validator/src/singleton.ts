import { entitySchemas } from '@jupiterone/data-model';
import { SchemaObject } from 'ajv';
import { EntityValidator } from './validator';
import { tmpdir } from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const CLASS_SCHEMA_URL =
  'https://api.us.jupiterone.io/data-model/schemas/classes';

type SchemaObjectMap = {
  [entityType: string]: SchemaObject;
};

type SchemaSingleton = {
  validatorInstance: EntityValidator | undefined;
  schemaStore: SchemaObject[];
};

async function fetchSchemas(): Promise<SchemaObjectMap | undefined> {
  try {
    const schemasResponse = await fetch(CLASS_SCHEMA_URL);

    return await schemasResponse.json();
  } catch (err) {
    return undefined;
  }
}

/**
 * NOTE: this method requires `node` to be installed and available in
 * the environment, at v18 and above, which is declared in the package.json.
 *
 * This code should only ever be called in a testing context
 * (local, CI, etc.).
 *
 * The options were to async-ify any relevant Jest tests, or to de-async the
 * fetching of public schemas.
 *
 * The latter was chosen in order to reduce the scope of changes.
 *
 * There are packages in npm that can fetch URLs synchronously, but they all
 * do essentially the same thing that this does (worker_threads, spawn + capture, etc.)
 * and we opted to avoid adding a new dependency for this.
 *
 * Fallbacks will kick in silently if this process fails.
 */
function fetchSchemasSync(): SchemaObjectMap | undefined {
  const tmpFile = path.join(
    tmpdir(),
    (Math.random() + 1).toString(36).substring(4),
  );

  try {
    // write to a temp file to avoid potential unplanned output
    execSync(
      `node -e "fetch('${CLASS_SCHEMA_URL}').then(res => res.json()).then(json => require('fs').writeFileSync('${tmpFile}', JSON.stringify(json)));"`,
    );

    const schemas = JSON.parse(readFileSync(tmpFile, 'utf8'));
    return schemas;
  } catch (err) {
    return undefined;
  } finally {
    try {
      execSync(`rm ${tmpFile}`);
    } catch (err) {
      // ignore
    }
  }
}

let _schemaSingleton: SchemaSingleton = {
  validatorInstance: undefined,
  schemaStore: Object.values(entitySchemas),
};

export function getValidatorSync(
  getSchemasSync: () => SchemaObjectMap | undefined = fetchSchemasSync,
): EntityValidator {
  if (_schemaSingleton.validatorInstance) {
    return _schemaSingleton.validatorInstance;
  }

  const schemas = getSchemasSync() || entitySchemas;

  const schemaStore = Object.values(schemas);
  setSchemaSingleton({
    schemaStore,
    validatorInstance: new EntityValidator({ schemas: schemaStore }),
  });

  return _schemaSingleton.validatorInstance!;
}

export async function getValidator(
  getSchemas: () => Promise<SchemaObjectMap | undefined> = fetchSchemas,
): Promise<EntityValidator> {
  if (_schemaSingleton.validatorInstance) {
    return Promise.resolve(_schemaSingleton.validatorInstance);
  }

  const schemas = (await getSchemas()) || entitySchemas;

  const schemaStore = Object.values(schemas);
  setSchemaSingleton({
    schemaStore,
    validatorInstance: new EntityValidator({ schemas: schemaStore }),
  });

  return _schemaSingleton.validatorInstance!;
}

export const setSchemaSingleton = (singletonValues: SchemaSingleton) => {
  _schemaSingleton = singletonValues;
};

export function getSchema(schemaId: string): SchemaObject | undefined {
  return _schemaSingleton.schemaStore.find((schema) => schema.$id == schemaId);
}
