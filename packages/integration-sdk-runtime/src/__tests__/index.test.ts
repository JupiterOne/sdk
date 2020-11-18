import { BucketMap, FileSystemGraphObjectStore } from '../index';

describe('#storage', () => {
  test('should expose BucketMap', () => {
    expect(BucketMap).not.toEqual(undefined);
  });

  test('should expose FileSystemGraphObjectStore', () => {
    expect(FileSystemGraphObjectStore).not.toEqual(undefined);
  });
});
