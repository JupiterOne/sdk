import { NodePlopAPI } from 'plop';
import checkboxPlus from 'inquirer-checkbox-plus-prompt';
import path from 'path';
import { kebabCase } from 'lodash';
import { yarnFormat, yarnInstall, yarnLint } from '../generator/actions';
import { Template } from './utils/types';
import * as fs from 'fs';
import { stepTemplateHelper } from './actions/steps';

/**
 * Output folder (output/)
 * graph-<NAME>/
 *   docs/
 *   jupiterone/
 *   src/
 *     steps/
 *       fetch-users/
 *         - index.ts
 *         - index.test.ts
 *       fetch-groups/
 *         - index.ts
 *       constants.ts
 *       converters.ts
 *       index.ts
 *     client.ts
 *     config.ts
 *     index.ts
 *     types.ts
 *   test/
 *  .gitignore
 */

// ./packages/integration-sdk-cli/src/bocchi/templates/semgrep.json

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

      const {
        // vendorName,
        // packageName,
        // packageDescription,
        templateFile,
      } = data;

      // @jupiterone/graph-foo -> graph-foo
      // graph-foo -> graph-foo
      const directoryName = path.join(
        process.cwd(),
        path.basename(data.packageName),
      );

      const template: Template = JSON.parse(
        fs.readFileSync(templateFile, 'utf8'),
      );

      const actions: any[] = [];

      // TODO: after this, remove .hbs from files with no extension
      actions.push({
        type: 'addMany',
        destination: directoryName,
        base: path.join(__dirname, '/templates/other/top-level'),
        templateFiles: path.join(__dirname + '/templates/other/top-level/**'),
        globOptions: { dot: true },
        force: true,
        data,
      });

      actions.push({
        type: 'addMany',
        destination: path.join(directoryName, path.normalize('src')),
        base: path.join(__dirname, '/templates/other/src'),
        templateFiles: path.join(__dirname + '/templates/other/src/**'),
        globOptions: { dot: true },
        force: true,
        data: template, // TODO: need to sanitize staticFields
      });

      for (const step of template.steps) {
        const { stepTemplateFile } = stepTemplateHelper(step);
        actions.push({
          type: 'add',
          path: path.join(
            directoryName,
            path.normalize(`src/steps/${kebabCase(step.id)}/index.ts`),
          ),
          templateFile: path.join(
            __dirname,
            `templates/steps/${stepTemplateFile}`,
          ),
          data: step,
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