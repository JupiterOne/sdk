import chalk from 'chalk';

export function debug(msg: string) {
  console.log(`${chalk.gray(msg)}`);
}

export function info(msg: string) {
  console.log(`${chalk.cyan(msg)}`);
}
