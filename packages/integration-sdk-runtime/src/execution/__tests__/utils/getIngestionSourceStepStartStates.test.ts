import {
  Step,
  StepStartStates,
  DisabledStepReason,
  StepExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { getIngestionSourceStepStartStates } from '../../utils/getIngestionSourceStepStartStates';

const createStep = ({
  id,
  ingestionSourceId,
}: {
  id: string;
  ingestionSourceId?: string;
}) => ({
  id,
  ingestionSourceId,
  name: id,
  entities: [],
  relationships: [],
  executionHandler: jest.fn(),
});

describe('getIngestionSourceStepStartStates', () => {
  const mockIntegrationSteps: Step<StepExecutionContext>[] = [
    createStep({
      id: 'step-1',
      ingestionSourceId: 'source-1',
    }),
    createStep({
      id: 'step-2',
      ingestionSourceId: 'source-2',
    }),
    createStep({
      id: 'step-3',
    }),
  ];

  const mockConfigStepStartStates: StepStartStates = {
    'step-1': { disabled: true, disabledReason: DisabledStepReason.PERMISSION },
    'step-2': { disabled: false },
    'step-3': { disabled: false },
  };

  it("prioritizes the step state from the instance's getStepStartStates", () => {
    const result = getIngestionSourceStepStartStates({
      integrationSteps: mockIntegrationSteps,
      configStepStartStates: mockConfigStepStartStates,
      disabledSources: ['source-1'],
    });

    expect(result['step-1']).toEqual(mockConfigStepStartStates['step-1']);
  });

  it('disables a step if it is in disabledSources', () => {
    const result = getIngestionSourceStepStartStates({
      integrationSteps: mockIntegrationSteps,
      configStepStartStates: mockConfigStepStartStates,
      disabledSources: ['source-2'],
    });

    expect(result['step-2']).toEqual({
      disabled: true,
      disabledReason: DisabledStepReason.USER_CONFIG,
    });
  });

  it('does not add a disabledReason if the step is not disabled', () => {
    const result = getIngestionSourceStepStartStates({
      integrationSteps: mockIntegrationSteps,
      configStepStartStates: mockConfigStepStartStates,
      disabledSources: undefined,
    });

    expect(result['step-2']).toEqual({
      disabled: false,
    });

    expect(result['step-3']).toEqual({
      disabled: false,
    });
  });
});
