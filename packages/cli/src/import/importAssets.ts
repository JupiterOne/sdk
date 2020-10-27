import { ImportOptions } from '../commands';
import * as log from '../log';
import { importAssetsFromCsv } from './importAssetsFromCsv';

export type ImportAssetsParams = Omit<ImportOptions, 'dataDir'> & {
  storageDirectory: string;
};

export async function importAssets(options: ImportAssetsParams) {
  log.info(
    `Starting account import from the [${options.storageDirectory}] directory`,
  );
  log.info(`Importing Entities: ${options.includeEntities}`);
  log.info(`Importing Relationships: ${options.includeRelationships}`);

  try {
    await importAssetsFromCsv(options);
  } catch (e) {
    log.error(e);
    throw e;
  }
}
