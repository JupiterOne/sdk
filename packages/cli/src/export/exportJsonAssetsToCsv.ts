import createSpinner from 'ora';

import _ from 'lodash';
import path from 'path';

import { ExportAssetsParams as ExportAssetParams } from "./exportAssets";
import { getJsonAssetsDirectory, getCsvAssetsDirectory, } from "../fileSystem";
import { groupJsonAssetsByType } from './groupJsonAssetsByType';
import * as log from '../log';
import { writeAssetsToCsv } from './writeAssetsToCsv';

type ExportAssetTypeParams = ExportJsonAssetParams & { type: 'entities' | 'relationships' };

export async function exportJsonAssetTypeToCsv(options: ExportAssetTypeParams) {
  const jsonAssetsDirectory = getJsonAssetsDirectory(options.storageDirectory);
  const groupedAssetFiles = await groupJsonAssetsByType({ assetDirectory: `${jsonAssetsDirectory}/${options.type}` });

  const directory = path.join(getCsvAssetsDirectory(options.storageDirectory), options.type);
  await writeAssetsToCsv({ groupedAssetFiles, directory });
}

type ExportJsonAssetParams = Omit<ExportAssetParams, 'includeDeleted'>;

export async function exportJsonAssetsToCsv(options: ExportJsonAssetParams) {
  const spinner = createSpinner('Exporting JSON Assets to CSV').start();

  try {
    const exports: Promise<void>[] = [];

    if (options.includeEntities) {
      exports.push(exportJsonAssetTypeToCsv({
        ...options,
        type: 'entities'
      }));
    }

    if (options.includeRelationships) {
      exports.push(exportJsonAssetTypeToCsv({
        ...options,
        type: 'relationships'
      }));
    }

    await Promise.all(exports);

    spinner.succeed('Export successful, converted JSON assets to CSV');
  } catch (e) {
    const failMessage = 'Failed to export JSON assets to CSV';
    log.error(failMessage);
    spinner.fail(failMessage);
    throw e;
  }
}
