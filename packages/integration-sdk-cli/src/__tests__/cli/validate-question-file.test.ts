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
});

describe('#getDefaultQuestionFilePath', () => {
  test('should return expected directory', () => {
    expect(getDefaultQuestionFilePath()).toEqual(
      path.join(process.cwd(), './jupiterone/questions/questions.yaml'),
    );
  });
});
