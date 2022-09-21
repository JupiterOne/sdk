/* eslint-disable no-console */
export function expect(result) {
  return {
    toBe: (expected) => {
      if (result != expected) {
        console.error('Result does not match expected:\n\tResult:');
        console.error(result);
        console.error('\tExpected:');
        console.error(expected);
        process.exit(1);
      }
    },
  };
}
