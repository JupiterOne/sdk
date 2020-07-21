import createSpinner from 'ora';

import { bulkDownloadToJson } from './bulkDownloadToJson';
import { ExportAssetsParams } from './exportAssets';
import * as log from '../log';

export type ExportAssetsToJsonParams = ExportAssetsParams & { apiKey: string };

export async function exportAssetsToJson({ storageDirectory, includeDeleted, includeEntities, includeRelationships, apiKey }: ExportAssetsToJsonParams) {
  const spinner = createSpinner('Exporting assets to JSON').start();
  try {
    let entityCount = 0;
    let relationshipCount = 0;
    const updateSpinner = () => {
      spinner.text = `Downloaded ${entityCount} entities and ${relationshipCount} relationships...`
    };
    const bulkDownloads: Promise<void>[] = [];

    if (includeEntities) {
      bulkDownloads.push(bulkDownloadToJson({
        storageDirectory,
        assetType: 'entities',
        apiKey,
        includeDeleted,
        progress: count => {
          entityCount = count;
          updateSpinner();
        }
      }));
    }

    if (includeRelationships) {
      bulkDownloads.push(bulkDownloadToJson({
        storageDirectory,
        assetType: 'relationships',
        apiKey,
        includeDeleted,
        progress: count => {
          relationshipCount = count;
          updateSpinner();
        }
      }));
    }

    await Promise.all(bulkDownloads);
    spinner.succeed(`Export Successful, Downloaded ${entityCount} entities and ${relationshipCount} relationships!`);
  } catch (e) {
    const failMessage = 'Failed to export assets to JSON';
    log.error(failMessage);
    spinner.fail(failMessage);
    throw e;
  }
}
