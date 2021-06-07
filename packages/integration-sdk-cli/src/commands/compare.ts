import { createCommand } from 'commander';
import * as log from '../log';
import { findDifferences } from '../utils/diff';

export function compare() {
  return createCommand('compare')
    .storeOptionsAsProperties()
    .arguments('<oldPath> <neoPath>')
    .description(
      'Compare two datasets downloaded from JupiterOne using: \n\n' +
        '\t find * with _integrationInstanceId="abc-123" as e that RELATES TO as r * return e.*, r.*\n\n' +
        'Example Dataset: \n\n' +
        JSON.stringify(
          {
            type: 'table',
            data: [
              {
                'e._objectType': 'entity',
                'e._key': '12345',
                'e.name': 'Name',
                'r._key': '12345:has:abc123',
                'r._fromEntityId': '8f371b7e-eb08-4efe-8ac7-d0474cac8ea2',
                'r._toEntityId': 'cb257e7f-95bf-4f43-875b-ce12cde99149',
              },
            ],
            totalCount: 1,
          },
          null,
          4,
        ) +
        '\n',
      {
        oldPath: 'relative path to old integration data',
        neoPath: 'relative path to new integration data',
      },
    )
    .option(
      '-ok, --log-only-key-changes',
      'Only log entities and relationships if their _key is only in one dataset or the other, but not in both.',
    )
    .action((oldPath, neoPath, options) => {
      log.info(`oldPath: ${oldPath}`);
      log.info(`neoPath: ${neoPath}`);
      log.info(`logOnlyKeyChanges: ${options.logOnlyKeyChanges}`);
      findDifferences(oldPath, neoPath, options.logOnlyKeyChanges);
    });
}
