import path from 'path';
import { createCommand } from 'commander';
const dynamicImport = new Function('specifier', 'return import(specifier)');

export function generate() {
  return createCommand('generate')
    .description('generate integrations in whole and in part')
    .action(async (cmdOpts) => {
      const Plop = await dynamicImport('plop');
      const configPath = path.resolve(
        path.join(__dirname, '../generator/newIntegration.js'),
      );

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
