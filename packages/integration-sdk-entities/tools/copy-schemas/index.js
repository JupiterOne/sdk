const fs = require('fs/promises');
const path = require('path');

void (async function () {
  if (process.argv.length < 2) {
    console.error(
      `Not enough arguments supplied.\nUsage: node generate-resolved-schemas.js <schema directory> <output path>`,
    );
    return;
  }
  const schemaPath = process.argv[2];

  const schemas = await readAllSchemas(schemaPath);
  for (const schema of schemas) {
    await fs.writeFile(
      __dirname + '/_schemas/' + schema.$id.replace('#', '') + '.json',
      JSON.stringify(schema),
    );
  }
})();

function mutateRefsToBeJsonFiles(schemaString) {
  const parsedSchema = JSON.parse(schemaString);
  if (parsedSchema.allOf) {
    for (const ref of parsedSchema.allOf) {
      if (ref['$ref']) {
        ref['$ref'] = ref['$ref'].replace('#', '') + '.json';
      }
    }
  }
  return parsedSchema;
}

async function readAllSchemas(dir) {
  const files = await fs.readdir(dir);
  let schemas = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const schemaBlob = await fs.readFile(filePath);
    const schemaString = schemaBlob.toString();
    try {
      JSON.parse(schemaString);
    } catch (err) {
      console.log(filePath, schemaString);
    }
    const parsedSchema = mutateRefsToBeJsonFiles(schemaString);

    schemas.push(parsedSchema);
  }

  return schemas;
}
