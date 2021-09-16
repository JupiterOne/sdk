import { CollectionType } from '@jupiterone/integration-sdk-core';
import path from 'path';

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
  return path.join('graph', storageDirectoryPath, collectionType, filename);
}

interface BuildIndexFilePathInput extends BuildIndexDirectoryPathInput {
  filename: string;
}

export function buildIndexFilePath({
  collectionType,
  type,
  filename,
}: BuildIndexFilePathInput) {
  return path.join(buildIndexDirectoryPath({ collectionType, type }), filename);
}

interface BuildIndexDirectoryPathInput {
  collectionType: CollectionType;
  type: string;
}

export function buildIndexDirectoryPath({
  collectionType,
  type,
}: BuildIndexDirectoryPathInput) {
  return path.join('index', collectionType, type);
}
