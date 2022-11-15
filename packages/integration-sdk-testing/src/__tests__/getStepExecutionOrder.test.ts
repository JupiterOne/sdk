import { getMockIntegrationStep } from '@jupiterone/integration-sdk-private-test-utils';
import { getStepExecutionOrder } from '../getStepExecutionOrder';

const testSteps = [
  getMockIntegrationStep({ id: 'graph-1-step-1' }),
  getMockIntegrationStep({ id: 'graph-1-step-2' }),
  getMockIntegrationStep({
    id: 'graph-1-step-3',
    dependsOn: ['graph-1-step-2'],
  }),
  getMockIntegrationStep({ id: 'graph-2-step-1', dependencyGraphId: 'two' }),
  getMockIntegrationStep({
    id: 'graph-2-step-2',
    dependsOn: ['graph-2-step-1'],
    dependencyGraphId: 'two',
  }),
  getMockIntegrationStep({ id: 'graph-3-step-1', dependencyGraphId: 'three' }),
  getMockIntegrationStep({ id: 'graph-5-step-1', dependencyGraphId: 'five' }),
];
const dependencyGraphOrder = ['two', 'three', 'four', 'five'];

describe('getStepExecutionOrder', () => {
  describe('empty dependencyStepIds', () => {
    test('should not run any steps if dependencyStepIds is empty', () => {
      expect(
        getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: [],
        }).size,
      ).toBe(0);
    });
  });

  describe('valid', () => {
    test('should run steps only in dependencyGraphs which have a dependencyStepId', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: ['graph-3-step-1', 'graph-1-step-1'],
        }),
      ]).toEqual(['graph-1-step-1', 'graph-3-step-1']);
    });

    test('should run dependencies of steps in dependencyStepIds', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: ['graph-1-step-3', 'graph-3-step-1'],
        }),
      ]).toEqual(['graph-1-step-2', 'graph-1-step-3', 'graph-3-step-1']);
    });

    test('should not run steps multiple times if duplicated dependencyStepIds', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: ['graph-3-step-1', 'graph-3-step-1'],
        }),
      ]).toEqual(['graph-3-step-1']);
    });

    test('should not run steps multiple times if already added from dependency', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: ['graph-1-step-3', 'graph-1-step-2'],
        }),
      ]).toEqual(['graph-1-step-2', 'graph-1-step-3']);
    });

    test('should run all steps in order', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder,
          dependencyStepIds: [
            'graph-1-step-1',
            'graph-1-step-3',
            'graph-2-step-2',
            'graph-3-step-1',
            'graph-5-step-1',
          ],
        }),
      ]).toEqual([
        'graph-1-step-1',
        'graph-1-step-2',
        'graph-1-step-3',
        'graph-2-step-1',
        'graph-2-step-2',
        'graph-3-step-1',
        'graph-5-step-1',
      ]);
    });

    test('should only run steps with dependencyGraphOrder given or default', () => {
      expect([
        ...getStepExecutionOrder({
          integrationSteps: testSteps,
          dependencyGraphOrder: ['five'],
          dependencyStepIds: [
            'graph-1-step-1',
            'graph-1-step-3',
            'graph-2-step-2',
            'graph-3-step-1',
            'graph-5-step-1',
          ],
        }),
      ]).toEqual([
        'graph-1-step-1',
        'graph-1-step-2',
        'graph-1-step-3',
        'graph-5-step-1',
      ]);
    });
  });
});
