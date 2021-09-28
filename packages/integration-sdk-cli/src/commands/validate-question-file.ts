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
}

export function getDefaultQuestionFilePath() {
  return path.join(process.cwd(), './jupiterone/questions/questions.yaml');
}

export function validateQuestionFile() {
  return createCommand('validate-question-file')
    .description('validates an integration questions file')
    .requiredOption(
      '-p, --file-path <filePath>',
      'absolute path to managed question file',
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
      'Must provide J1 account ID and API key (except for --dry-run)',
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

  log.info('Successfully validated managed question file!');
}
