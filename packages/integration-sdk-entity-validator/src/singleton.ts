import { entitySchemas } from '@jupiterone/data-model';
import { SchemaObject } from 'ajv';
import { EntityValidator } from './validator';
import { tmpdir } from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';

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
const HOUR_IN_MS = 1000 * 60 * 60;
function fetchSchemasSync(): SchemaObjectMap | undefined {
  // round to the last hour checkpoint
  const cachedTimestamp = Math.floor(Date.now() / HOUR_IN_MS) * HOUR_IN_MS;

  const cachedFile = path.join(
    tmpdir(),
    `j1-class-schemas-${cachedTimestamp}.json`,
  );

  if (existsSync(cachedFile)) {
    try {
      return JSON.parse(readFileSync(cachedFile, 'utf8'));
    } catch (err) {
      try {
        rmSync(cachedFile);
      } catch (err) {
        // ignore
      }
      // ignore
    }
  }

  try {
    // write to a temp file to avoid potential unplanned output
    // we parse the json and re-stringify it to ensure it's valid json
    execSync(
      `node -e "fetch('${CLASS_SCHEMA_URL}').then(res => res.json()).then(json => require('fs').writeFileSync('${cachedFile}', JSON.stringify(json)));"`,
    );

    return JSON.parse(readFileSync(cachedFile, 'utf8'));
  } catch (err) {
    return undefined;
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
