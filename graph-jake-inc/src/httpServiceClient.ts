export class HttpServiceClient {
  constructor() {}

  async request({
    url,
    method,
    headers,
    body,
  }: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: any;
  }) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }
}
