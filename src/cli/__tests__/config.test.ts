import path from 'path';
import {
  loadModuleContent,
  loadInstanceConfigFields,
  loadIntegrationSteps,
  loadValidateInvocationFunction,
  loadGetStepStartStatesFunction,
  loadConfig,
} from '../config';

jest.mock('../log');

afterEach(() => {
  // clear require cache
  Object.keys(require.cache).forEach((modulePath) => {
    delete require.cache[modulePath];
  });
});

describe('loadModuleContent', () => {
  test('loads any module and retrieves the default export', () => {
    loadProjectStructure('typeScriptProject');
    expect(loadModuleContent('./src/validateInvocation')).toEqual(
      expect.any(Function),
    );
  });
});

describe('TypeScript project', () => {
  beforeEach(() => {
    loadProjectStructure('typeScriptProject');
  });

  describe('loadInstanceConfigFields', () => {
    test('loads "src/instanceConfigFields.json" relative to current working directory', () => {
      const instanceConfigFields = loadInstanceConfigFields();
      expect(instanceConfigFields).toEqual({
        myConfig: {
          mask: true,
          type: 'boolean',
        },
      });
    });

    test('returns undefined if module is not found', () => {
      jest
        .spyOn(process, 'cwd')
        .mockReturnValue('/directory/that/does/not/exist/lolololol');

      const instanceConfigFields = loadInstanceConfigFields();
      expect(instanceConfigFields).toBeUndefined();
    });
  });

  describe('loadIntegrationSteps', () => {
    test('loads all files stored in "src/steps" ', async () => {
      const steps = await loadIntegrationSteps();
      expect(steps).toEqual([
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          executionHandler: expect.any(Function),
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          executionHandler: expect.any(Function),
        },
      ]);
    });
  });

  describe('loadValidateInvocationFunction', () => {
    test('loads function from "src/validateInvocation" ', async () => {
      const validateFunction = loadValidateInvocationFunction();
      expect(validateFunction).toEqual(expect.any(Function));
      expect(() => (validateFunction as any)()).toThrow('Invalid config');
    });
  });

  describe('loadGetStepStartStatesFunction', () => {
    test('loads function from "src/getStepStartStates" ', async () => {
      const getStepStartStates = loadGetStepStartStatesFunction();
      expect(getStepStartStates).toEqual(expect.any(Function));

      expect((getStepStartStates as any)()).toEqual({
        'fetch-accounts': {
          disabled: false,
        },
        'fetch-users': {
          disabled: false,
        },
      });
    });
  });

  describe('loadConfig', () => {
    test('loads steps, getStepStartStates, validateFunction, and instanceConfigFields', async () => {
      const config = await loadConfig();

      expect(config).toEqual({
        instanceConfigFields: {
          myConfig: {
            mask: true,
            type: 'boolean',
          },
        },
        getStepStartStates: expect.any(Function),
        validateInvocation: expect.any(Function),
        integrationSteps: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            types: ['my_account'],
            executionHandler: expect.any(Function),
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            types: ['my_user'],
            executionHandler: expect.any(Function),
          },
        ],
      });
    });
  });
});

function loadProjectStructure(fixtureName: string) {
  jest
    .spyOn(process, 'cwd')
    .mockReturnValue(path.resolve(__dirname, '__fixtures__', fixtureName));
}
