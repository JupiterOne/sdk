import { createCli } from '../index';
import { loadProjectStructure } from '../../__tests__/loadProjectStructure';
import * as log from '../../log';

import { IntegrationStepResultStatus } from '../../framework/execution';

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
          types: ['my_account'],
          status: IntegrationStepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-groups',
          dependsOn: ['fetch-accounts'],
          name: 'Fetch Groups',
          types: ['my_groups'],
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
            types: ['my_account'],
            status: IntegrationStepResultStatus.DISABLED,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            types: ['my_groups'],
            status: IntegrationStepResultStatus.DISABLED,
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
            types: ['my_account'],
            status: IntegrationStepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            types: ['my_groups'],
            status: IntegrationStepResultStatus.DISABLED,
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
            types: ['my_account'],
            status: IntegrationStepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            types: ['my_groups'],
            status: IntegrationStepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            types: ['my_user'],
            status: IntegrationStepResultStatus.DISABLED,
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
