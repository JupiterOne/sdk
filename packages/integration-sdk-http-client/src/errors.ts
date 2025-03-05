import {
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';
import { Headers, Response } from 'node-fetch';

type RateLimitErrorParams = ConstructorParameters<
  typeof IntegrationProviderAPIError
>[0] & {
  retryAfter: number;
};

interface RequestErrorParams {
  endpoint: string;
  response: Response;
  logger: IntegrationLogger;
  logErrorBody: boolean;
}

export class RetryableIntegrationProviderApiError extends IntegrationProviderAPIError {
  retryable = true;
}

export class RateLimitError extends RetryableIntegrationProviderApiError {
  constructor(options: RateLimitErrorParams) {
    super(options);
    this.retryAfter = options.retryAfter;
  }
  retryAfter: number;
}

export class ResponseBodyError extends Error {
  bodyError: string;
  headers: Record<string, string>;
  constructor(bodyError: string, headers: Record<string, string>) {
    super(`Error Response: ${bodyError}`);
    this.name = 'ResponseBodyError';
    this.bodyError = bodyError;
    this.headers = headers;
  }
}

async function getErrorBody(
  response: Response,
  logger: IntegrationLogger,
  logErrorBody: boolean,
) {
  let errorBody: string | undefined;
  try {
    const clonedResponse = response.clone();
    errorBody = await clonedResponse.text();
    if (logErrorBody) {
      logger.error({ errBody: errorBody }, 'Encountered error from API');
    }
  } catch (e) {
    // pass
  }
  return errorBody;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const headersRecord: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    headersRecord[key] = value;
  }
  return headersRecord;
}

export async function retryableRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<RetryableIntegrationProviderApiError> {
  const errorBody = await getErrorBody(response, logger, logErrorBody);
  const headers = headersToRecord(response.headers);

  if (response.status === 429) {
    return new RateLimitError({
      cause:
        typeof errorBody === 'string'
          ? new ResponseBodyError(errorBody, headers)
          : undefined,
      status: response.status,
      statusText: response.statusText,
      endpoint,
      retryAfter: Number(response.headers.get('retry-after')),
    });
  }

  return new RetryableIntegrationProviderApiError({
    cause:
      typeof errorBody === 'string'
        ? new ResponseBodyError(errorBody, headers)
        : undefined,
    endpoint,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function fatalRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<IntegrationProviderAPIError> {
  const errorBody = await getErrorBody(response, logger, logErrorBody);
  const headers = headersToRecord(response.headers);

  const apiErrorOptions = {
    cause:
      typeof errorBody === 'string'
        ? new ResponseBodyError(errorBody, headers)
        : undefined,
    endpoint,
    status: response.status,
    statusText: response.statusText,
  };
  if (response.status === 401) {
    return new IntegrationProviderAuthenticationError(apiErrorOptions);
  } else if (response.status === 403) {
    return new IntegrationProviderAuthorizationError(apiErrorOptions);
  } else {
    return new IntegrationProviderAPIError(apiErrorOptions);
  }
}

/**
 * Function for determining if a request is retryable
 * based on the returned status.
 */
export function isRetryableRequest(status: number): boolean {
  return (
    // 5xx error from provider (their fault, might be retryable)
    // 429 === too many requests, we got rate limited so safe to try again
    status >= 500 || status === 429
  );
}
