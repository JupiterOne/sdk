import { promises as fs } from 'fs';
import { v4 as uuid } from 'uuid';
import { vol } from 'memfs';

import {
  getDefaultCacheDirectory,
  writeJsonToPath,
  symlink,
} from '../cacheDirectory';

jest.mock('fs'); // applies manual mock which uses memfs

afterEach(() => {
  vol.reset(); // clear out file system
});

describe('getDefaultCacheDirectory', () => {
  test('should utilize the current directory for building the default cache directory', () => {
    const mockCwdResult = `/${uuid()}`;
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwdResult);

    expect(getDefaultCacheDirectory()).toEqual(
      `${mockCwdResult}/.j1-integration`,
    );
  });
});

describe('writeJsonToPath', () => {
  test('should pretty write json to the specified file', async () => {
    const json = { test: '123' };

    const directory = '/';
    const filename = `${uuid()}.json`;

    await writeJsonToPath({
      cacheDirectory: directory,
      path: filename,
      data: json,
    });

    const writtenData = await fs.readFile(`${directory}/${filename}`, 'utf8');
    expect(writtenData).toEqual(JSON.stringify(json, null, 2));
  });

  test('should recursively create directories prior to writing', async () => {
    const json = { woah: 'json' };

    const directory = '/';
    const filename = `test/dir/that/does/not/already/exist/${uuid()}.json`;

    const mkdirSpy = jest.spyOn(fs, 'mkdir');
    const writeFileSpy = jest.spyOn(fs, 'writeFile');

    await writeJsonToPath({
      cacheDirectory: directory,
      path: filename,
      data: json,
    });

    const writtenData = await fs.readFile(`${directory}/${filename}`, 'utf8');
    expect(writtenData).toEqual(JSON.stringify(json, null, 2));

    expect(mkdirSpy).toHaveBeenCalledTimes(1);
    expect(mkdirSpy).toHaveBeenCalledWith(
      '/test/dir/that/does/not/already/exist',
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

    const expectedFilePath = `${getDefaultCacheDirectory()}/${filename}`;

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

    await fs.writeFile(`/${sourcePath}`, jsonString);

    await symlink({
      cacheDirectory: '/',
      sourcePath,
      destinationPath,
    });

    expect(vol.toJSON()).toEqual({
      // memfs only shows real files with toJSON
      [`/${sourcePath}`]: jsonString,
    });

    const expectedDestination = `/${destinationPath}`;
    const symlinkedData = await fs.readFile(expectedDestination, 'utf8');
    expect(symlinkedData).toEqual(jsonString);

    const stats = await fs.lstat(expectedDestination);
    expect(stats.isSymbolicLink()).toEqual(true);
  });

  test('should recursively create directories prior to symlinking', async () => {
    const jsonString = JSON.stringify({ over: 9000 }, null, 2);

    const sourcePath = 'test.json';
    const destinationPath = 'dir/that/does/not/exist/symlink.json';

    const mkdirSpy = jest.spyOn(fs, 'mkdir');
    const symlinkSpy = jest.spyOn(fs, 'symlink');

    await fs.writeFile(`/${sourcePath}`, jsonString);

    await symlink({
      cacheDirectory: '/',
      sourcePath,
      destinationPath,
    });

    expect(mkdirSpy).toHaveBeenCalledTimes(1);
    expect(mkdirSpy).toHaveBeenCalledWith('/dir/that/does/not/exist', {
      recursive: true,
    });

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

    const expectedFilePath = `${getDefaultCacheDirectory()}/${destinationPath}`;

    const stats = await fs.lstat(expectedFilePath);
    expect(stats.isSymbolicLink()).toEqual(true);
  });
});
