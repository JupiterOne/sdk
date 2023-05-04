import { askRepeatedly, generateChoicesFromEntities } from './util';
import { RelationshipClass } from '@jupiterone/data-model';

export type Relationship = {
  from: any;
  to: any;
  _class: any;
};

async function relationshipsFlow(inquirer, entities): Promise<Relationship[]> {
  const relationships: Relationship[] = [];
  const { doPrompt } = await inquirer.prompt({
    type: 'confirm',
    name: 'doPrompt',
    message: 'Do you want to add relationships?',
  });
  if (!doPrompt) return relationships;

  const entityChoices = generateChoicesFromEntities(entities);
  await askRepeatedly(inquirer, async () => {
    const relationship = await createRelationship(inquirer, entityChoices);
    relationships.push(relationship);
  });
  return relationships;
}

async function createRelationship(inquirer, entityChoices) {
  const { from } = await inquirer.prompt({
    type: 'list',
    name: 'from',
    message: 'What entity should the relationship be from?',
    choices: entityChoices,
    pageSize: entityChoices.length,
  });

  const { to } = await inquirer.prompt({
    type: 'list',
    name: 'to',
    message: 'What entity should the relationship be to?',
    choices: entityChoices,
    pageSize: entityChoices.length,
  });

  const { _class } = await inquirer.prompt({
    type: 'list',
    name: '_class',
    message: 'What should the _class be?',
    choices: relationshipClassChoices(),
    pageSize: 10,
  });

  return { from, to, _class };
}

function relationshipClassChoices() {
  const choices: { name: string; value: string }[] = [];
  for (const [name, value] of Object.entries(RelationshipClass)) {
    choices.push({
      name,
      value,
    });
  }
  choices.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    } else {
      return 1;
    }
  });
  return choices;
}

export { relationshipsFlow };
