/**
 * Home of all file system interactions
 *
 * This module exports utilities for writing data
 * relative to the .j1-integration root storage directoryPath.
 */
import { promises as fs, writeSync } from 'fs';
import path from 'path';

import rimraf from 'rimraf';
import getFolderSize from 'get-folder-size';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { FlushedGraphObjectData } from './storage/types';
import { readGraphObjectFile } from './storage/FileSystemGraphObjectStore/indices';
import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export const DEFAULT_STORAGE_DIRECTORY_NAME = '.j1-integration';

/**
 * Exit code claimed for "the volume backing the storage directory is full".
 *
 * The managed ECS state machine treats it as a request to retry the task on a
 * larger disk (see `handleTaskFailure` in jupiter-integration-service). Any
 * other non-zero code is classified as a permanent failure, so this has to stay
 * in sync with that handler.
 */
export const OUT_OF_DISK_EXIT_CODE = 77;

function isOutOfDiskError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOSPC';
}

/**
 * Kills the process when a write fails because the disk is full.
 *
 * Every graph object the integration collects lands on disk before it is
 * uploaded, so once the volume is full nothing downstream can succeed. Letting
 * the ENOSPC propagate as a normal error is actively harmful: the step executor
 * catches it, marks that one step failed, and carries on to the next step,
 * which fails the same way. The job then finishes "with errors" and exits 0 —
 * a clean task exit that the state machine never catches, so the disk is never
 * scaled and the retry never happens. Publishing a partial graph also looks to
 * the customer like their data disappeared rather than like a failed run.
 *
 * Writes the diagnostic synchronously because `process.exit` does not flush
 * pending async stdout writes, and this line is the only evidence of why the
 * task died.
 */
function exitIfOutOfDisk(error: unknown, fullPath: string): void {
  if (!isOutOfDiskError(error)) return;

  try {
    writeSync(
      2,
      // Shaped as a bunyan record so it lands in the log pipeline alongside
      // everything else the integration emitted, rather than as loose text.
      `${JSON.stringify({
        v: 0,
        name: 'integration-sdk-runtime',
        level: 60,
        msg: 'Out of disk space while writing collected data. Exiting so the task can be retried with a larger volume.',
        path: fullPath,
        storageDirectory: getRootStorageDirectory(),
        exitCode: OUT_OF_DISK_EXIT_CODE,
        time: new Date().toISOString(),
      })}\n`,
    );
  } catch {
    // Nothing useful to do if even stderr is unavailable; still exit below.
  }

  process.exit(OUT_OF_DISK_EXIT_CODE);
}

export function getRootStorageDirectory() {
  return (
    process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY ||
    path.resolve(process.cwd(), DEFAULT_STORAGE_DIRECTORY_NAME)
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
 * Function for writing arbitrary data to a path
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

  try {
    await ensurePathCanBeWrittenTo(fullPath);

    if (isCompressionEnabled()) {
      await fs.writeFile(fullPath, await brotliCompress(content), 'utf8');
    } else {
      await fs.writeFile(fullPath, content, 'utf8');
    }
  } catch (error) {
    // Every write of collected data funnels through here, so this is the one
    // place that has to notice the volume filling up.
    exitIfOutOfDisk(error, fullPath);
    throw error;
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

  try {
    await ensurePathCanBeWrittenTo(fullDestinationPath);
    // On Windows, we need to perform hardlinks for files
    if (
      process.platform === 'win32' &&
      (await fs.lstat(fullSourcePath)).isFile()
    ) {
      await fs.link(fullSourcePath, fullDestinationPath);
    } else {
      await fs.symlink(fullSourcePath, fullDestinationPath, 'junction');
    }
  } catch (error) {
    // The index symlinks are written per flush alongside the graph object
    // files, so they hit ENOSPC on the same boundary.
    exitIfOutOfDisk(error, fullDestinationPath);
    throw error;
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

export function iterateParsedGraphFiles(
  iteratee: (parsedData: FlushedGraphObjectData) => Promise<void>,
  graphPath?: string,
) {
  return walkDirectory({
    path: graphPath || 'graph',
    async iteratee({ filePath }) {
      const parsed = await readGraphObjectFile<FlushedGraphObjectData>({
        filePath,
      });

      await iteratee(parsed);
    },
  });
}

export async function iterateParsedEntityGraphFiles(
  iteratee: (entities: Entity[]) => Promise<void>,
  graphPath?: string,
) {
  return iterateParsedGraphFiles(async (data) => {
    if (data.entities) {
      await iteratee(data.entities);
    }
  }, graphPath);
}

export async function iterateParsedRelationshipGraphFiles(
  iteratee: (relationships: Relationship[]) => Promise<void>,
  graphPath?: string,
) {
  return iterateParsedGraphFiles(async (data) => {
    if (data.relationships) {
      await iteratee(data.relationships);
    }
  }, graphPath);
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

export async function isDirectoryPresent(fullPath: string) {
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
