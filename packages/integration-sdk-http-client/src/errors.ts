export interface APIErrorParams {
  message: string;

  code: number;
}

export class APIError extends Error {
  /**
   * Code associated with the error.
   */
  readonly code: number;

  constructor(config: APIErrorParams) {
    super(config.message);
    this.code = config.code;
  }
}
