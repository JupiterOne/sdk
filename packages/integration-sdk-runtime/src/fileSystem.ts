/**
 * Home of all file system interactions
 *
 * This module exports utilities for writing data
 * relative to the .j1-integration root storage directoryPath.
 */
import { promises as fs } from 'fs';
import path from 'path';

import rimraf from 'rimraf';
import getFolderSize from 'get-folder-size';
import * as zlib from 'zlib';
import { promisify } from 'util';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export const DEFAULT_CACHE_DIRECTORY_NAME = '.j1-integration';

export function getRootStorageDirectory() {
  return (
    process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY ||
    path.resolve(process.cwd(), DEFAULT_CACHE_DIRECTORY_NAME)
  );
}

export function getRootStorageAbsolutePath(relativePath: string) {
  return path.resolve(getRootStorageDirectory(), relativePath);
}

export function getRootStorageDirectorySize(): Promise<number> {
  return new Promise((resolve, reject) => {
    getFolderSize(getRootStorageDirectory(), (err: Error, size: number) =>
      err ? reject(err) : resolve(size),
    );
  });
}

interface WriteDataToPathInput {
  path: string;
  data: object;
  pretty?: boolean;
}

/**
 * Function for writing arbirary data to a path
 * relative to the cache directory.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function writeJsonToPath({
  path: relativePath,
  data,
  pretty = false,
}: WriteDataToPathInput) {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

  await writeFileToPath({
    path: relativePath,
    content,
  });
}

interface WriteContentToPathInput {
  path: string;
  content: string;
}

export function isCompressionEnabled() {
  return !!process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
}

export async function writeFileToPath({
  path: relativePath,
  content,
}: WriteContentToPathInput) {
  const directory = getRootStorageDirectory();
  const fullPath = path.resolve(directory, relativePath);

  await ensurePathCanBeWrittenTo(fullPath);

  if (isCompressionEnabled()) {
    await fs.writeFile(fullPath, await brotliCompress(content), 'utf8');
  } else {
    await fs.writeFile(fullPath, content, 'utf8');
  }
}

/**
 * Reads any file and parses content as JSON; does not need to be relative to
 * `getRootStorageDirectory()`.
 *
 * @param path File path to read, may be relative to process.cwd() or absolute
 * @returns JSON contained in file
 */
export async function readJsonFromPath<T>(path: string) {
  let fileStr: string;

  if (isCompressionEnabled()) {
    // Specifying 'utf-8' as the second argument to `readFile` will cause the
    // Brotli decompression to fail. We should specify the encoding in the
    // call to Buffer.toString(...) instead.
    const file = await fs.readFile(path);
    fileStr = (await brotliDecompress(file)).toString('utf-8');
  } else {
    fileStr = await fs.readFile(path, 'utf8');
  }

  return JSON.parse(fileStr) as T;
}

interface SymlinkInput {
  sourcePath: string;
  destinationPath: string;
}

/**
 * Function for creating a symlink from on file to another.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function symlink({ sourcePath, destinationPath }: SymlinkInput) {
  const directory = getRootStorageDirectory();
  const fullSourcePath = path.resolve(directory, sourcePath);
  const fullDestinationPath = path.resolve(directory, destinationPath);

  await ensurePathCanBeWrittenTo(fullDestinationPath);
  // On Windows, we need to perform hardlinks for files
  if (
    (await fs.lstat(fullSourcePath)).isFile() &&
    process.platform === 'win32'
  ) {
    await fs.link(fullSourcePath, fullDestinationPath);
  } else {
    await fs.symlink(fullSourcePath, fullDestinationPath, 'junction');
  }
}

export interface WalkDirectoryIterateeInput {
  filePath: string;
}

type WalkDirectoryIteratee = (
  input: WalkDirectoryIterateeInput,
) => Promise<void> | void;

interface WalkDirectoryInput {
  path: string;
  iteratee: WalkDirectoryIteratee;
}

/**
 * Function for recursively walking through a directory and calling back with
 * every file path
 */
export async function walkDirectory({
  path: relativePath,
  iteratee,
}: WalkDirectoryInput) {
  const directory = getRootStorageDirectory();
  const fullPath = path.resolve(directory, relativePath);

  const isDirectory = await isDirectoryPresent(fullPath);
  if (!isDirectory) {
    return;
  }

  const files = await fs.readdir(fullPath);

  const onFile = async (filePath: string) => {
    await iteratee({ filePath });
  };

  const handleFilePath = async (filePath: string) => {
    const stats = await fs.lstat(filePath);
    if (stats.isDirectory()) {
      // continue walking the directory
      await walkDirectory({
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

export function isRootStorageDirectoryPresent(): Promise<boolean> {
  const rootStorageDir = getRootStorageDirectory();
  return isDirectoryPresent(rootStorageDir);
}

/**
 * Wipes the storage directory clean
 */
export async function removeStorageDirectory() {
  const rootStorageDir = getRootStorageDirectory();
  if (await isDirectoryPresent(rootStorageDir)) {
    await removeDirectory(rootStorageDir);
  }
}

function removeDirectory(directory: string) {
  return new Promise<void>((resolve, reject) =>
    rimraf(directory, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    }),
  );
}

async function isDirectoryPresent(fullPath: string) {
  try {
    const stats = await fs.lstat(fullPath);
    return stats.isDirectory();
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }

    // not what we expected... throw error
    throw err;
  }
}

async function ensurePathCanBeWrittenTo(pathToWrite: string) {
  const directoryPath = path.dirname(pathToWrite);
  await fs.mkdir(directoryPath, { recursive: true });
}
