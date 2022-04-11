import * as path from 'path';
import { createCli } from '../..';
import { getDefaultQuestionFilePath } from '../../commands';

describe('j1-integration validate-question-file --dry-run', () => {
  test('should validate a provided question file', async () => {
    await createCli().parseAsync([
      'node',
      'j1-integration',
      'validate-question-file',
      '--dry-run',
      '--file-path',
      path.join(__dirname, '../../questions/__fixtures__/questions/basic.yaml'),
    ]);
  });

  test('should throw an error if --api-base-url is set with JUPITERONE_DEV', async () => {
    process.env.JUPITERONE_DEV = 'true';

    await expect(
      createCli().parseAsync([
        'node',
        'j1-integration',
        'validate-question-file',
        '--jupiterone-account-id',
        'test-account',
        '--jupiterone-api-key',
        'testing-key',
        '--file-path',
        path.join(
          __dirname,
          '../../questions/__fixtures__/questions/basic.yaml',
        ),
        '--api-base-url',
        'https://api.TEST.jupiterone.io',
      ]),
    ).rejects.toThrow(
      'Invalid configuration supplied.  Cannot specify both --api-base-url and the JUPITERONE_DEV environment variable.',
    );
  });
});

describe('#getDefaultQuestionFilePath', () => {
  test('should return expected directory', () => {
    expect(getDefaultQuestionFilePath()).toEqual(
      path.join(process.cwd(), './jupiterone/questions/questions.yaml'),
    );
  });
});
