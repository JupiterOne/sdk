import { organizationSteps } from './fetch-organizations';
import { userSteps } from './fetch-users';
import { firewallSteps } from './fetch-firewalls';

const integrationSteps = [...organizationSteps, ...userSteps, ...firewallSteps];

export { integrationSteps };
