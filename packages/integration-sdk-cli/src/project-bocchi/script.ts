import yargs from 'yargs';
import * as fs from 'fs';
import { Template, Step } from './utils/types';

export function run() {
  const input = yargs
    .option('h', {
      alias: 'help',
      type: 'boolean',
    })
    .option('template', {
      type: 'string',
      demandOption: true,
    }).argv as {
    help?: boolean;
    templateFile?: string;
    _: string[];
  };

  const { templateFile } = input;

  if (input.help || !templateFile) {
    return yargs.showHelp();
  }

  const template: Template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));

  // TODO: check format of template

  // TODO: can build validate invocation - if fields are required and not there throw

  const instanceConfig = template.instanceConfigFields;

  for (const step of template.steps) {
    transformInput(step);
    // copy/paste with
  }
}

// TODO: make type for stepData - in docs, template should adhere to this
function transformInput(step: Step) {
  const { stepId, stepName } = step;

  return {
    stepIdCamelCase: stepId,
    stepIdUpperSnakeCase: stepId.toUpperCase().replace(/-/g, '_'),
    stepName,
  };
}
