import { entitiesFlow } from './entitiesFlow';
import { relationshipsFlow } from './relationshipsFlow';
import { configFieldsFlow } from './configFieldsFlow';
import { stepsFlow } from './stepsFlow';
import { generateRelationshipName } from './helpers';
import { generateRelationshipType } from '@jupiterone/integration-sdk-core';
import { yarnFormat, yarnInstall, yarnLint } from './actions';
import { kebabCase } from 'lodash';
import checkboxPlus from 'inquirer-checkbox-plus-prompt';
import path from 'path';

import { NodePlopAPI } from 'plop';
import { Relationship } from './relationshipsFlow';
import { Step } from './stepsFlow';

function newIntegration(plop: NodePlopAPI) {
  plop.setHelper('generateRelationshipType', function (this: any) {
    return generateRelationshipType(this._class, this.from, this.to);
  });

  plop.setHelper('generateRelationshipName', generateRelationshipName);
  plop.setActionType('yarnFormat', yarnFormat);
  plop.setActionType('yarnInstall', yarnInstall);
  plop.setActionType('yarnLint', yarnLint);
  plop.setPrompt('checkbox-plus', checkboxPlus);

  plop.setGenerator('new:integration', {
    description: 'Create a new integration',
    prompts: async function (inquirer) {
      const { vendorName } = await inquirer.prompt({
        type: 'input',
        name: 'vendorName',
        message:
          'The integration vendor name (ex. AWS, Google Workspace, CrowdStrike)',
        validate(input) {
          if (!input) {
            return 'Cannot be an empty string';
          }
          return true;
        },
      });

      const { packageName } = await inquirer.prompt({
        type: 'input',
        name: 'packageName',
        default: `@jupiterone/graph-${kebabCase(vendorName)}`,
        message: 'The npm package name',
        validate(input) {
          if (!input) {
            return 'Cannot be an empty string';
          }
          return true;
        },
      });

      const { packageDescription } = await inquirer.prompt({
        type: 'input',
        name: 'packageDescription',
        message: 'A description for package',
        default: `An integration and graph conversion project for ${vendorName}`,
        validate(input) {
          if (!input) {
            return 'Cannot be an empty string';
          }
          return true;
        },
      });

      const configFields = await configFieldsFlow(inquirer);
      const entities = await entitiesFlow(inquirer, vendorName);
      let relationships: Relationship[] = [];
      let steps: Step[] = [];
      if (entities.length) {
        relationships = await relationshipsFlow(inquirer, entities);
        steps = await stepsFlow(inquirer, entities, relationships);
      }

      return {
        vendorName,
        packageName,
        packageDescription,
        configFields,
        entities,
        relationships,
        steps,
      };
    },
    actions: function (data) {
      if (!data) {
        return [];
      }

      // @jupiterone/graph-foo -> graph-foo
      // graph-foo -> graph-foo
      const directoryName = path.join(
        process.cwd(),
        path.basename(data.packageName),
      );

      const actions: any[] = [];
      actions.push({
        type: 'addMany',
        destination: directoryName,
        base: path.join(__dirname, '/template'),
        templateFiles: path.join(__dirname + '/template/**'),
        globOptions: { dot: true },
        force: true,
        data,
      });

      for (const step of data.steps) {
        actions.push({
          type: 'add',
          path: path.join(
            directoryName,
            path.normalize(`src/steps/${kebabCase(step.name)}/index.ts`),
          ),
          templateFile: path.join(__dirname, 'stepTemplate/index.ts.hbs'),
          data: step,
          force: true,
        });
      }

      actions.push({
        type: 'yarnInstall',
        path: directoryName,
        verbose: true,
      });

      actions.push({
        type: 'yarnFormat',
        path: directoryName,
        verbose: true,
      });

      actions.push({
        type: 'yarnLint',
        path: directoryName,
        verbose: true,
      });

      return actions;
    },
  });
}

module.exports = newIntegration;
