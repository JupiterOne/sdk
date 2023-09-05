import {
  DEFAULT_UPLOAD_BATCH_SIZE,
  getAccountFromEnvironment,
  getApiKeyFromEnvironment,
  JUPITERONE_DEV_API_BASE_URL,
  JUPITERONE_PROD_API_BASE_URL,
} from '@jupiterone/integration-sdk-runtime';
import { Command, Option, OptionValues } from 'commander';
import path from 'path';

export function addLoggingOptions(command: Command) {
  return command.option('--noPretty', 'disable pretty logging', false);
}

export interface PathOptions {
  projectPath: string;
}

export function addPathOptionsToCommand(command: Command): Command {
  return command.option(
    '-p, --project-path <directory>',
    'path to integration project directory',
    process.cwd(),
  );
}

/**
 * Configure the filesystem interaction code to function against `${options.projectPath}/.j1-integration by setting the
 * global `process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY` variable.
 */
export function configureRuntimeFilesystem(options: PathOptions): void {
  process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = path.resolve(
    options.projectPath,
    '.j1-integration',
  );
}

export interface SyncOptions {
  source: 'integration-managed' | 'integration-external' | 'api';
  scope?: string | undefined;
  integrationInstanceId?: string | undefined;
  uploadBatchSize: number;
  uploadRelationshipBatchSize: number;
  skipFinalize: boolean;
}

export function addSyncOptionsToCommand(command: Command): Command {
  return command
    .option(
      '-i, --integrationInstanceId <id>',
      '_integrationInstanceId assigned to uploaded entities and relationships',
    )
    .option(
      '--source <integration-managed|integration-external|api>',
      'specify synchronization job source value',
      (value: string) => {
        if (
          value !== 'integration-managed' &&
          value !== 'integration-external' &&
          value !== 'api'
        ) {
          throw new Error(
            `--source must be one of "integration-managed", "integration-external", or "api"`,
          );
        } else {
          return value;
        }
      },
      'integration-managed',
    )
    .option('--scope <anystring>', 'specify synchronization job scope value')
    .option(
      '-u, --upload-batch-size <number>',
      'specify number of entities and relationships per upload batch',
      (value, _previous: Number) => Number(value),
      DEFAULT_UPLOAD_BATCH_SIZE,
    )
    .option(
      '-ur, --upload-relationship-batch-size <number>',
      'specify number of relationships per upload batch, overrides --upload-batch-size',
      (value, _previous: Number) => Number(value),
      DEFAULT_UPLOAD_BATCH_SIZE,
    )
    .option(
      '--skip-finalize',
      'skip synchronization finalization to leave job open for additional uploads',
      false,
    );
}

/**
 * Validates options for the synchronization job.
 *
 * @throws {Error} if --source is "api" and --scope is not specified
 * @throws {Error} if --source is "api" and --integrationInstanceId is specified
 * @throws {Error} if one of --integrationInstanceId or --source is not specified
 */
export function validateSyncOptions(options: SyncOptions): SyncOptions {
  if (options.source === 'api') {
    if (options.integrationInstanceId)
      throw new Error(
        'Invalid configuration supplied. Cannot specify both --source api and --integrationInstanceId flags.',
      );
    if (!options.scope)
      throw new Error(
        'Invalid configuration supplied. --source api requires --scope flag.',
      );
  } else if (
    !['integration-managed', 'integration-external'].includes(options.source)
  ) {
    throw new Error(
      `Invalid configuration supplied. --source must be one of: integration-managed, integration-external, api. Received: ${options.source}.`,
    );
  } else if (!options.integrationInstanceId) {
    throw new Error(
      'Invalid configuration supplied. --integrationInstanceId or --source api and --scope required.',
    );
  }
  return options;
}

/**
 * Returns an object containing only `SyncOptions` properties. This helps to ensure other properties of `OptionValues` are not passed to the `SynchronizationJob`.
 */
export function getSyncOptions(options: OptionValues): SyncOptions {
  return {
    source: options.source,
    scope: options.scope,
    integrationInstanceId: options.integrationInstanceId,
    uploadBatchSize: options.uploadBatchSize,
    uploadRelationshipBatchSize: options.uploadRelationshipBatchSize,
    skipFinalize: options.skipFinalize,
  };
}

export interface ApiClientOptions {
  development: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  account?: string;
}

export function addApiClientOptionsToCommand(command: Command): Command {
  return command
    .addOption(
      new Option(
        '--api-base-url <url>',
        'specify synchronization API base URL',
      ).default(JUPITERONE_PROD_API_BASE_URL),
    )
    .addOption(
      new Option(
        '-d, --development',
        '"true" to target apps.dev.jupiterone.io',
      ).default(
        !!process.env.JUPITERONE_DEV,
        'JUPITERONE_DEV environment variable value',
      ),
    )
    .addOption(
      new Option('--account <account>', 'JupiterOne account ID').default(
        process.env.JUPITERONE_ACCOUNT,
        'JUPITERONE_ACCOUNT environment variable value',
      ),
    )
    .addOption(
      new Option('--api-key <key>', 'JupiterOne API key').default(
        process.env.JUPITERONE_API_KEY,
        'JUPITERONE_API_KEY environment variable value',
      ),
    );
}

export function validateApiClientOptions(options: ApiClientOptions) {
  if (
    options.development &&
    ![JUPITERONE_PROD_API_BASE_URL, JUPITERONE_DEV_API_BASE_URL].includes(
      options.apiBaseUrl,
    )
  ) {
    throw new Error(
      `Invalid configuration supplied. Cannot specify both --development and --api-base-url flags.`,
    );
  }
}

/**
 * Builds a set of options for the 'createApiClient' function.
 *
 * @throws IntegrationApiKeyRequiredError
 * @throws IntegrationAccountRequiredError
 */
export function getApiClientOptions(options: ApiClientOptions) {
  return {
    apiBaseUrl: options.development
      ? JUPITERONE_DEV_API_BASE_URL
      : options.apiBaseUrl,
    accessToken: options.apiKey || getApiKeyFromEnvironment(),
    account: options.account || getAccountFromEnvironment(),
  };
}
