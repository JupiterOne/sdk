import {
  createApiClient,
  getApiBaseUrl,
} from '@jupiterone/integration-sdk-runtime';
import path from 'path';
import { validateManagedQuestionFile } from './managedQuestionFileValidator';

function getFixturePath(fixtureName: string) {
  return path.join(
    __dirname,
    './__fixtures__/questions/',
    `${fixtureName}.yaml`,
  );
}

async function dryRunTest(fixtureName: string) {
  await validateManagedQuestionFile({
    filePath: getFixturePath(fixtureName),
  });
}

describe('#validateManagedQuestionFile dryRun - Valid', () => {
  test('should validate empty questions file', async () => {
    await dryRunTest('empty-questions');
  });

  test('should validate basic question file', async () => {
    await dryRunTest('basic');
  });

  test('should validate multiple queries in question', async () => {
    await dryRunTest('multiple-queries');
  });

  test('should validate multiple questions', async () => {
    await dryRunTest('multiple-questions');
  });

  test('should validate multiple questions', async () => {
    await dryRunTest('multiple-questions');
  });

  test('should validate compliance question', async () => {
    await dryRunTest('compliance');
  });

  test('should validate any allowed resultsAre property', async () => {
    await dryRunTest('results-are');
  });
});

describe('#validateManagedQuestionFile dryRun - Invalid', () => {
  test('should throw if duplicate question id', async () => {
    await expect(() =>
      dryRunTest('non-unique-question-id'),
    ).rejects.toThrowError(
      `Non-unique question ID found in file (questionId=integration-question-google-cloud-disabled-project-services)`,
    );
  });

  test('should throw if duplicate question title', async () => {
    await expect(() =>
      dryRunTest('non-unique-question-title'),
    ).rejects.toThrowError(
      `Non-unique question title found in file (questionId=integration-question-google-cloud-corporate-login-credentials, questionTitle=Which Google Cloud API services are disabled for my project?)`,
    );
  });

  test('should throw if duplicate question tag', async () => {
    await expect(() =>
      dryRunTest('non-unique-question-tag'),
    ).rejects.toThrowError(
      `Non-unique question tag found (questionId=integration-question-google-cloud-disabled-project-services, tag=google-cloud)`,
    );
  });

  test('should throw if duplicate query name in question', async () => {
    await expect(() =>
      dryRunTest('non-unique-question-name'),
    ).rejects.toThrowError(
      `Duplicate query name in question detected (questionId=integration-question-google-cloud-corporate-login-credentials, queryName=good)`,
    );
  });

  test('should throw if resultsAre contains invalid property', async () => {
    await expect(() => dryRunTest('invalid-results-are')).rejects.toThrowError(
      `Expected "BAD" | "GOOD" | "INFORMATIVE" | "UNKNOWN" | undefined | null, but was string in questions.[0].queries.[0].resultsAre`,
    );
  });
});

describe('#validateManagedQuestionFile input validation', () => {
  test('should throw if file does not exist', async () => {
    await expect(() => dryRunTest('invalid-file-path')).rejects.toThrowError(
      `Question file not found (filePath=${getFixturePath(
        'invalid-file-path',
      )})`,
    );
  });

  test('should throw if file invalid YAML', async () => {
    await expect(() => dryRunTest('invalid-yaml')).rejects.toThrowError(
      `can not read a block mapping entry; a multiline key may not be an implicit key`,
    );
  });
});

describe('#validateManagedQuestionFile non-dryRun', () => {
  test('should validate non-dry run', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: 'test-account',
    });

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: [
        {
          query: 'find google_user with email $="@{{domain}}"',
          valid: true,
        },
        {
          query: 'find google_user with email !$="@{{domain}}"',
          valid: true,
        },
      ],
    });

    await validateManagedQuestionFile({
      apiClient,
      filePath: getFixturePath('multiple-queries'),
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/j1ql/validate', {
      queries: [
        'find google_user with email $="@{{domain}}"',
        'find google_user with email !$="@{{domain}}"',
      ],
    });
  });

  test('should throw if invalid query provided', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: 'test-account',
    });

    const invalidQueryResult = 'find google_user with email $="@{{domain}}"';

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: [
        {
          query: invalidQueryResult,
          // NOTE: Mock invalid query response!
          valid: false,
        },
        {
          query: 'find google_user with email !$="@{{domain}}"',
          valid: true,
        },
      ],
    });

    await expect(() =>
      validateManagedQuestionFile({
        apiClient,
        filePath: getFixturePath('multiple-queries'),
      }),
    ).rejects.toThrowError(
      `Queries failed to validate (queries=${JSON.stringify(
        [invalidQueryResult],
        null,
        2,
      )})`,
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/j1ql/validate', {
      queries: [
        'find google_user with email $="@{{domain}}"',
        'find google_user with email !$="@{{domain}}"',
      ],
    });
  });
});
