import {
  createApiClient,
  getApiBaseUrl,
} from '@jupiterone/integration-sdk-runtime';
import _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

import { ensureDirectoryExists, writeFileToPath } from '../fileSystem';
import path from 'path';
import { sanitizeContent } from './util';

const J1_ENDPOINT = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });

interface BulkEntitiesData {
  items: Entity[];
  endCursor?: string;
}

interface BulkRelationshipsData {
  items: Relationship[];
  endCursor?: string;
}

async function exportAssetGroupToJson(
  assetPath: string,
  objects: Entity[] | Relationship[],
) {
  const groups = _.groupBy(objects, '_type');
  await Promise.all(
    Object.keys(groups).map(async (type) => {
      const group = groups[type];
      const groupTypePath = path.join(assetPath, type);

      await writeFileToPath({
        filePath: path.join(groupTypePath, `${uuid()}.json`),
        content: sanitizeContent(JSON.stringify(group)),
      });
    }),
  );
}

export type BulkDownloadParams = {
  assetType: 'entities' | 'relationships';
  storageDirectory: string;
  account: string;
  apiKey: string;
  includeDeleted: boolean;
  progress: (totalDownloaded: number) => void;
  apiBaseUrl: string | undefined;
};

export const ASSET_DOWNLOAD_LIMIT = 4000;

export async function bulkDownloadToJson({
  storageDirectory,
  assetType,
  account,
  apiKey,
  includeDeleted,
  progress,
  apiBaseUrl,
}: BulkDownloadParams) {
  let endCursor: string | undefined;
  let assetCount = 0;

  const apiClient = createApiClient({
    apiBaseUrl: apiBaseUrl ? apiBaseUrl : J1_ENDPOINT,
    account,
    accessToken: apiKey,
  });

  const assetPath = path.join(storageDirectory, 'json', assetType);
  await ensureDirectoryExists(assetPath);

  let limit = ASSET_DOWNLOAD_LIMIT;
  let tooLarge = false;
  do {
    let data: any;
    try {
      const response = await apiClient.get<
        BulkEntitiesData | BulkRelationshipsData
      >(
        `/${assetType}?limit=${limit}&includeDeleted=${includeDeleted}${
          endCursor ? '&cursor=' + endCursor : ''
        }`,
      );
      data = response.data;
      limit = ASSET_DOWNLOAD_LIMIT;
      tooLarge = false;
    } catch (e) {
      if (e.response?.status === 422) {
        limit /= 2;
        tooLarge = true;
        continue;
      } else {
        throw e;
      }
    }

    await exportAssetGroupToJson(assetPath, data.items);

    endCursor = data.endCursor;
    assetCount += data.items.length;

    progress(assetCount);
  } while (endCursor || tooLarge);
}
