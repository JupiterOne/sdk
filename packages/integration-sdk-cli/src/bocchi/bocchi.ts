import { NodePlopAPI } from 'plop';
import checkboxPlus from 'inquirer-checkbox-plus-prompt';
import path from 'path';
import { kebabCase } from 'lodash';
import {
  yarnFormat,
  yarnInstall,
  yarnLint,
  j1Document,
} from '../generator/actions';
import { Template } from './utils/types';
import * as fs from 'fs';
import { stepTemplateHelper } from './actions/steps';
import {
  IntegrationInstanceConfigFieldMap,
  RelationshipDirection,
  generateRelationshipType,
} from '@jupiterone/integration-sdk-core';

function bocchi(plop: NodePlopAPI) {
  plop.setActionType('yarnFormat', yarnFormat);
  plop.setActionType('yarnInstall', yarnInstall);
  plop.setActionType('yarnLint', yarnLint);
  plop.setActionType('j1Document', j1Document);
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
  plop.setHelper('getStepByType', (type, options) => {
    return options.data.root.template.steps.find(
      (s) => s.entity._type === type,
    );
  });
  /**
   * (_class, fromType, toType) => string
   */
  plop.setHelper('getRelationshipType', generateRelationshipType);
  plop.setHelper('sanitizeUrlPath', (urlTemplate: string): string => {
    const regex = /%parent\.(.+?)%/g;
    for (const match of urlTemplate.matchAll(regex)) {
      urlTemplate = urlTemplate.replace(
        match[0],
        '${parentEntity.' + match[1] + '}',
      );
    }
    // looks at the urlTemplate provided and replaces "%nextToken%" with "${nextToken}",
    // which is the string the client file will use to reference the nextToken
    return urlTemplate.replace('%nextToken%', '${nextToken}');
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
  plop.setHelper('sanitizeHttpMethod', (method: string = 'GET'): string => {
    // if the user puts nothing in request.method, we need to default to GET
    return method.toUpperCase();
  });
  plop.setHelper(
    'sanitizeHttpBody',
    (body: Record<string, any>): Record<string, any> => {
      // Also, we need to check if the body contains "%nextToken%" and replace it with
      // "nextToken" since that is the var in the client file that references the nextToken.
      for (const key in body) {
        if (typeof body[key] === 'string') {
          body[key] = body[key].replace('%nextToken%', '${nextToken}');
        }
      }
      return body;
    },
  );
  plop.setHelper('isSingletonRequest', (responseType: string): boolean => {
    return responseType === 'SINGLETON';
  });
  plop.setHelper('configTypeToType', (type: string) => {
    if (type.toLowerCase() === 'json') {
      return 'Record<string, any>';
    }
    return type;
  });
  plop.setHelper(
    'requiredConfig',
    (configFields: IntegrationInstanceConfigFieldMap) => {
      return Object.entries(configFields)
        .filter(([_, value]) => !value.optional)
        .map(([key, _]) => key);
    },
  );
  plop.setHelper('isNotEndpointAuth', (authStrategy: string): boolean => {
    return authStrategy !== 'endpoint';
  });
  plop.setHelper(
    'sanitizeAuthObject',
    (authObj: Record<string, any>): Record<string, any> => {
      const regex = /%(response|config)\.(.+?)%/g;
      for (const key in authObj) {
        if (typeof authObj[key] === 'string') {
          for (const match of authObj[key].matchAll(regex)) {
            authObj[key] = authObj[key].replace(
              match[0],
              '${' +
                (match[1] === 'config' ? 'this.' : '') +
                match[1] +
                '.' +
                match[2] +
                '}',
            );
          }
        }
      }
      return authObj;
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

      actions.push({
        type: 'addMany',
        destination: directoryName,
        base: path.join(__dirname, '/templates/top-level'),
        templateFiles: path.join(__dirname + '/templates/top-level/**'),
        globOptions: { dot: true },
        force: true,
        data: { ...data, template },
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

        actions.push({
          type: 'add',
          path: path.join(
            directoryName,
            path.normalize(`src/steps/${kebabCase(step.id)}/index.test.ts`),
          ),
          templateFile: path.join(
            __dirname,
            `templates/steps/index.test.ts.hbs`,
          ),
          data: { template, step },
          force: true,
        });

        actions.push({
          type: 'add',
          path: path.join(
            directoryName,
            path.normalize(`docs/spec/${kebabCase(step.id)}/index.ts`),
          ),
          templateFile: path.join(__dirname, `templates/steps/spec.ts.hbs`),
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
        type: 'j1Document',
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
