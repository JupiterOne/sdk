import { NodePlopAPI } from 'plop';
import checkboxPlus from 'inquirer-checkbox-plus-prompt';
import path from 'path';
import { kebabCase } from 'lodash';
import { yarnFormat, yarnInstall, yarnLint } from '../generator/actions';
import { Template } from './utils/types';
import * as fs from 'fs';
import { stepTemplateHelper } from './actions/steps';
import {
  RelationshipDirection,
  generateRelationshipType,
} from '@jupiterone/integration-sdk-core';

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

function bocchi(plop: NodePlopAPI) {
  plop.setActionType('yarnFormat', yarnFormat);
  plop.setActionType('yarnInstall', yarnInstall);
  plop.setActionType('yarnLint', yarnLint);
  plop.setPrompt('checkbox-plus', checkboxPlus);
  plop.setHelper('getDirectRelationships', (step, options) => {
    return step.directRelationships.map((relationship) => {
      const step2 = options.data.root.template.steps.find(
        (s) => s.entity._type === relationship.targetType,
      );
      return {
        step,
        sourceStep:
          relationship.direction === RelationshipDirection.FORWARD
            ? step
            : step2,
        targetStep:
          relationship.direction === RelationshipDirection.FORWARD
            ? step2
            : step,
        relationshipClass: relationship._class,
        targetKey: relationship.targetKey,
        forward: relationship.direction === RelationshipDirection.FORWARD,
      };
    });
  });
  /**
   * (_class, fromType, toType) => string
   */
  plop.setHelper('getRelationshipType', generateRelationshipType);
  plop.setHelper('getParentProperties', (urlTemplate: string): string[] => {
    const regex = /%parent\.(.+?)%/g;
    return (
      Array.from(urlTemplate.matchAll(regex)).map((match) => match[1]) ?? []
    );
  });
  plop.setHelper('escape', (data) => {
    if (typeof data === 'string') {
      return "'data'";
    } else if (Array.isArray(data)) {
      return '[' + data.toString() + ']';
    } else {
      return data;
    }
  });
  plop.setHelper('sanitizeHttpMethod', (method: string = 'GET') => {
    // if the user puts nothing in request.method, we need to default to GET
    return method.toUpperCase();
  });
  plop.setHelper('sanitizeHttpBody', (body?: Record<string, any>) => {
    // if the user puts nothing in request.body, we need to default to undefined
    // additionally, because this is the string the template will use, we should
    // be literally returning the string "undefined"
    return body ?? 'undefined';
  });
  plop.setHelper(
    'createClientFunctionName',
    (entityName: string, responseType: string) => {
      if (responseType === 'SINGLETON') {
        return `get${entityName}`;
      }
      return `iterate${entityName}s`;
    },
  );

  for (const partial of fs.readdirSync(
    path.join(__dirname, 'templates/partials'),
  )) {
    plop.setPartial(
      partial.replace('.hbs', ''),
      fs.readFileSync(
        path.join(__dirname, 'templates/partials', partial),
        'utf8',
      ),
    );
  }

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

      const { templateFile } = data;

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
        data: { ...data, template }, // TODO: need to sanitize staticFields
      });

      // copy base service-client
      actions.push(() => {
        fs.copyFileSync(
          path.join(__dirname, '/service-clients/httpServiceClient.ts'),
          path.join(directoryName, path.normalize('src/httpServiceClient.ts')),
        );
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
          data: { template, step },
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

module.exports = bocchi;
