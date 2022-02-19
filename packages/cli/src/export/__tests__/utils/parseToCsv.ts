import jsonexport from 'jsonexport';

export function parseToCsv(content: object[]): Promise<string> {
  return jsonexport(content);
}
