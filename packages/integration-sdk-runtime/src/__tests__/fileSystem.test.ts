import { promises as fs } from 'fs';

import { vol } from 'memfs';

import {
  OUT_OF_DISK_EXIT_CODE,
  symlink,
  writeFileToPath,
  writeJsonToPath,
} from '../fileSystem';

// The shared `__mocks__/fs` re-exports memfs with `export *`, which makes every
// property non-configurable and therefore impossible to spy on. Rebuilding it
// here as a plain object keeps memfs behaviour while leaving `writeSync`
// replaceable, since that is the call the diagnostic goes through.
jest.mock('fs', () => {
  const memfs = jest.requireActual('memfs');
  return {
    ...memfs,
    readdirSync: jest.requireActual('fs').readdirSync,
    writeSync: jest.fn(),
  };
});

const mockedFs = jest.requireMock('fs') as { writeSync: jest.Mock };

function outOfDiskError() {
  return Object.assign(
    new Error("ENOSPC: no space left on device, write '/tmp/whatever'"),
    { code: 'ENOSPC', errno: -28, syscall: 'write' },
  );
}

/**
 * `process.exit` would take the jest worker down with it, so every test that
 * can reach it replaces it with a no-op. Execution then falls through to the
 * `throw` that follows, which is what the assertions below account for.
 */
function mockProcessExit() {
  return jest.spyOn(process, 'exit').mockImplementation((() => {
    /* keep the worker alive */
  }) as never);
}

afterEach(() => {
  vol.reset();
  // `clearMocks` only clears recorded calls, so an implementation installed by
  // one test would otherwise leak into the next.
  mockedFs.writeSync.mockReset();
});

test('claims the exit code the ECS state machine treats as "retry on a bigger disk"', () => {
  // Changing this breaks the contract with `handleTaskFailure` in
  // jupiter-integration-service, which is deployed separately.
  expect(OUT_OF_DISK_EXIT_CODE).toBe(77);
});

test('exits with the out-of-disk code when a file write runs out of space', async () => {
  const exit = mockProcessExit();
  jest.spyOn(fs, 'writeFile').mockRejectedValue(outOfDiskError());

  await expect(
    writeFileToPath({ path: 'graph/entities/a.json', content: '{}' }),
  ).rejects.toThrow('ENOSPC');

  expect(exit).toHaveBeenCalledWith(OUT_OF_DISK_EXIT_CODE);
});

test('exits with the out-of-disk code when the storage directory cannot be created', async () => {
  const exit = mockProcessExit();
  jest.spyOn(fs, 'mkdir').mockRejectedValue(outOfDiskError());

  await expect(
    writeFileToPath({ path: 'graph/entities/a.json', content: '{}' }),
  ).rejects.toThrow('ENOSPC');

  expect(exit).toHaveBeenCalledWith(OUT_OF_DISK_EXIT_CODE);
});

test('exits with the out-of-disk code when an index symlink runs out of space', async () => {
  const exit = mockProcessExit();
  jest.spyOn(fs, 'symlink').mockRejectedValue(outOfDiskError());

  await expect(
    symlink({ sourcePath: 'graph/a.json', destinationPath: 'index/a.json' }),
  ).rejects.toThrow('ENOSPC');

  expect(exit).toHaveBeenCalledWith(OUT_OF_DISK_EXIT_CODE);
});

test('exits with the out-of-disk code when graph objects are flushed as JSON', async () => {
  const exit = mockProcessExit();
  jest.spyOn(fs, 'writeFile').mockRejectedValue(outOfDiskError());

  await expect(
    writeJsonToPath({ path: 'graph/entities/a.json', data: { entities: [] } }),
  ).rejects.toThrow('ENOSPC');

  expect(exit).toHaveBeenCalledWith(OUT_OF_DISK_EXIT_CODE);
});

test('reports why the process died before exiting', async () => {
  mockProcessExit();
  jest.spyOn(fs, 'writeFile').mockRejectedValue(outOfDiskError());

  await expect(
    writeFileToPath({ path: 'graph/entities/a.json', content: '{}' }),
  ).rejects.toThrow('ENOSPC');

  // Written to stderr synchronously: `process.exit` does not flush pending
  // async writes, so an ordinary logger call would never make it to CloudWatch.
  expect(mockedFs.writeSync).toHaveBeenCalledTimes(1);
  const [fd, line] = mockedFs.writeSync.mock.calls[0];
  expect(fd).toBe(2);
  expect(JSON.parse(line as string)).toMatchObject({
    exitCode: OUT_OF_DISK_EXIT_CODE,
    path: expect.stringContaining('a.json'),
  });
});

test('still exits when the diagnostic itself cannot be written', async () => {
  const exit = mockProcessExit();
  mockedFs.writeSync.mockImplementation(() => {
    throw new Error('EBADF: bad file descriptor');
  });
  jest.spyOn(fs, 'writeFile').mockRejectedValue(outOfDiskError());

  await expect(
    writeFileToPath({ path: 'graph/entities/a.json', content: '{}' }),
  ).rejects.toThrow('ENOSPC');

  expect(exit).toHaveBeenCalledWith(OUT_OF_DISK_EXIT_CODE);
});

test('leaves every other write failure to normal error handling', async () => {
  const exit = mockProcessExit();
  const permissionDenied = Object.assign(new Error('EACCES'), {
    code: 'EACCES',
  });
  jest.spyOn(fs, 'writeFile').mockRejectedValue(permissionDenied);

  await expect(
    writeFileToPath({ path: 'graph/entities/a.json', content: '{}' }),
  ).rejects.toThrow('EACCES');

  expect(exit).not.toHaveBeenCalled();
});
