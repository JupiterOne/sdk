/**
 * Stand-in for `@lifeomic/attempt` that runs retry loops without waiting.
 * Attempt counts, error handling and the options handed to `retry` stay real;
 * only the delay between attempts is removed.
 *
 * Use it from a test file with:
 *
 *   jest.mock('@lifeomic/attempt', () =>
 *     require('../../../test/util/attemptWithoutDelays'),
 *   );
 */
import type { AttemptFunction, PartialAttemptOptions } from '@lifeomic/attempt';

const actual = jest.requireActual('@lifeomic/attempt');

/** The options of every `retry` call so far, oldest first. */
export const retryCalls: PartialAttemptOptions<any>[] = [];

export function retry<T>(
  attemptFunc: AttemptFunction<T>,
  attemptOptions?: PartialAttemptOptions<T>,
): Promise<T> {
  retryCalls.push(attemptOptions ?? {});
  return actual.retry(attemptFunc, { ...attemptOptions, delay: 0 });
}

export const sleep = actual.sleep;
export const defaultCalculateDelay = actual.defaultCalculateDelay;
