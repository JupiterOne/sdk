import { ApiClient } from '@jupiterone/integration-sdk-runtime';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as Runtypes from 'runtypes';
import * as queryLanguage from '../services/queryLanguage';

export const ManagedQuestionQueryRecord = Runtypes.Record({
  name: Runtypes.String.Or(Runtypes.Undefined),
  query: Runtypes.String,
});

export const ManagedQuestionComplianceDetailsRecord = Runtypes.Record({
  standard: Runtypes.String,
  requirements: Runtypes.Array(Runtypes.String).Or(Runtypes.Undefined),
  controls: Runtypes.Array(Runtypes.String).Or(Runtypes.Undefined),
});

export const ManagedQuestionRecord = Runtypes.Record({
  id: Runtypes.String,
  title: Runtypes.String,
  description: Runtypes.String,
  queries: Runtypes.Array(ManagedQuestionQueryRecord),
  tags: Runtypes.Array(Runtypes.String),
  compliance: Runtypes.Array(ManagedQuestionComplianceDetailsRecord).Or(
    Runtypes.Undefined,
  ),
});

export const QuestionUploadFileDataRecord = Runtypes.Record({
  integrationDefinitionId: Runtypes.String,
  sourceId: Runtypes.String,
  questions: Runtypes.Array(ManagedQuestionRecord),
});

export type ManagedQuestion = Runtypes.Static<typeof ManagedQuestionRecord>;
export type QuestionUploadFileData = Runtypes.Static<
  typeof QuestionUploadFileDataRecord
>;

function validateQuestionIdUniqueness(questions: ManagedQuestion[]) {
  const questionsIdSet = new Set<string>();

  for (const question of questions) {
    if (questionsIdSet.has(question.id)) {
      throw new Error(
        `Non-unique question ID found in file (questionId=${question.id})`,
      );
    }

    questionsIdSet.add(question.id);
  }
}

function validateQuestionTitleUniqueness(questions: ManagedQuestion[]) {
  const questionTitleSet = new Set<string>();

  for (const question of questions) {
    if (questionTitleSet.has(question.title)) {
      throw new Error(
        `Non-unique question title found in file (questionId=${question.id}, questionTitle=${question.title})`,
      );
    }

    questionTitleSet.add(question.title);
  }
}

function validateQuestionQueryNameUniqueness(questions: ManagedQuestion[]) {
  for (const question of questions) {
    const questionQueryNameSet = new Set<string>();

    for (const query of question.queries) {
      if (query.name) {
        if (questionQueryNameSet.has(query.name)) {
          throw new Error(
            `Duplicate query name in question detected (questionId=${question.id}, queryName=${query.name})`,
          );
        }

        questionQueryNameSet.add(query.name);
      }
    }
  }
}

async function validateQuestionQueries(
  apiClient: ApiClient,
  questions: ManagedQuestion[],
) {
  const queries: string[] = [];

  for (const question of questions) {
    for (const query of question.queries) {
      queries.push(query.query);
    }
  }

  const queryValidationResults = await queryLanguage.validateQueries(
    apiClient,
    queries,
  );

  const failedQueries = queryValidationResults
    .filter((r) => r.valid === false)
    .map((r) => r.query);

  if (failedQueries.length) {
    throw new Error(
      `Queries failed to validate (queries=${JSON.stringify(
        failedQueries,
        null,
        2,
      )})`,
    );
  }
}

function validateQuestionTagUniqueness(questions: ManagedQuestion[]) {
  for (const question of questions) {
    const questionTagSet = new Set<string>();

    for (const tag of question.tags) {
      if (questionTagSet.has(tag)) {
        throw new Error(
          `Non-unique question tag found (questionId=${question.id}, tag=${tag})`,
        );
      }

      questionTagSet.add(tag);
    }
  }
}

function validateQuestionFileData(questionFile: QuestionUploadFileData) {
  QuestionUploadFileDataRecord.check(questionFile);

  validateQuestionIdUniqueness(questionFile.questions);
  validateQuestionTitleUniqueness(questionFile.questions);
  validateQuestionTagUniqueness(questionFile.questions);
  validateQuestionQueryNameUniqueness(questionFile.questions);
}

async function loadFile(filePath: string) {
  try {
    const file = await fs.readFile(filePath, {
      encoding: 'utf-8',
    });

    return file;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Question file not found (filePath=${filePath})`);
    }

    throw err;
  }
}

async function loadQuestionFile(filePath: string) {
  const rawQuestionFile = await loadFile(filePath);
  return yaml.load(rawQuestionFile) as QuestionUploadFileData;
}

type ValidateManagedQuestionFileParams = {
  filePath: string;
  apiClient?: ApiClient;
};

export async function validateManagedQuestionFile(
  params: ValidateManagedQuestionFileParams,
) {
  const { filePath, apiClient } = params;

  const parsedQuestionFile = await loadQuestionFile(filePath);
  validateQuestionFileData(parsedQuestionFile);

  if (apiClient) {
    await validateQuestionQueries(apiClient, parsedQuestionFile.questions);
  }
}
