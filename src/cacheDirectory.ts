import { promises as fs } from 'fs';
import path from 'path';

export const DEFAULT_CACHE_DIRECTORY_NAME = '.j1-integration';

export function getDefaultCacheDirectory() {
  return path.resolve(process.cwd(), DEFAULT_CACHE_DIRECTORY_NAME);
}

interface WriteDataToPathInput {
  cacheDirectory?: string;
  path: string;
  data: object;
}

/**
 * Function for writing arbirary data to a path
 * relative to the cache directory.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function writeJsonToPath({
  cacheDirectory,
  path: relativePath,
  data,
}: WriteDataToPathInput) {
  const directory = cacheDirectory ?? getDefaultCacheDirectory();
  const fullPath = path.resolve(directory, relativePath);

  await ensurePathCanBeWrittenTo(fullPath);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

interface SymlinkInput {
  cacheDirectory?: string;
  sourcePath: string;
  destinationPath: string;
}

/**
 * Function for creating a symlink from on file to another.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function symlink({
  cacheDirectory,
  sourcePath,
  destinationPath,
}: SymlinkInput) {
  const directory = cacheDirectory ?? getDefaultCacheDirectory();
  const fullSourcePath = path.resolve(directory, sourcePath);
  const fullDestinationPath = path.resolve(directory, destinationPath);

  await ensurePathCanBeWrittenTo(fullDestinationPath);
  await fs.symlink(fullSourcePath, fullDestinationPath);
}

async function ensurePathCanBeWrittenTo(pathToWrite: string) {
  const directoryPath = path.dirname(pathToWrite);
  await fs.mkdir(directoryPath, { recursive: true });
}
