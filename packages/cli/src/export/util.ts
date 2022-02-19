export function sanitizeContent(content: string) {
  return content.replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r');
}
