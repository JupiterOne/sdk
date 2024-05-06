import path from 'path';
import { createCommand } from 'commander';
const dynamicImport = new Function('specifier', 'return import(specifier)');

export function generate() {
  return createCommand('generate')
    .description('generate integrations in whole and in part')
    .option('--useYarn', 'use yarn for package management')
    .action(async (cmdOpts) => {
      const Plop = await dynamicImport('plop');
      let configPath = path.resolve(
        path.join(__dirname, '../generator/newIntegration.js'),
      );

      if (cmdOpts.useYarn) {
        configPath = path.resolve(
          path.join(__dirname, '../generator/newIntegrationYarn.js'),
        );
      }

      Plop.Plop.prepare(
        {
          cwd: process.cwd(),
          configPath,
        },
        (env) =>
          Plop.Plop.execute(env, (env) => {
            const options = {
              ...env,
              dest: process.cwd(),
            };
            return Plop.run(options, undefined, true);
          }),
      );
    });
}
