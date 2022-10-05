import chalk from 'chalk';

/* eslint-disable no-console */
export function debug(msg: string) {
  console.log(`${chalk.gray(msg)}`);
}

export function info(msg: string) {
  console.log(`${chalk.white(msg)}`);
}

export function warn(msg: string) {
  console.log(`${chalk.yellow(msg)}`);
}

export function error(msg: string) {
  console.log(`${chalk.red(msg)}`);
}
