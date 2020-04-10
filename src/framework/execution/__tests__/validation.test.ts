import { IntegrationStep, IntegrationStepStartStates } from '../types';

import { validateStepStartStates } from '../validation';

describe('validateStepStartStates', () => {
  test('throws error if step is provided in start states', () => {
    const states: IntegrationStepStartStates = {
      a: {
        disabled: false,
      },
      b: {
        disabled: true,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).toThrow(
      `Invalid step id "b" found in start states.`,
    );
  });

  test('throws steps are not accounted for in start states', () => {
    const states: IntegrationStepStartStates = {
      a: {
        disabled: false,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: jest.fn(),
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).toThrow(
      `Steps not defined in start states found: "b", "c"`,
    );
  });

  test('passes if all steps are accounted for', () => {
    const states: IntegrationStepStartStates = {
      a: {
        disabled: false,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).not.toThrow();
  });
});
