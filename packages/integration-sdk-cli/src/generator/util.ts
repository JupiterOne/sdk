import { Entity } from './entitiesFlow';

async function askRepeatedly<T>(
  inquirer,
  cb: () => Promise<void>,
): Promise<void> {
  let again = false;
  do {
    await cb();
    again = await askAgain(inquirer);
  } while (again);
}

function generateChoicesFromEntities(entities) {
  const choices: { name: string; value: Entity }[] = [];
  for (const entity of entities) {
    choices.push({
      name: entity._type,
      value: entity,
    });
  }
  return choices;
}

async function confirmPrompt(inquiurer, message) {
  return (
    await inquiurer.prompt({
      type: 'confirm',
      name: 'value',
      message,
    })
  ).value;
}

async function askAgain(inquirer) {
  return await confirmPrompt(inquirer, 'Add another?');
}

export { askAgain, askRepeatedly, confirmPrompt, generateChoicesFromEntities };
