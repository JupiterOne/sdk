import path from 'path';
import { createCli } from '../index';
import { loadProjectStructure } from '../../__tests__/loadProjectStructure';
import * as log from '../../log';

import { IntegrationStepResultStatus } from '../../framework/execution';
import { getRootStorageDirectory } from '../../fileSystem';
import * as nodeFs from 'fs';
const fs = nodeFs.promises;

jest.mock('../../log');

afterEach(() => {
  // clear require cache
  Object.keys(require.cache).forEach((modulePath) => {
    delete require.cache[modulePath];
  });

  delete process.env.MY_CONFIG;
});

describe('collect', () => {
  beforeEach(() => {
    loadProjectStructure('typeScriptProject');
  });

  test('loads the integration, executes it, and logs the result', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);

    expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
    expect(log.displayExecutionResults).toHaveBeenCalledWith({
      integrationStepResults: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          status: IntegrationStepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          status: IntegrationStepResultStatus.SUCCESS,
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

describe('visualize', () => {
  beforeEach(() => {
    loadProjectStructure('typeScriptVisualizeProject');
  });

  test('writes graph to html file', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'visualize']);

    const htmlFileLocation = path.join(getRootStorageDirectory(), 'index.html');
    const content = await fs.readFile(htmlFileLocation, 'utf8');

    expect(log.info).toHaveBeenCalledWith(
      `Visualize Integration SDK graph here: ${htmlFileLocation}`,
    );
    expect(content).toMatchSnapshot();
  });
});

describe('collect/visualize integration', () => {
  beforeEach(() => {
    loadProjectStructure('typeScriptIntegrationProject');
  });

  test('creates graph based on integration data', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);
    await createCli().parseAsync(['node', 'j1-integration', 'visualize']);

    const htmlFileLocation = path.join(getRootStorageDirectory(), 'index.html');
    const content = await fs.readFile(htmlFileLocation, 'utf8');

    expect(log.info).toHaveBeenCalledWith(
      `Visualize Integration SDK graph here: ${htmlFileLocation}`,
    );
    expect(content).toMatchSnapshot();
  });
});
