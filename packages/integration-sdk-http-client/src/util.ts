export function getUnixTimeNow() {
  return Date.now() / 1000;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true when we have a status code that is an error but not retryable.
 * @param statusCode
 * @returns boolean
 */
export function isNonRetryableError(statusCode: number): boolean {
  // TODO (adam-in-ict) make range of retryable error codes configurable
  if (statusCode !== 429 && statusCode >= 400) {
    return true;
  }
  return false;
}
