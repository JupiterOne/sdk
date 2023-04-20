const fs = require('fs/promises');
const path = require('path');
/**
 * Creates an index.ts (barrel) file from the generated TS classes that allows for cleaner exports.
 * The barrel file will look like:
 * export * from './Entity';
 * export * from ...
 **/
void (async function () {
  if (process.argv.length < 2) {
    // eslint-disable-next-line no-console
    console.error(
      `Not enough arguments supplied.\nUsage: node generate-resolved-schemas.js <schema directory> <output path>`,
    );
    return;
  }
  const typesPath = process.argv[2];

  const types = await getNonEmptyFiles(typesPath);
  let indexFile = '';
  for (const type of types) {
    if (type === 'index.ts') {
      continue;
    }
    indexFile +=
      "export * from './" +
      type.replace('.d.ts', '').replace('.ts', '') +
      "'\n";
  }

  await fs.writeFile(typesPath + '/index.ts', indexFile);
})();

async function getNonEmptyFiles(dir) {
  const files = await fs.readdir(dir);
  let fileNames = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const typeBlob = await fs.readFile(filePath);
    const typeString = typeBlob.toString();
    const empty = `/* eslint-disable */
`;
    if (typeString !== empty) {
      fileNames.push(file);
    }
  }

  return fileNames;
}
