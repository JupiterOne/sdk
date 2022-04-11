import { createCommand } from 'commander';
import * as log from '../log';
import { TypesCommandArgs } from '../utils/getSortedJupiterOneTypes';
import { validateManagedQuestionFile } from '../questions/managedQuestionFileValidator';
import {
  ApiClient,
  createApiClient,
  getApiBaseUrl,
} from '@jupiterone/integration-sdk-runtime';
import * as path from 'path';

interface ValidateQuestionFileCommandArgs extends TypesCommandArgs {
  filePath: string;
  jupiteroneAccountId?: string;
  jupiteroneApiKey?: string;
  dryRun?: boolean;
  apiBaseUrl?: string;
}

export function getDefaultQuestionFilePath() {
  return path.join(process.cwd(), './jupiterone/questions/questions.yaml');
}

export function validateQuestionFile() {
  return createCommand('validate-question-file')
    .description('validates an integration questions file')
    .requiredOption(
      '-p, --file-path <filePath>',
      'path to managed question file',
      getDefaultQuestionFilePath(),
    )
    .option(
      '-a, --jupiterone-account-id <jupiteroneAccountId>',
      'J1 account ID used to validate J1QL queries',
    )
    .option(
      '-k, --jupiterone-api-key <jupiteroneApiKey>',
      'J1 API key used to validate J1QL queries',
    )
    .option(
      '-d, --dry-run',
      'skip making HTTP requests to validate J1QL queries',
    )
    .option(
      '--api-base-url <url>',
      'API base URL used to validate question file.',
    )
    .action(executeValidateQuestionFileAction);
}

async function executeValidateQuestionFileAction(
  options: ValidateQuestionFileCommandArgs,
): Promise<void> {
  const { jupiteroneAccountId, jupiteroneApiKey, dryRun } = options;
  const filePath = path.resolve(options.filePath);

  log.info(
    `\nRunning validate-question-file action (path=${filePath}, accountId=${jupiteroneAccountId}, dryRun=${dryRun})...\n`,
  );

  let apiClient: ApiClient | undefined;

  if (!dryRun && (!jupiteroneAccountId || !jupiteroneApiKey)) {
    throw new Error(
      'Must provide J1 account ID and API key (except for --dry-run)',
    );
  } else if (!dryRun && jupiteroneAccountId && jupiteroneApiKey) {
    let apiBaseUrl: string;
    if (options.apiBaseUrl) {
      if (process.env.JUPITERONE_DEV) {
        throw new Error(
          'Invalid configuration supplied.  Cannot specify both --api-base-url and the JUPITERONE_DEV environment variable.',
        );
      }
      apiBaseUrl = options.apiBaseUrl;
    } else {
      apiBaseUrl = getApiBaseUrl({
        dev: !!process.env.JUPITERONE_DEV,
      });
    }
    apiClient = createApiClient({
      apiBaseUrl: apiBaseUrl,
      account: jupiteroneAccountId,
      accessToken: jupiteroneApiKey,
    });
  }

  try {
    await validateManagedQuestionFile({
      filePath,
      apiClient,
    });
  } catch (err) {
    log.error('Failed to validate managed question file!');
    throw err;
  }

  log.info('Successfully validated managed question file!');
}
