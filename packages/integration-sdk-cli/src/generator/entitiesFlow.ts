import { askRepeatedly } from './util';
import { snakeCase } from 'lodash';

export type Entity = {
  resourceName: string;
  _type: string;
  _class: string[];
};

async function entitiesFlow(inquirer, vendorName): Promise<Entity[]> {
  const entities: Entity[] = [];
  const { doPrompt } = await inquirer.prompt({
    type: 'confirm',
    name: 'doPrompt',
    message: 'Do you want to declare entities?',
  });
  if (!doPrompt) return entities;

  await askRepeatedly(inquirer, async () => {
    const entity = await createEntityPrompt(inquirer, vendorName);
    entities.push(entity);
  });
  return entities;
}

async function createEntityPrompt(inquirer, vendorName) {
  const { resourceName } = await inquirer.prompt({
    type: 'input',
    name: 'resourceName',
    message:
      'What is the name of the entity? ex. User, EC2 Instance, Access Key',
  });

  const { _class } = await inquirer.prompt({
    type: 'checkbox-plus',
    name: '_class',
    message: 'Which classes should the entity have?',
    searchable: true,
    pageSize: 10,
    validate(input) {
      if (input?.length > 0) {
        return true;
      } else {
        return false;
      }
    },
    source: function (ans, input) {
      return new Promise((resolve) => {
        if (!input) {
          resolve(entityClassesChoices);
          return;
        } else {
          const choices = entityClassesChoices.filter(({ name }) =>
            name.toLowerCase().includes(input.toLowerCase()),
          );
          resolve(choices);
        }
      });
    },
  });

  const { _type } = await inquirer.prompt({
    Type: 'input',
    name: '_type',
    message: 'What should the _type be?',
    default: `${snakeCase(vendorName)}_${snakeCase(resourceName)}`,
    validate(input) {
      const valid = /^[a-z0-9_]+$/.test(input);
      if (!valid) {
        return '_type must be lowercased, alphanumeric, and use underscores for spacing';
      }
      return valid;
    },
  });

  return {
    resourceName,
    _type,
    _class,
  };
}

const entityClassesChoices = [
  { name: 'AccessKey' },
  { name: 'AccessPolicy' },
  { name: 'AccessRole' },
  { name: 'Account' },
  { name: 'Alert' },
  { name: 'Application' },
  { name: 'ApplicationEndpoint' },
  { name: 'Assessment' },
  { name: 'Attacker' },
  { name: 'Backup' },
  { name: 'Certificate' },
  { name: 'Channel' },
  { name: 'Cluster' },
  { name: 'CodeCommit' },
  { name: 'CodeDeploy' },
  { name: 'CodeModule' },
  { name: 'CodeRepo' },
  { name: 'CodeReview' },
  { name: 'Configuration' },
  { name: 'Container' },
  { name: 'Control' },
  { name: 'ControlPolicy' },
  { name: 'CryptoKey' },
  { name: 'DataCollection' },
  { name: 'DataObject' },
  { name: 'DataStore' },
  { name: 'Database' },
  { name: 'Deployment' },
  { name: 'Device' },
  { name: 'Directory' },
  { name: 'Disk' },
  { name: 'Document' },
  { name: 'Domain' },
  { name: 'DomainRecord' },
  { name: 'DomainZone' },
  { name: 'Entity' },
  { name: 'Finding' },
  { name: 'Firewall' },
  { name: 'Framework' },
  { name: 'Function' },
  { name: 'Gateway' },
  { name: 'GraphObject' },
  { name: 'Group' },
  { name: 'Host' },
  { name: 'HostAgent' },
  { name: 'Image' },
  { name: 'Incident' },
  { name: 'Internet' },
  { name: 'IpAddress' },
  { name: 'Issue' },
  { name: 'Key' },
  { name: 'Logs' },
  { name: 'Model' },
  { name: 'Module' },
  { name: 'Network' },
  { name: 'NetworkEndpoint' },
  { name: 'NetworkInterface' },
  { name: 'Organization' },
  { name: 'PR' },
  { name: 'PasswordPolicy' },
  { name: 'Person' },
  { name: 'Policy' },
  { name: 'Problem' },
  { name: 'Procedure' },
  { name: 'Process' },
  { name: 'Product' },
  { name: 'Program' },
  { name: 'Project' },
  { name: 'Question' },
  { name: 'Queue' },
  { name: 'Record' },
  { name: 'RecordEntity' },
  { name: 'Repository' },
  { name: 'Requirement' },
  { name: 'Resource' },
  { name: 'Review' },
  { name: 'Risk' },
  { name: 'Root' },
  { name: 'Rule' },
  { name: 'Ruleset' },
  { name: 'Scanner' },
  { name: 'Secret' },
  { name: 'Section' },
  { name: 'Service' },
  { name: 'Site' },
  { name: 'Standard' },
  { name: 'Subscription' },
  { name: 'Task' },
  { name: 'Team' },
  { name: 'ThreatIntel' },
  { name: 'Training' },
  { name: 'User' },
  { name: 'UserGroup' },
  { name: 'Vault' },
  { name: 'Vendor' },
  { name: 'Vulnerability' },
  { name: 'Weakness' },
  { name: 'Workflow' },
  { name: 'Workload' },
].map((v) => ({ name: v.name, value: v.name }));

export { entitiesFlow };
