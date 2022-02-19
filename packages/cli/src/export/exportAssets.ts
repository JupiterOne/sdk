import { ExportOptions } from '../commands';
import * as log from '../log';
import { deleteDirectory } from '../fileSystem';
import { exportAssetsToJson } from './exportAssetsToJson';
import { exportJsonAssetsToCsv } from './exportJsonAssetsToCsv';

export type ExportAssetsParams = Omit<ExportOptions, 'dataDir'> & {
  storageDirectory: string;
};

export default async function exportAssets(options: ExportAssetsParams) {
  log.info(
    `Starting account export to the [${options.storageDirectory}] directory`,
  );
  log.info(`Exporting Entities: ${options.includeEntities}`);
  log.info(`Exporting Relationships: ${options.includeRelationships}`);
  log.info(`Include Deleted Assets: ${options.includeDeleted}`);

  try {
    await deleteDirectory(options.storageDirectory);
    await exportAssetsToJson(options);
    await exportJsonAssetsToCsv(options);
  } catch (e) {
    log.error(e);
    throw e;
  }
}
