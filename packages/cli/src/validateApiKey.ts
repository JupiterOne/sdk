export function validateApiKey(apiKey?: string) {
  apiKey = apiKey ?? process.env.JUPITERONE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing apiKey! Set the JUPITERONE_API_KEY environment variable or supply the --api-key option.');
  }

  return apiKey;
}