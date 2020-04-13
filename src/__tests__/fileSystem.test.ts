import { promises as fs } from 'fs';
import path from 'path';

import pMap from 'p-map';
import { v4 as uuid } from 'uuid';
import { vol } from 'memfs';

import {
  getRootStorageDirectory,
  writeJsonToPath,
  walkDirectory,
  symlink,
} from '../fileSystem';

jest.mock('fs'); // applies manual mock which uses memfs

beforeEach(() => {
  jest.spyOn(process, 'cwd').mockReturnValue('/');
});

afterEach(() => {
  vol.reset(); // clear out file system
});

describe('getRootStorageDirectory', () => {
  test('should utilize the current directory for building the default cache directory', () => {
    const mockCwdResult = `/${uuid()}`;
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwdResult);

    expect(getRootStorageDirectory()).toEqual(
      `${mockCwdResult}/.j1-integration`,
    );
  });
});

describe('writeJsonToPath', () => {
  test('should pretty write json to the specified file', async () => {
    const json = { test: '123' };

    const filename = `${uuid()}.json`;

    await writeJsonToPath({
      path: filename,
      data: json,
    });

    const writtenData = await fs.readFile(
      path.join(getRootStorageDirectory(), filename),
      'utf8',
    );
    expect(writtenData).toEqual(JSON.stringify(json, null, 2));
  });

  test('should recursively create directories prior to writing', async () => {
    const json = { woah: 'json' };

    const dirThatDoesNotExist = path.join(
      'test',
      'dir',
      'that',
      'does',
      'not',
      'already',
      'exist',
    );
    const filename = path.join(dirThatDoesNotExist, `${uuid()}.json`);

    const mkdirSpy = jest.spyOn(fs, 'mkdir');
    const writeFileSpy = jest.spyOn(fs, 'writeFile');

    await writeJsonToPath({
      path: filename,
      data: json,
    });

    const writtenData = await fs.readFile(
      path.join(getRootStorageDirectory(), filename),
      'utf8',
    );
    expect(writtenData).toEqual(JSON.stringify(json, null, 2));

    expect(mkdirSpy).toHaveBeenCalledTimes(1);
    expect(mkdirSpy).toHaveBeenCalledWith(
      path.join(getRootStorageDirectory(), dirThatDoesNotExist),
      {
        recursive: true,
      },
    );

    // not pretty but wanted to enforce that mkdir was being called before
    // write file
    //
    // ref: https://github.com/facebook/jest/issues/4402#issuecomment-534516219
    const mkdirOrder = mkdirSpy.mock.invocationCallOrder[0];
    const writeFileOrder = writeFileSpy.mock.invocationCallOrder[0];
    expect(mkdirOrder).toBeLessThan(writeFileOrder);
  });

  test('should default to fetching default cache directory if option is not supplied', async () => {
    const json = { tiger: 'king' };

    const filename = `${uuid()}.json`;

    await writeJsonToPath({
      path: filename,
      data: json,
    });

    const expectedFilePath = path.join(getRootStorageDirectory(), filename);

    const volData = vol.toJSON();
    expect(volData).toEqual({
      [expectedFilePath]: JSON.stringify(json, null, 2),
    });
  });
});

describe('symlink', () => {
  test('should create symlink from source path to destination path', async () => {
    const sourcePath = 'test.json';
    const destinationPath = 'symlink.json';

    const jsonString = JSON.stringify({ testing: 100000 }, null, 2);

    const expectedSourcePath = path.join(getRootStorageDirectory(), sourcePath);
    await fs.mkdir(getRootStorageDirectory(), { recursive: true });
    await fs.writeFile(expectedSourcePath, jsonString);

    await symlink({
      sourcePath,
      destinationPath,
    });

    expect(vol.toJSON()).toEqual({
      // memfs only shows real files with toJSON
      [expectedSourcePath]: jsonString,
    });

    const expectedDestination = path.join(
      getRootStorageDirectory(),
      destinationPath,
    );
    const symlinkedData = await fs.readFile(expectedDestination, 'utf8');
    expect(symlinkedData).toEqual(jsonString);

    const stats = await fs.lstat(expectedDestination);
    expect(stats.isSymbolicLink()).toEqual(true);
  });

  test('should recursively create directories prior to symlinking', async () => {
    const jsonString = JSON.stringify({ over: 9000 }, null, 2);

    const dirThatDoesNotExist = path.join(
      'dir',
      'that',
      'does',
      'not',
      'exist',
    );
    const sourcePath = 'test.json';
    const destinationPath = path.join(dirThatDoesNotExist, 'symlink.json');

    const mkdirSpy = jest.spyOn(fs, 'mkdir');
    const symlinkSpy = jest.spyOn(fs, 'symlink');

    await fs.writeFile(`/${sourcePath}`, jsonString);

    await symlink({
      sourcePath,
      destinationPath,
    });

    expect(mkdirSpy).toHaveBeenCalledTimes(1);
    expect(mkdirSpy).toHaveBeenCalledWith(
      path.join(getRootStorageDirectory(), dirThatDoesNotExist),
      { recursive: true },
    );

    // same as one of the above tests,
    // wanted to ensure mkdir was called prior to symlink
    //
    // ref: https://github.com/facebook/jest/issues/4402#issuecomment-534516219
    const mkdirOrder = mkdirSpy.mock.invocationCallOrder[0];
    const symlinkOrder = symlinkSpy.mock.invocationCallOrder[0];
    expect(mkdirOrder).toBeLessThan(symlinkOrder);
  });

  test('should default to fetching default cache directory if option is not supplied', async () => {
    const sourcePath = 'test.json';
    const destinationPath = 'dir/that/does/not/exist/symlink.json';

    const jsonString = JSON.stringify({ mochi: 'soba' }, null, 2);
    await fs.writeFile(`/${sourcePath}`, jsonString);

    await symlink({
      sourcePath,
      destinationPath,
    });

    const expectedFilePath = `${getRootStorageDirectory()}/${destinationPath}`;

    const stats = await fs.lstat(expectedFilePath);
    expect(stats.isSymbolicLink()).toEqual(true);
  });
});

describe('walkDirectory', () => {
  test('should iteratively read files from the specified directory', async () => {
    // populate vol with test files
    vol.fromJSON({
      '/.j1-integration/index/entities/cat/1.json': 'meow',
      '/.j1-integration/graph/summary.json': 'summary',
      '/.j1-integration/graph/step-1/entities/1.json': '1',
      '/.j1-integration/graph/step-1/entities/2.json': '2',
      '/.j1-integration/graph/step-1/entities/3.json': '3',
      '/.j1-integration/graph/step-2/entities/4.json': '4',
    });

    const expectedData = ['summary', '1', '2', '3', '4'];
    const collectedData: string[] = [];

    await walkDirectory({
      path: 'graph',
      iteratee: ({ data }) => {
        collectedData.push(data);
      },
    });

    expect(collectedData).toHaveLength(expectedData.length);
    expect(collectedData).toEqual(expect.arrayContaining(expectedData));
  });

  test('should be able to walk and resolve symlinked files', async () => {
    // populate vol with test files
    vol.fromJSON({
      '/.j1-integration/graph/step-1/entities/1.json': '1',
      '/.j1-integration/graph/step-1/entities/2.json': '2',
      '/.j1-integration/graph/step-1/entities/3.json': '3',
      '/.j1-integration/graph/step-2/entities/4.json': '4',
    });

    await pMap(Object.keys(vol.toJSON()), async (sourcePath: string) => {
      await symlink({
        sourcePath: sourcePath.substring(getRootStorageDirectory().length + 1),
        destinationPath: path.join(
          path.join('index', 'entities', 'type'),
          path.basename(sourcePath),
        ),
      });
    });

    const expectedData = ['1', '2', '3', '4'];
    const collectedData: string[] = [];

    await walkDirectory({
      path: 'index',
      iteratee: ({ data }) => {
        collectedData.push(data);
      },
    });

    expect(collectedData).toHaveLength(expectedData.length);
    expect(collectedData).toEqual(expect.arrayContaining(expectedData));
  });
});
