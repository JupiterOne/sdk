import { createCommand } from 'commander';

import { troubleshoot } from '../troubleshoot';

export function troubleshootLocalExecution() {
  return createCommand('troubleshoot')
    .description('troubleshoot common issues with local execution')
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .action(async (options) => {
      // const integrationDir = path.resolve(options.projectPath);
      await troubleshoot(options);
    });
}
