import { NodePlopAPI } from 'plop';
import checkboxPlus from 'inquirer-checkbox-plus-prompt';
import path from 'path';
import { kebabCase } from 'lodash';
import { yarnFormat, yarnInstall, yarnLint } from './actions';
import { Template } from '../project-bocchi/utils/types';
import * as fs from 'fs';

function bocchi(plop: NodePlopAPI) {
  plop.setActionType('yarnFormat', yarnFormat);
  plop.setActionType('yarnInstall', yarnInstall);
  plop.setActionType('yarnLint', yarnLint);
  plop.setPrompt('checkbox-plus', checkboxPlus);

  plop.setGenerator('bocchi', {
    description: 'Create a new integration graph project',
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

      const { templateFile } = await inquirer.prompt({
        type: 'input',
        name: 'templateFile',
        message: 'Template file for the integration',
        validate(input) {
          if (!input) {
            return 'Cannot be an empty string';
          }
          return true;
        },
      });

      return {
        vendorName,
        packageName,
        packageDescription,
        templateFile,
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

      const template: Template = JSON.parse(
        fs.readFileSync(data.templateFile, 'utf8'),
      );

      for (const step of template.steps) {
        const nicksSweetObj = {
          stepId: step.id,
          stepName: step.name,
          entityName: 'TEST',
          apiCall: true,
          dependsOn: step.dependsOn ?? [],
        };

        actions.push({
          type: 'add',
          path: path.join(
            directoryName,
            path.normalize(`src/steps/${kebabCase(step.id)}/index.ts`),
          ),
          templateFile: path.join(
            __dirname,
            'bocchi-templates/singleton.ts.hbs',
          ),
          data: nicksSweetObj,
          force: true,
        });
      }

      // actions.push({
      //   type: 'yarnInstall',
      //   path: directoryName,
      //   verbose: true,
      // });

      // actions.push({
      //   type: 'yarnFormat',
      //   path: directoryName,
      //   verbose: true,
      // });

      // actions.push({
      //   type: 'yarnLint',
      //   path: directoryName,
      //   verbose: true,
      // });

      return actions;
    },
  });
}

module.exports = bocchi;
