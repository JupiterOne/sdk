import {
  loadProjectStructure,
  getProjectDirectoryPath,
} from '@jupiterone/integration-sdk-private-test-utils/src';
import path from 'path';
import { createCli } from '../..';

import * as nodeFs from 'fs';
const fs = nodeFs.promises;

function getVisualizeTypesFilePath(fixtureName: string) {
  return path.join(
    getProjectDirectoryPath(fixtureName),
    '.j1-integration/types-graph/index.html',
  );
}

async function visualizeTypesCommandSnapshotTest(
  fixtureName: string,
  additionalArgs?: string[],
) {
  loadProjectStructure(fixtureName);

  const writeFileSpy = jest
    .spyOn(fs, 'writeFile')
    .mockResolvedValue(Promise.resolve());

  const args = [
    ...['node', 'j1-integration', 'visualize-types'],
    ...(additionalArgs || []),
  ];

  await createCli().parseAsync(args);

  expect(writeFileSpy).toHaveBeenCalledTimes(1);
  expect(writeFileSpy).toHaveBeenCalledWith(
    getVisualizeTypesFilePath(fixtureName),
    expect.any(String),
    'utf-8',
  );

  expect(writeFileSpy.mock.calls[0][1]).toMatchSnapshot();
}

describe('visualize integration metadata', () => {
  test('creates graph based on integration data with entities and relationships', async () => {
    await visualizeTypesCommandSnapshotTest(
      'visualizeTypesWithEntitiesAndRelationships',
    );
  });

  test('creates graph filtered by --type flag', async () => {
    await visualizeTypesCommandSnapshotTest(
      'visualizeTypesWithEntitiesAndRelationships',
      ['--type', 'my_account'],
    );
  });
});
