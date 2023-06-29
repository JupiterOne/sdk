import {
  generateChoicesFromEntities,
  confirmPrompt,
  askRepeatedly,
} from './util';
import { generateRelationshipType } from '@jupiterone/integration-sdk-core';
import { Entity } from './entitiesFlow';
import { Relationship } from './relationshipsFlow';

export type Step = {
  name: string;
  entities: Entity[];
  relationships: Relationship[];
  dependsOn?: string[];
};

async function stepsFlow(inquirer, entities, relationships): Promise<Step[]> {
  const steps: Step[] = [];
  const { doPrompt } = await inquirer.prompt({
    type: 'confirm',
    name: 'doPrompt',
    message: 'Do you want to declare any steps?',
  });

  if (!doPrompt) return steps;

  await askRepeatedly(inquirer, async () => {
    const step = await createStep(inquirer, entities, relationships);
    steps.push(step);
  });

  if (steps.length < 1) return steps;

  const useStepDependenciesFlow = await confirmPrompt(
    inquirer,
    'Do you want to declare any step dependencies?',
  );

  if (!useStepDependenciesFlow) return steps;

  for (const [i, step] of steps.entries()) {
    const { dependsOn } = await inquirer.prompt({
      type: 'checkbox-plus',
      name: 'dependsOn',
      message: `Which steps does '${step.name}' directly depend on?`,
      searchable: true,
      pageSize: 10,
      validate(input) {
        return true;
      },
      source(ans, input) {
        return new Promise((resolve) => {
          const choices = choicesWithoutSelf(steps, i);
          if (input) {
            const filteredChoices = searchSteps(steps, input);
            resolve(filteredChoices);
          } else {
            resolve(choices);
          }
        });
      },
    });

    step.dependsOn = dependsOn;
  }

  return steps;
}

function choicesWithoutSelf(steps: Step[], stepIndex) {
  return steps
    .filter((_, ix) => ix !== stepIndex)
    .map((v) => ({ name: v.name, value: v.name }));
}

function searchSteps(steps: Step[], searchString: string) {
  return steps.filter((v) =>
    v.name.toLowerCase().includes(searchString.toLowerCase()),
  );
}

async function createStep(inquirer, entities, relationships) {
  const { name } = await inquirer.prompt({
    type: 'input',
    name: 'name',
    message: 'What should the steps name be?',
  });

  const { stepEntities } = await inquirer.prompt({
    type: 'checkbox',
    name: 'stepEntities',
    message: 'What entities will this step produce?',
    choices: generateChoicesFromEntities(entities),
  });

  const { stepRelationships } = await inquirer.prompt({
    type: 'checkbox',
    name: 'stepRelationships',
    message: 'What relationships will this step produce?',
    choices: generateRelationshipChoices(relationships),
  });

  return {
    name,
    entities: stepEntities,
    relationships: stepRelationships,
  };
}

function generateRelationshipChoices(relationships) {
  const choices: { name: string; value: Relationship }[] = [];

  for (const rel of relationships) {
    choices.push({
      name: generateRelationshipType(rel._class, rel.from, rel.to),
      value: rel,
    });
  }

  return choices;
}

export { stepsFlow };
