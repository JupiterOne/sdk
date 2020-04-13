import path from 'path';

export function loadProjectStructure(fixtureName: string) {
  jest
    .spyOn(process, 'cwd')
    .mockReturnValue(path.resolve(__dirname, '__fixtures__', fixtureName));
}
