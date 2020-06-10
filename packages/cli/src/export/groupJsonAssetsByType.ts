import globby from 'globby';
import upath from 'upath';
import path from 'path';
import _ from 'lodash';

interface BatchAssetParams {
  assetDirectory: string
}

export async function groupJsonAssetsByType({ assetDirectory }: BatchAssetParams) {
  const assetJsonFiles = await globby([
    upath.toUnix(`${assetDirectory}/**/*.json`)
  ]);

  const assetJsonFilesByType = _.groupBy(assetJsonFiles, p => path.basename(path.dirname(p)))

  return Object.keys(assetJsonFilesByType)
    .reduce((acc, key) => {
      acc[key] = assetJsonFilesByType[key]
      return acc;
    }, {} as { [key: string]: string[] })
}
