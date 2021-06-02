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
      oldPath: 'relitive path to the dataset to compare against',
      neoPath: 'relitive path to the new dataset'
    })
    .option(
      '-logkey, --log-only-key-changes',
      'Only log entities and relationships that have _key values that are not in the other dataset.'
    )
    .action((oldPath, neoPath, options) => {
      log.info(`oldPath: ${oldPath}`);
      log.info(`neoPath: ${neoPath}`);
      log.info(`logOnlyKeyChanges: ${options.logOnlyKeyChanges}`)
      findDifferences(oldPath, neoPath, options.logOnlyKeyChanges)
    });
}
