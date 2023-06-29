import { spawn } from 'child_process';

async function spawnCommand(config, command, args): Promise<string> {
  const spawnOptions = config.verbose
    ? {
        cwd: config.path,
        shell: true,
      }
    : {
        cwd: config.path,
      };

  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, spawnOptions);
    cmd.on('close', (code) => {
      if (code === 0) {
        resolve(`${code}`);
      } else {
        reject(`exited with ${code}`);
      }
    });
  });
}

async function yarnInstall(_answers, config, _plop) {
  return spawnCommand(config, 'yarn', ['install']);
}

async function yarnFormat(_answers, config, _plop): Promise<string> {
  return spawnCommand(config, 'yarn', [`format`]);
}

async function yarnLint(_answers, config, _plop) {
  return spawnCommand(config, 'yarn', ['lint']);
}

export { yarnInstall, yarnFormat, yarnLint };
