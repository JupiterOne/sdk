import * as log from '../log';
import * as os from 'os';
import {
  executeValidateAuthentication,
  executeWithLogging,
  getVersions,
} from './utils';

// Check items that our integrations aren't already checking or items
// that would normally be checked or handled by the managed execution
// in JupiterOne
export async function troubleshoot(options) {
  log.info(`Troubleshooting code found at ${options.projectPath}`);

  log.info(`Checking Operating System Information`);
  log.info(`OS Architecture:  ${os.arch()}`);
  log.info(`OS Platform:  ${os.platform()}`);
  log.info(`OS Version:  ${os.version()}`);

  log.info(`Checking Node version: ${process.version}`);
  // Check versions of packages (SDK, graph project, ) and suggest that they upgrade if it is out of date
  getVersions(options.projectPath);

  log.info(`Checking for Docker Info`);
  await executeWithLogging('docker info');

  // Check authentication.  If this fails, we will also check if it
  // might be due to missing or self signed certs
  await executeValidateAuthentication(options.projectPath);
}

// TODO (adam-in-ict) In the future, possibly run this every time it is run outside the managed environment?

// TODO (adam-in-ict) Should we add a preamble to every execution that shows SDK version and graph- project?
