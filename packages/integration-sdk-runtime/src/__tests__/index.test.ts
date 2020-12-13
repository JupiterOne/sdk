import { FileSystemGraphObjectStore } from '../index';

describe('#storage', () => {
  test('should expose FileSystemGraphObjectStore', () => {
    expect(FileSystemGraphObjectStore).not.toEqual(undefined);
  });
});
