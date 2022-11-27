import {
  createDirectRelationship,
  Entity,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  Relationship,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';
import { randomUUID as uuid } from 'crypto';
import { executeStepWithDependencies } from '../executeStepWithDependencies';
import { getMockIntegrationStep } from '@jupiterone/integration-sdk-private-test-utils';

function getMockInvocationConfig(
  config?: Partial<IntegrationInvocationConfig>,
): IntegrationInvocationConfig {
  return {
    integrationSteps: [],
    ...config,
  };
}

function getMockInstanceConfig(
  config?: Partial<IntegrationInstanceConfig>,
): IntegrationInstanceConfig {
  return {
    ...config,
  };
}

function getMockEntity(e?: Partial<Entity>): Entity {
  return {
    _class: 'Record',
    _type: 'entity-type',
    _key: uuid(),
    ...e,
  };
}

describe('executeStepWithDependencies', () => {
  describe('invalid step', () => {
    test('should fail if step `id` property does not exist in dependency graph', async () => {
      await expect(
        executeStepWithDependencies({
          stepId: 'invalid-id',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [getMockIntegrationStep({ id: 'valid-id' })],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).rejects.toThrow('Node does not exist: invalid-id');
    });
  });

  describe('invalid invocationConfig', () => {
    test('should fail if `step.dependencyGraphId` property is present', async () => {
      await expect(
        executeStepWithDependencies({
          stepId: 'step-1',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({
                id: 'step-1',
                dependencyGraphId: 'last',
              }),
            ],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).rejects.toThrow(
        'stepId: "step-1" has dependencyGraphId: "last" but dependencyStepIds is undefined.',
      );
    });

    test('should fail if invocationConfig contains circular dependency', async () => {
      await expect(
        executeStepWithDependencies({
          stepId: 'step-1',
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [
              getMockIntegrationStep({ id: 'step-1', dependsOn: ['step-2'] }),
              getMockIntegrationStep({ id: 'step-2', dependsOn: ['step-1'] }),
            ],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).rejects.toThrow('Dependency Cycle Found: step-1 -> step-2 -> step-1');
    });
  });

  describe('success', () => {
    test('should return entities, relationships, and data', async () => {
      const e1 = getMockEntity();
      const e2 = getMockEntity();

      const r1 = createDirectRelationship({
        from: e1,
        _class: RelationshipClass.HAS,
        to: e2,
      });

      const d1 = { key: 'value' };

      const stepOne = getMockIntegrationStep({
        id: 'step-1',
        executionHandler: async ({ jobState }) => {
          await jobState.addEntity(e1);
          await jobState.addEntity(e2);
          await jobState.addRelationship(r1);
          await jobState.setData(Object.keys(d1)[0], Object.values(d1)[0]);
        },
      });

      await expect(
        executeStepWithDependencies({
          stepId: stepOne.id,
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [stepOne],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).resolves.toMatchObject({
        collectedEntities: [e1, e2],
        collectedRelationships: [r1],
        collectedData: d1,
      });
    });

    test('should not expose entities or relationships from previous steps', async () => {
      const entityType = 'entity-type';
      const e1 = getMockEntity({ _type: entityType });
      const e2 = getMockEntity({ _type: entityType });

      const relationshipType = 'relationship-type';
      const r1 = createDirectRelationship({
        from: e1,
        _class: RelationshipClass.HAS,
        to: e2,
        properties: { _type: relationshipType },
      });

      const stepOne = getMockIntegrationStep({
        id: 'step-1',
        executionHandler: async ({ jobState }) => {
          await jobState.addEntity(e1);
          await jobState.addEntity(e2);
          await jobState.addRelationship(r1);
        },
      });

      let stepTwoExecutionHandlerDidExecute = false;
      const stepTwo = getMockIntegrationStep({
        id: 'step-2',
        dependsOn: ['step-1'],
        executionHandler: async ({ jobState }) => {
          const entities: Entity[] = [];
          await jobState.iterateEntities({ _type: entityType }, (e) => {
            entities.push(e);
          });
          expect(entities).toMatchObject([e1, e2]);
          const relationships: Relationship[] = [];
          await jobState.iterateRelationships(
            { _type: relationshipType },
            (r) => {
              relationships.push(r);
            },
          );
          expect(relationships).toMatchObject([r1]);
          stepTwoExecutionHandlerDidExecute = true;
        },
      });

      await expect(
        executeStepWithDependencies({
          stepId: stepTwo.id,
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [stepOne, stepTwo],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).resolves.toMatchObject({
        collectedEntities: [],
        collectedRelationships: [],
      });

      expect(stepTwoExecutionHandlerDidExecute).toBe(true);
    });

    test('should allow step to access data from previous step', async () => {
      const setDataKey = 'set-data-key';
      const setDataValue = 'set-data-value';
      const stepOne = getMockIntegrationStep({
        id: 'step-1',
        executionHandler: async ({ jobState }) => {
          await jobState.setData(setDataKey, setDataValue);
        },
      });

      let stepTwoExecutionHandlerDidExecute = false;
      const stepTwo = getMockIntegrationStep({
        id: 'step-2',
        dependsOn: ['step-1'],
        executionHandler: async ({ jobState }) => {
          const getDataValue = await jobState.getData(setDataKey);
          expect(getDataValue).toBe(setDataValue);
          stepTwoExecutionHandlerDidExecute = true;
        },
      });

      await expect(
        executeStepWithDependencies({
          stepId: stepTwo.id,
          invocationConfig: getMockInvocationConfig({
            integrationSteps: [stepOne, stepTwo],
          }),
          instanceConfig: getMockInstanceConfig(),
        }),
      ).resolves.toMatchObject({
        collectedEntities: [],
        collectedRelationships: [],
      });

      expect(stepTwoExecutionHandlerDidExecute).toBe(true);
    });
  });
});
