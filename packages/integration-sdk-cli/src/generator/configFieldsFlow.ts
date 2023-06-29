import { askRepeatedly } from './util';

type FieldType = 'json' | 'string' | 'boolean';

async function configFieldsFlow(inquirer) {
  const configFields: { field: string; type: FieldType; mask: boolean }[] = [];

  const { doPrompt } = await inquirer.prompt({
    type: 'confirm',
    name: 'doPrompt',
    message: 'Do you want to add config fields?',
  });

  if (!doPrompt) return configFields;

  await askRepeatedly(inquirer, async () => {
    const configField = await configFieldPrompt(inquirer);
    configFields.push(configField);
  });

  return configFields;
}

async function configFieldPrompt(inquirer) {
  const { field } = await inquirer.prompt({
    type: 'input',
    name: 'field',
    message: 'The config field name (ex. apiKey)',
  });

  const { type } = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'The type of the config field',
    choices: [
      {
        name: 'string',
        value: 'string',
      },
      {
        name: 'boolean',
        value: 'boolean',
      },
      {
        name: 'json',
        value: 'json',
      },
    ],
  });

  const { mask } = await inquirer.prompt({
    name: 'mask',
    type: 'confirm',
    message: 'Should the field be masked?',
  });

  return { field, type, mask };
}

export { configFieldsFlow };
