import { HttpServiceClient } from './httpServiceClient';
import { IntegrationConfig } from './config';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

export class APIClient extends HttpServiceClient {
  private authHeaders: Record<string, string>;
  private baseUrl: string;

  constructor(readonly config: IntegrationConfig) {
    super();
    this.baseUrl = 'https://fix.me';
    this.authHeaders = {
      Authorization: `Bearer ${config.apiKey}`,
    };
  }

  // TODO: need to support POST for both of below
  public async getOrganization(path: string) {
    const url = `${this.baseUrl}/${path}`;
    return (await this.get({ url, headers: { ...this.authHeaders } })).data;
  }
  // TODO: need to support POST for both of below
  public async iterateUsers(path: string, iteratee: ResourceIteratee<any>) {
    const url = `${this.baseUrl}/${path}`;
    let nextToken: string | undefined;
    do {
      const response = await this.get({
        url,
        headers: { ...this.authHeaders },
      });
      const resources = response.data;
      for (const resource of resources) {
        await iteratee(resource);
      }
      nextToken = response.next;
    } while (nextToken);
  }
  // TODO: need to support POST for both of below
  public async getFirewall(path: string) {
    const url = `${this.baseUrl}/${path}`;
    return (await this.get({ url, headers: { ...this.authHeaders } })).data;
  }
}

let client: APIClient | undefined;

export function createAPIClient(config: IntegrationConfig): APIClient {
  return client ? client : new APIClient(config);
}
