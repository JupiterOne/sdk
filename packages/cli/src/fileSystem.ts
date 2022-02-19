import path from 'path';
import * as nodeFs from 'fs';
import rimraf from 'rimraf';
import { promisify } from 'util';

const rimrafAsync = promisify(rimraf);
const fs = nodeFs.promises;

export async function ensureDirectoryExists(pathToWrite: string) {
  const directoryPath = path.dirname(pathToWrite);
  await fs.mkdir(directoryPath, { recursive: true });
}

export async function writeFileToPath({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}) {
  await ensureDirectoryExists(filePath);
  await fs.writeFile(filePath, content, 'utf8');
}

export function readFileFromPath(path: string) {
  return fs.readFile(path, 'utf8');
}

export async function readJsonFromPath<T>(path: string) {
  const jsonContent = await readFileFromPath(path);
  return JSON.parse(jsonContent) as T;
}

export function deleteDirectory(directory: string) {
  return rimrafAsync(directory);
}

export function getJsonAssetsDirectory(storageDirectory: string) {
  return path.join(storageDirectory, 'json');
}

export function getCsvAssetsDirectory(storageDirectory: string) {
  return path.join(storageDirectory, 'csv');
}
