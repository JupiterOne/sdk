import path from 'path';
import { createCommand } from 'commander';
const dynamicImport = new Function('specifier', 'return import(specifier)');

export function bocchi() {
  return createCommand('bocchi')
    .description('bocchi byebye')
    .action(async (cmdOpts) => {
      const Plop = await dynamicImport('plop');
      const configPath = path.resolve(
        path.join(__dirname, '../bocchi/bocchi.js'),
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
