import { Entity, Relationship } from '@jupiterone/integration-sdk-core';
import { parse, transforms } from 'json2csv';
import _ from 'lodash';

export interface CsvResult {
  [type: string]: string;
}

type AnyPersistedObject = Entity | Relationship;

/**
 * @param  {AnyPersistedObject[]} objects Entities or Relationships to be converted into csv text
 * @returns {CsvResult} The entities or relationships grouped by their respective types
 */
export function parseObjectsToCsv(objects: AnyPersistedObject[]): CsvResult {
  const objectGrouping = _.groupBy(objects, (o) => o._type);

  return Object.keys(objectGrouping).reduce((acc, key) => {
    acc[key] = parse(objectGrouping[key], {
      includeEmptyRows: true,
      transforms: [
        transforms.flatten({
          arrays: true,
          objects: true,
        }),
      ],
    });
    return acc;
  }, {});
}
