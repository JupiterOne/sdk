/**
 * lookup a better way to make code
 * 1. the base client can be hardcoded
 * 1. need ejs file that will look at the template file and create a converter file per step
 * 2. need ejs file that will create an index per step
 * 2. need script that will create the folder structure of the new graph project
 * 3.
 */

export class RestApiServiceClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? 'http://localhost:3000/';
  }

  async get(url: string) {
    // TODO: try catch
    const response = await fetch(`${this.baseUrl}${url}`);
    return response.json();
  }
}
