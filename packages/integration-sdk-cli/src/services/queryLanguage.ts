import chunk from 'lodash/chunk';
import { ApiClient } from '@jupiterone/integration-sdk-runtime';

enum QueryLanguageErrorCode {
  PARSER_ERROR = 'PARSER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  FORBIDDEN_ERROR = 'FORBIDDEN_ERROR',
}

type ParseAndValidateRawQueriesResult = {
  valid: boolean;
  query: string;
  error?: {
    message: string;
    code: QueryLanguageErrorCode;
  };
};

type ParseAndValidateRawQueriesResults = ParseAndValidateRawQueriesResult[];

/**
 * Maximum number of queries that can be supplied to `/j1ql/validate` endpoint
 */
const MAX_QUERIES_TO_VALIDATE = 250;

/**
 * Sends queries to `/j1ql/validate` in batches to be validated
 */
export async function validateQueries(
  apiClient: ApiClient,
  queries: string[],
): Promise<ParseAndValidateRawQueriesResults> {
  const queryBatches = chunk(queries, MAX_QUERIES_TO_VALIDATE);
  let overallResults: ParseAndValidateRawQueriesResults = [];

  for (const queryBatch of queryBatches) {
    const result = await apiClient.post('/j1ql/validate', {
      queries: queryBatch,
    });

    overallResults = overallResults.concat(result.data);
  }

  return overallResults;
}
