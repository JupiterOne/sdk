import globby from 'globby';
import upath from 'upath';
import createSpinner from 'ora';
import { AxiosInstance } from 'axios';
import path from 'path';
import pMap from 'p-map';
import { retry } from '@lifeomic/attempt';

import * as log from '../log';
import { ImportAssetsParams } from './importAssets';
import { readFileFromPath, getCsvAssetsDirectory } from '../fileSystem';
import { createApiClientWithApiKey, getApiBaseUrl } from '@jupiterone/integration-sdk-runtime';
import { sanitizeContent } from '../export/util';
import { pause } from '../pause';

export type ImportAssetsFromCsvParams = ImportAssetsParams & { apiKey: string };

const J1_ENDPOINT = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });

async function waitForSyncCompletion({ jobId, apiClient, progress }) {
  let status;
  do {
    const { data: { job: jobStatus } } = await apiClient.get(`/persister/synchronization/jobs/${jobId}`);

    progress(jobStatus);
    status = jobStatus.status;
    await pause(5000);
  } while (status !== 'FINISHED')
}

interface ImportAssetsTypeParams {
  storageDirectory: string;
  apiClient: AxiosInstance;
  jobId: string;
  assetType: 'entities' | 'relationships';
  progress: (currentFile: string) => void;
}

async function importAssetTypeFromCsv({ storageDirectory, apiClient, jobId, assetType, progress }: ImportAssetsTypeParams) {
  const csvDir = getCsvAssetsDirectory(storageDirectory);
  const assetFiles = await globby(upath.toUnix(`${csvDir}/${assetType}/bulk_upload_relationship/**/*.csv`));

  await pMap(assetFiles, async assetFile => {

    const assets = sanitizeContent(await readFileFromPath(assetFile));
    try {
      await retry(() => apiClient.post(`/persister/synchronization/jobs/${jobId}/${assetType}?ignoreDuplicates=true&ignoreIllegalProperties=true`, assets, {
        headers: {
          'Content-Type': 'text/csv'
        }
      }), { delay: 500 });
    } catch (e) {

      if (e?.response?.data.error) {
        log.error(`\n\n${assetFile}: ${JSON.stringify(e?.response?.data)}\n\n`)
      }
    }
    progress(assetFile)
  }, {
    concurrency: 5,
  });
}

export async function importAssetsFromCsv({ apiKey, includeEntities, includeRelationships, storageDirectory, scope }: ImportAssetsFromCsvParams) {
  const spinner = createSpinner('Importing csv assets into account').start();

  try {
    const apiClient = createApiClientWithApiKey({ apiBaseUrl: J1_ENDPOINT, apiKey });
    const { data: { job } } = await apiClient.post('/persister/synchronization/jobs', {
      source: 'api',
      scope
    });

    const generateProgressTracker = (assetType: 'entities' | 'relationships') => {
      return (currentFile: string) => {
        spinner.text = `Importing ${assetType}: ${path.relative(process.cwd(), currentFile)}`
      }
    }

    if (includeEntities) {
      await importAssetTypeFromCsv({
        storageDirectory,
        apiClient,
        jobId: job.id,
        assetType: 'entities',
        progress: generateProgressTracker('entities')
      })
    }

    if (includeRelationships) {
      await importAssetTypeFromCsv({
        storageDirectory,
        apiClient,
        jobId: job.id,
        assetType: 'relationships',
        progress: generateProgressTracker('relationships')
      })
    }

    await apiClient.post(`/persister/synchronization/jobs/${job.id}/finalize`);

    await waitForSyncCompletion({
      apiClient,
      jobId: job.id,
      progress: jobStatus => {
        const {
          numEntitiesUploaded, numEntitiesCreated, numEntitiesUpdated,
          numRelationshipsUploaded, numRelationshipsCreated, numRelationshipsUpdated,
        } = jobStatus;

        spinner.text = `\nEntities:\tCreated: ${numEntitiesCreated}\tUpdated: ${numEntitiesUpdated}\tUploaded: ${numEntitiesUploaded}\n
Relationships:\tCreated: ${numRelationshipsCreated}\tUpdated: ${numRelationshipsUpdated}\tUploaded: ${numRelationshipsUploaded}`
      }
    });

    spinner.succeed('Csv Import Successful');
  } catch (e) {
    const failMessage = 'Failed to import assets into account';
    log.error(failMessage);
    spinner.fail(failMessage);

    if (e?.response?.data.error) {
      log.error(JSON.stringify(e?.response?.data))
      throw new Error(e)
    }

    throw e;
  }
};
