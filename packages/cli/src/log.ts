import chalk from 'chalk';

export function debug(msg: string) {
  console.log(`${chalk.gray(msg)}`);
}

export function info(msg: string) {
  console.log(`${chalk.white(msg)}`);
}

export function warn(msg: string) {
  console.log(`${chalk.yellow(msg)}`);
}