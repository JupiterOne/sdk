export interface IntegrationErrorOptions {
  message: string;
  code: string;
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
  readonly code: string | undefined;

  constructor(options: IntegrationErrorOptions) {
    super(options.message);
    this.code = options.code;
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
