import {
  createIntegrationInstanceForLocalExecution,
  prepareLocalStepCollection,
} from '@jupiterone/integration-sdk-runtime';
import { exec } from 'child_process';
import * as log from '../log';
import path from 'path';
import { loadConfig } from '../config';
import urlExists from 'url-exists';
import * as fs from 'fs';

export async function executeWithLogging(command: string) {
  return new Promise<void>((resolve, reject) => {
    const childProcess = exec(command);

    if (childProcess.stdout) {
      childProcess.stdout.pipe(process.stdout);
    }

    childProcess.on('exit', () => {
      resolve();
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

export async function executeValidateAuthentication(directory: string) {
  log.info(`Checking authentication using values in .env file`);
  try {
    const config = prepareLocalStepCollection(
      await loadConfig(path.join(directory, 'src')),
    );

    await import(`${directory}/src/index`).then(
      async ({ invocationConfig }) => {
        await invocationConfig.validateInvocation({
          instance: createIntegrationInstanceForLocalExecution(config),
        });
      },
    );
  } catch (err) {
    log.info(`Call to validateInvocation failed.`);
    log.info(JSON.stringify(err));
    if (err.endpoint) {
      endpointCheck(err.endpoint);
    }
  }
}

export function endpointCheck(url: string) {
  log.info(`Checking availability of endpoint ${url}`);
  try {
    urlExists(url, function (err, exists) {
      if (exists) {
        log.info(`Endpoint can be successfully reached.`);
      } else {
        log.info(
          `Checking availability of endpoint with certificate verification disabled.`,
        );
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        urlExists(url, function (err, exists) {
          if (exists) {
            log.info(
              `Endpoint can be successfully reached only after disabling TLS certificate validation.`,
            );
          } else {
            log.info(`Endpoint is unreachable`);
          }
        });
      }
    });
  } catch (err) {
    log.info(err);
  }
}

export function getVersions(path: string) {
  log.info(`Checking versions from ${path}/package.json`);

  try {
    const packages = JSON.parse(
      fs.readFileSync(`${path}/package.json`, 'utf8'),
    );

    log.info(`Main package name:  ${packages.name}`);
    log.info(`Main package version:  ${packages.version}`);
    if (packages.dependencies) {
      log.info(`Dependencies:  ${JSON.stringify(packages.dependencies)}`);
    }
    if (packages.peerDependencies) {
      log.info(
        `Peer Dependencies:  ${JSON.stringify(packages.peerDependencies)}`,
      );
    }
    if (packages.devDependencies) {
      log.info(
        `Development Dependencies:  ${JSON.stringify(
          packages.devDependencies,
        )}`,
      );
    }
  } catch (err) {
    log.info(
      `An error occurred when trying to read package information from ${path}/package.json`,
    );
  }
}
