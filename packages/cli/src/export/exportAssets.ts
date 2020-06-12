import { ExportOptions } from '../commands';
import * as log from '../log';
import ora from 'ora';
import axios from 'axios';
import { v4 as uuid } from 'uuid'
import { Entity, Relationship } from '@jupiterone/integration-sdk-core';
import _ from 'lodash';
import * as nodeFs from 'fs';
import rimraf from 'rimraf';
import { promisify } from 'util';
const rimrafAsync = promisify(rimraf);
const fs = nodeFs.promises;

type ExportAssetsParams = ExportOptions & { account: string };

interface BulkEntitiesData {
  items: Entity[],
  endCursor?: string
}

interface BulkRelationshipsData {
  items: Relationship[],
  endCursor?: string
}

const J1_ENDPOINT = 'https://api.dev.jupiterone.io';

function createAxiosInstance(options: { account: string, apiKey }) {
  return axios.create({
    baseURL: J1_ENDPOINT,
    headers: {
      ['lifeomic-account']: options.account,
      'correlationId': uuid(),
      'Authorization': `Bearer ${options.apiKey}`
    }
  });
}

async function ensureDirectoryExists(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

type BulkDownloadParams = {
  downloadType: 'entities' | 'relationships';
  dataDir: string;
  apiKey: string;
  account: string;
  progress: (totalDownloaded: number) => void
}

async function bulkDownload({ dataDir, downloadType, apiKey, account, progress }: BulkDownloadParams) {
  let endCursor: string | undefined;
  let groupCount = 0;

  const j1Axios = createAxiosInstance({ apiKey, account });

  const groupPath = `${process.cwd()}/${dataDir}/json/${downloadType}`;
  await ensureDirectoryExists(groupPath);

  do {
    const { data } = await j1Axios.get<BulkEntitiesData | BulkRelationshipsData>(`/${downloadType}${endCursor ? '?cursor=' + endCursor : ''}`);
    const groups = _.groupBy(data.items, '_type')

    await Promise.all(Object.keys(groups).map(async (type) => {
      const group = groups[type];
      const groupTypePath = `${groupPath}/${type}`;

      await ensureDirectoryExists(groupTypePath);
      await fs.writeFile(`${groupTypePath}/${uuid()}.json`, JSON.stringify(group), 'utf8');
    }));

    endCursor = data.endCursor;
    groupCount += data.items.length;

    progress(groupCount);
  } while (endCursor)
}

export default async function exportAssets({ account, dataDir, excludeEntities, excludeRelationships }: ExportAssetsParams) {
  log.info(`Starting ${account} account export to the [${dataDir}] directory`);
  log.info(`Exported Entities: ${!excludeEntities}`);
  log.info(`Exported Relationships: ${!excludeRelationships}`);

  const spinner = ora('Exporting...').start();

  await rimrafAsync(`${process.cwd()}/${dataDir}`);

  const apiKey = process.env.JUPITERONE_API_KEY;
  if (!apiKey) {
    spinner.fail('JUPITERONE_API_KEY environment variable is required to export data from your account account');
    throw new Error('Missing required JUPITERONE_API_KEY environment variable.');
  }

  const bulkDownloads: Promise<void>[] = []

  let entityCount = 0;
  let relationshipCount = 0;
  const updateSpinner = () => {
    spinner.text = `Downloaded ${entityCount} entities and ${relationshipCount} relationships...`
  }

  if (!excludeEntities) bulkDownloads.push(bulkDownload({
    dataDir,
    downloadType: 'entities',
    account,
    apiKey,
    progress: count => {
      entityCount = count;
      updateSpinner();
    }
  }))
  if (!excludeRelationships) bulkDownloads.push(bulkDownload({
    dataDir,
    downloadType: 'relationships',
    account,
    apiKey,
    progress: count => {
      relationshipCount = count;
      updateSpinner();
    }
  }))

  await Promise.all(bulkDownloads);

  spinner.succeed(`Export Successful, Downloaded ${entityCount} entities and ${relationshipCount} relationships!`);
}