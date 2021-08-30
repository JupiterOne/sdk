import * as nodeFs from 'fs';
import path from 'path';

import { StepResultStatus } from '@jupiterone/integration-sdk-core';
import {
  getProjectDirectoryPath,
  loadProjectStructure,
} from '@jupiterone/integration-sdk-private-test-utils';

import { createCli } from '../index';
import * as log from '../log';

const fs = nodeFs.promises;

jest.mock('../log');

function getDocumentationFilePath(fixtureName: string) {
  return path.join(getProjectDirectoryPath(fixtureName), 'docs/jupiterone.md');
}

async function documentCommandSnapshotTest(fixtureName: string) {
  loadProjectStructure(fixtureName);

  const writeFileSpy = jest
    .spyOn(fs, 'writeFile')
    .mockResolvedValueOnce(Promise.resolve());

  await createCli().parseAsync(['node', 'j1-integration', 'document']);

  expect(writeFileSpy).toHaveBeenCalledTimes(1);
  expect(writeFileSpy).toHaveBeenCalledWith(
    getDocumentationFilePath(fixtureName),
    expect.any(String),
    {
      encoding: 'utf-8',
    },
  );

  expect(writeFileSpy.mock.calls[0][1]).toMatchSnapshot();
}

afterEach(() => {
  delete process.env.MY_CONFIG;
});

describe('collect', () => {
  beforeEach(() => {
    loadProjectStructure('instanceWithDependentSteps');
  });

  test('loads the integration, executes it, and logs the result', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);

    expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
    expect(log.displayExecutionResults).toHaveBeenCalledWith({
      integrationStepResults: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          declaredTypes: ['my_account'],
          partialTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-groups',
          dependsOn: ['fetch-accounts'],
          name: 'Fetch Groups',
          declaredTypes: ['my_groups'],
          partialTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          declaredTypes: ['my_user'],
          partialTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
      ],
      metadata: {
        partialDatasets: {
          types: [],
        },
      },
    });
  });

  describe('schema validation', () => {
    beforeEach(() => {
      loadProjectStructure('instanceWithNonValidatingSteps');
      delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
    });

    test('step should fail if enableSchemaValidation = true', async () => {
      await createCli().parseAsync(['node', 'j1-integration', 'collect']);

      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.FAILURE,
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['my_user'],
          },
        },
      });
    });

    test('step should pass if enableSchemaValidation = false', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--disable-schema-validation',
      ]);

      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: ['my_user'],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });
  });

  describe('-s or --step option', () => {
    test('will only run the steps provided if the -s / --steps option is passed in', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users',
      ]);

      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will allow filtering to multiple steps if the -s or --steps option has multiple comma separated values', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users,fetch-accounts',
      ]);

      // fetch-users and fetch-accounts have no dependents and should be the only
      // ones enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will allow filtering to multiple steps if the -s or --steps option is provided multiple times', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users',
        '--step',
        'fetch-accounts',
      ]);

      // fetch-users and fetch-accounts have no dependents and should be the only
      // ones enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will run dependent steps of steps passed in', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-groups',
      ]);
      // fetch-groups depends on fetch-accounts so they should both
      // be enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });
  });
});

describe('visualize', () => {
  let htmlFileLocation;
  beforeEach(() => {
    loadProjectStructure('typeScriptVisualizeProject');
    htmlFileLocation = path.resolve(
      process.cwd(),
      'custom-integration',
      'index.html',
    );
  });

  test('writes graph to html file', async () => {
    await createCli().parseAsync([
      'node',
      'j1-integration',
      'visualize',
      '--data-dir',
      path.resolve(process.cwd(), 'custom-integration'),
      '--output-file',
      htmlFileLocation,
    ]);

    const content = await fs.readFile(htmlFileLocation, 'utf8');

    const nodesRegex = /var nodes = new vis.DataSet\(\[{.*},{.*}\]\);/g;
    const edgesRegex = /var edges = new vis.DataSet\(\[{.*}\]\);/g;

    expect(log.info).toHaveBeenCalledWith(
      `Visualize graph here: ${htmlFileLocation}`,
    );
    expect(content).toEqual(expect.stringMatching(nodesRegex));
    expect(content).toEqual(expect.stringMatching(edgesRegex));
  });
});

describe('collect/visualize integration', () => {
  let htmlFileLocation;
  beforeEach(() => {
    loadProjectStructure('typeScriptIntegrationProject');

    htmlFileLocation = path.resolve(
      process.cwd(),
      '.j1-integration',
      'index.html',
    );
  });

  test('creates graph based on integration data', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);
    await createCli().parseAsync(['node', 'j1-integration', 'visualize']);

    const content = await fs.readFile(htmlFileLocation, 'utf8');

    const nodesRegex = /var nodes = new vis.DataSet\(\[{.*},{.*}\]\);/g;
    const edgesRegex = /var edges = new vis.DataSet\(\[{.*}\]\);/g;

    expect(log.info).toHaveBeenCalledWith(
      `Visualize graph here: ${htmlFileLocation}`,
    );
    expect(content).toEqual(expect.stringMatching(nodesRegex));
    expect(content).toEqual(expect.stringMatching(edgesRegex));
  });
});

describe('document', () => {
  test('loads the integration with entities and relationships and writes documentation results', async () => {
    await documentCommandSnapshotTest('docsInstanceWithRelationships');
  });

  test('loads the integration without relationships and writes documentation results', async () => {
    await documentCommandSnapshotTest(
      'docsInstanceWithDependentStepsNoRelationships',
    );
  });

  test('loads the integration without entities and writes documentation results', async () => {
    await documentCommandSnapshotTest('docsInstanceNoEntities');
  });

  test('loads the integration with array of entity classes and writes document', async () => {
    await documentCommandSnapshotTest('docsInstanceArrayEntityClasses');
  });

  test('loads the integration and writes documentation when documentation markers already exist', async () => {
    await documentCommandSnapshotTest('docsWithExistingGeneratedDocs');
  });

  test('handles duplicate entity _type ingested in multiple steps', async () => {
    await documentCommandSnapshotTest('docsInstanceDuplicateEntityTypes');
  });

  test('handles duplicate relationship _type ingested in multiple steps', async () => {
    await documentCommandSnapshotTest('docsInstanceDuplicateRelationshipTypes');
  });

  test('alphabetizes "entities" metadata', async () => {
    await documentCommandSnapshotTest('docsInstanceEntitiesAlphabetize');
  });

  test('alphabetizes "relationships" metadata', async () => {
    await documentCommandSnapshotTest('docsInstanceRelationshipsAlphabetize');
  });

  test('loads the integration with entity and mapped relationship and writes documentation results', async () => {
    await documentCommandSnapshotTest('docsInstanceWithMappedRelationships');
  });

  test('should allow passing a file path for the generated documentation', async () => {
    loadProjectStructure('docsInstanceCustomDocLoc');

    const writeFileSpy = jest
      .spyOn(fs, 'writeFile')
      .mockResolvedValueOnce(Promise.resolve());

    const customDocumentationFilePath = path.join(
      getProjectDirectoryPath('docsInstanceCustomDocLoc'),
      'custom-docs/custom-jupiterone.md',
    );

    await createCli().parseAsync([
      'node',
      'j1-integration',
      'document',
      '-o',
      'custom-docs/custom-jupiterone.md',
    ]);

    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSpy).toHaveBeenCalledWith(
      customDocumentationFilePath,
      expect.any(String),
      {
        encoding: 'utf-8',
      },
    );

    expect(writeFileSpy.mock.calls[0][1]).toMatchSnapshot();
  });

  test('loads the integration without entities or relationships and does not write a file', async () => {
    loadProjectStructure('docsInstanceNoEntitiesNoRelationships');

    const writeFileSpy = jest
      .spyOn(fs, 'writeFile')
      .mockResolvedValueOnce(Promise.resolve());

    await createCli().parseAsync(['node', 'j1-integration', 'document']);
    expect(writeFileSpy).toHaveBeenCalledTimes(0);
    expect(log.info).toHaveBeenCalledWith(
      `No entities or relationships found to generate documentation for. Exiting.`,
    );
  });

  test('should throw error when an existing doc does not exist', async () => {
    loadProjectStructure('docsWithoutExistingDoc');

    const writeFileSpy = jest
      .spyOn(fs, 'writeFile')
      .mockResolvedValueOnce(Promise.resolve());

    const documentationFilePath = getDocumentationFilePath(
      'docsWithoutExistingDoc',
    );
    const expectedErrorMessageThrown = `ENOENT: no such file or directory, open '${documentationFilePath}'`;

    await expect(
      createCli().parseAsync(['node', 'j1-integration', 'document']),
    ).rejects.toThrowError(expectedErrorMessageThrown);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      `Error loading documentation file from path (path=${documentationFilePath}, err=${expectedErrorMessageThrown})`,
    );
    expect(writeFileSpy).toHaveBeenCalledTimes(0);
  });
});
