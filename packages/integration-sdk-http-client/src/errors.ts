export interface APIErrorParams {
  message: string;
  status: number;
  statusText: string;
  endpoint: string;
}

export class APIError extends Error {
  /**
   * Status code associated with the error.
   */
  readonly status: number;
  /**
   *  Status Text (e.g. "Not Found")
   */
  readonly statusText: string;
  /**
   * The requested endpoint associated with the error.
   */
  readonly endpoint: string;

  constructor(config: APIErrorParams) {
    super(config.message);
    this.status = config.status;
    this.statusText = config.statusText;
    this.endpoint = config.endpoint;
  }
}
