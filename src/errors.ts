export const UNEXPECTED_ERROR_CODE = 'UNEXPECTED_ERROR';
export const UNEXPECTED_ERROR_REASON =
  'Unexpected error occurred executing integration! Please contact us in Slack or at https://support.jupiterone.io if the problem continues to occur';

export interface IntegrationErrorOptions {
  message: string;
  code: string;
  fatal?: boolean;
  cause?: Error;
}

export class IntegrationError extends Error {
  /**
   * Optional cause associated with error.
   */
  readonly _cause?: Error;

  /**
   * An optional code associated with error.
   */
  readonly code: string;

  /**
   * An optional flag used to mark the error as fatal.
   */
  readonly fatal: boolean | undefined;

  constructor(options: IntegrationErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.fatal = options.fatal;
    this._cause = options.cause;
  }

  /**
   * For compatibility with bunyan err serializer.
   *
   * See https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L1125
   */
  cause() {
    return this._cause;
  }
}
