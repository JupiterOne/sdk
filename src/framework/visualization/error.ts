import { IntegrationError } from '../execution/error';

export class IntegrationMissingCollectJSON extends Error
  implements IntegrationError {
  code = 'MissingCollectJSON';
}
