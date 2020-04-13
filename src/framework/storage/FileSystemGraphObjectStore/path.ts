export type CollectionType = 'entities' | 'relationships';

interface BuildObjectCollectionFilePathInput {
  storageDirectoryPath: string;
  collectionType: CollectionType;
  filename: string;
}

export function buildObjectCollectionFilePath({
  storageDirectoryPath,
  collectionType,
  filename,
}: BuildObjectCollectionFilePathInput) {
  return ['graph', storageDirectoryPath, collectionType, filename].join('/');
}

interface BuildIndexFilePathInput extends BuildIndexDirectoryPathInput {
  filename: string;
}

export function buildIndexFilePath({
  collectionType,
  type,
  filename,
}: BuildIndexFilePathInput) {
  return [buildIndexDirectoryPath({ collectionType, type }), filename].join(
    '/',
  );
}

interface BuildIndexDirectoryPathInput {
  collectionType: CollectionType;
  type: string;
}

export function buildIndexDirectoryPath({
  collectionType,
  type,
}: BuildIndexDirectoryPathInput) {
  return ['index', collectionType, type].join('/');
}
