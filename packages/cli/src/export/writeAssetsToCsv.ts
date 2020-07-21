import path from 'path';
import jsonexport from 'jsonexport';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';

import { ensureDirectoryExists, readJsonFromPath, writeFileToPath } from "../fileSystem";

type GroupedAssets = { [type: string]: string[] };

interface WriteAssetsToCsvParams {
  directory: string;
  groupedAssetFiles: GroupedAssets;
}

export async function writeAssetsToCsv({ groupedAssetFiles, directory }: WriteAssetsToCsvParams) {
  await Promise.all(Object.keys(groupedAssetFiles).map(async type => {
    for (const assetFile of groupedAssetFiles[type]) {
      const assetPath = path.join(directory, type, `${uuid()}.csv`)

      await ensureDirectoryExists(assetPath);

      const assets = await readJsonFromPath(assetFile);
      const csv = await jsonexport(assets)

      await writeFileToPath({ filePath: assetPath, content: csv });
    }
  }))
}