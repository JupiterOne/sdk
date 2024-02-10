export class HttpServiceClient {
  constructor() {}

  async get({
    url,
    headers,
  }: {
    url: string;
    headers?: Record<string, string>;
  }) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    });
    return response.json();
  }

  async post({
    url,
    body,
    headers,
  }: {
    url: string;
    body: any;
    headers?: Record<string, string>;
  }) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }
}
