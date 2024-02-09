import { organizationSteps } from './steps/fetch-organizations';
import { userSteps } from './steps/fetch-users';
import { firewallSteps } from './steps/fetch-firewalls';

const integrationSteps = [...organizationSteps, ...userSteps, ...firewallSteps];

export { integrationSteps };
