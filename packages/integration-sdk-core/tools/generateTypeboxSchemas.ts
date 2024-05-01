import { TObject } from '@sinclair/typebox';
import { writeFile } from 'node:fs/promises';
import { schema2typebox } from 'schema2typebox';
import * as prettier from 'prettier';

type Schemas = Record<string, TObject>;

const getJsonSchemas = async (): Promise<Schemas> => {
  return fetch(
    'https://raw.githubusercontent.com/JupiterOne/data-model/main/external/resolvedSchemas.json',
  ).then((res) => res.json());
};

export const generateTypeboxSchemas = async (schemas: Schemas) => {
  for (const [id, schema] of Object.entries(schemas)) {
    const title = id.replace('#', '');
    const result = await schema2typebox({
      input: JSON.stringify({ ...schema, title }),
    });
    await writeFile(__dirname + '/schemas/' + `${title}.ts`, result);
  }
};

export const generateIndexFile = async (schemas: Schemas) => {
  const schemaNames = Object.keys(schemas).map((id) => id.replace('#', ''));
  const imports = schemaNames.map(
    (schemaName) => `import { ${schemaName} } from './${schemaName}';`,
  );
  const indexContent = prettier.format(`
    ${imports.join('\n')}
    export const SchemaMap = {
      ${schemaNames.join(',\n')}
    } as const;
  `);
  await writeFile(__dirname + '/schemas/index.ts', indexContent);
};

export const generate = async () => {
  const schemas = await getJsonSchemas();
  await Promise.all([
    generateTypeboxSchemas(schemas),
    generateIndexFile(schemas),
  ]);
};

void generate();
