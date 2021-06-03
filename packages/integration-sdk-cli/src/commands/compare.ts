import { createCommand } from 'commander';
import * as log from '../log';
import { findDifferences } from '../utils/diff';

export function compare() {
  return createCommand('compare')
    .storeOptionsAsProperties()
    .arguments('<oldPath> <neoPath>')
    .description('Compare the differences between two datasets that were downloaded from JupiterOne via the query: \n\n' +

    '\t find * as e that RELATES TO as r * return e.*, r.*\n\n' +

    'Example Dataset: \n\n' +

    JSON.stringify(require('../utils/exampleDataset.json'), null, 4)
    
    , {
      oldPath: 'relative path to the dataset to compare against',
      neoPath: 'relative path to the new dataset'
    })
    .option(
      '-ok, --log-only-key-changes',
      'Only log entities and relationships if their _key is only in one dataset or the other, but not in both.'
    )
    .action((oldPath, neoPath, options) => {
      log.info(`oldPath: ${oldPath}`);
      log.info(`neoPath: ${neoPath}`);
      log.info(`logOnlyKeyChanges: ${options.logOnlyKeyChanges}`)
      findDifferences(oldPath, neoPath, options.logOnlyKeyChanges)
    });
}
