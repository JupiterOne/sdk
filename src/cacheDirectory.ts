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

interface WalkDirectoryIterateeInput {
  filePath: string;
  data: string;
}

type WalkDirectoryIteratee = (
  input: WalkDirectoryIterateeInput,
) => Promise<void> | void;

interface WalkDirectoryInput {
  cacheDirectory?: string;
  path: string;
  iteratee: WalkDirectoryIteratee;
}

/**
 * Function for recursively walking through a directory
 * and reading the data from each file.
 */
export async function walkDirectory({
  cacheDirectory,
  path: relativePath,
  iteratee,
}: WalkDirectoryInput) {
  const directory = cacheDirectory ?? getDefaultCacheDirectory();
  const fullPath = path.resolve(directory, relativePath);

  const files = await fs.readdir(fullPath);

  const onFile = async (filePath: string) => {
    const data = await fs.readFile(filePath, 'utf8');
    await iteratee({ filePath, data });
  };

  const handleFilePath = async (filePath: string) => {
    const stats = await fs.lstat(filePath);
    if (stats.isDirectory()) {
      // continue walking the directory
      await walkDirectory({
        cacheDirectory,
        iteratee,
        path: filePath,
      });
    } else if (stats.isFile()) {
      // handle the file
      await onFile(filePath);
    } else if (stats.isSymbolicLink()) {
      // resolve the symlink then reperform check
      // to determine path resolves to a file or
      // if we should continue recursing
      const realPath = await fs.realpath(filePath);
      await handleFilePath(realPath);
    }
  };

  for (const file of files) {
    await handleFilePath(path.resolve(fullPath, file));
  }
}

async function ensurePathCanBeWrittenTo(pathToWrite: string) {
  const directoryPath = path.dirname(pathToWrite);
  await fs.mkdir(directoryPath, { recursive: true });
}
