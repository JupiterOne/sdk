import { createCommand } from 'commander';
import * as log from '../log';
import { TypesCommandArgs } from '../utils/getSortedJupiterOneTypes';
import { validateManagedQuestionFile } from '../questions/managedQuestionFileValidator';
import {
  ApiClient,
  createApiClient,
  getApiBaseUrl,
} from '@jupiterone/integration-sdk-runtime';

interface ValidateQuestionFileCommandArgs extends TypesCommandArgs {
  filePath: string;
  jupiteroneAccountId?: string;
  jupiteroneApiKey?: string;
  dryRun?: boolean;
}

export function validateQuestionFile() {
  return createCommand('validate-question-file')
    .description('validates an integration questions file')
    .requiredOption(
      '-p, --file-path <filePath>',
      'absolute path to integration question file',
    )
    .option(
      '-a, --jupiterone-account-id <jupiteroneAccountId>',
      'JupiterOne account ID used to validate JupiterOne queries with',
    )
    .option(
      '-k, --jupiterone-api-key <jupiteroneApiKey>',
      'JupiterOne API key used to validate JupiterOne queries with',
    )
    .option(
      '-d, --dry-run',
      'Skip making HTTP requests to validate J1QL queries',
    )
    .action(executeValidateQuestionFileAction);
}

async function executeValidateQuestionFileAction(
  options: ValidateQuestionFileCommandArgs,
): Promise<void> {
  const { filePath, jupiteroneAccountId, jupiteroneApiKey, dryRun } = options;

  log.info(
    `\nRunning validate-question-file action (path=${filePath}, accountId=${jupiteroneAccountId}, dryRun=${dryRun})...\n`,
  );

  let apiClient: ApiClient | undefined;

  if (!dryRun && (!jupiteroneAccountId || !jupiteroneApiKey)) {
    throw new Error(
      'Must provide JupiterOne API key and JupiterOne API key when not running a dry run',
    );
  } else if (!dryRun && jupiteroneAccountId && jupiteroneApiKey) {
    apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl({
        dev: !!process.env.JUPITERONE_DEV,
      }),
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

  log.info('Successfully validated integration question file!');
}
