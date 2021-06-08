import fs from 'fs';
import { diff as diffJson } from 'json-diff';
import { omit } from 'lodash';

export function findDifferences(
  oldJsonDataPath,
  newJsonDataPath,
  logOnlyKeyChanges,
) {
  const neo = JSON.parse(fs.readFileSync(newJsonDataPath, 'utf8'));
  const old = JSON.parse(fs.readFileSync(oldJsonDataPath, 'utf8'));

  /**
   * These regexes are necessary due to the way we export the data from JupiterOne.
   */
  const GRAPH_OBJECT_KEY_PROPERTY = /^[er]\._key/;
  const ENTITY_PROPERTY = /^e\./;
  const RELATIONSHIP_PROPERTY = /^r\./;

  const extractor = (acc, graphObject) => {
    const entity: any = {};
    const relationship: any = {};

    for (const property in graphObject) {
      if (ENTITY_PROPERTY.test(property)) {
        entity[property.slice(2)] = graphObject[property];
        if (GRAPH_OBJECT_KEY_PROPERTY.test(property)) {
          acc[graphObject[property]] = entity;
        }
      } else if (RELATIONSHIP_PROPERTY.test(property)) {
        relationship[property.slice(2)] = graphObject[property];
      }
    }

    if (relationship._key) {
      // graphObject is a relationship
      acc[getRelationshipKey(relationship)] = relationship;
    }

    return acc;
  };

  const oldByKey = (old as any).data.reduce(extractor, {});
  const newByKey = (neo as any).data.reduce(extractor, {});

  const oldKeys: string[] = [];
  const newKeys: string[] = [];

  // Pair up old and new by key
  const pairs: { [key: string]: { key: string; old: any; neo: any } } = {};
  for (const [key, value] of Object.entries<any>(oldByKey)) {
    oldKeys.push(key);
    pairs[key] = { key, old: value, neo: newByKey[getRelationshipKey(value)] };
  }
  for (const [key, value] of Object.entries<any>(newByKey)) {
    newKeys.push(key);
    if (!pairs[key]) {
      pairs[key] = {
        key,
        old: oldByKey[getRelationshipKey(value)],
        neo: value,
      };
    }
  }

  console.log({
    oldKeys: oldKeys.length,
    newKeys: newKeys.length,
  });

  const differences: any[] = [];
  for (const [key, { old, neo }] of Object.entries(pairs)) {
    if (!logOnlyKeyChanges || !old || !neo) {
      const ignoreProperties = [
        '_integrationName',
        '_beginOn',
        '_version',
        '_id',
        '_integrationInstanceId',
        '_createdOn',
        '_latest__deleted',
        '_rawDataHashes__deleted',
        '_mapper_sourceEntityId',
        'tag.AccountName',
        '_fromEntityId',
        '_toEntityId',
      ];

      differences.push({
        type: old?._type || neo?._type,
        key,
        diff: diffJson(
          omit(old, ignoreProperties),
          omit(neo, ignoreProperties),
        ),
      });
    }
  }

  console.log('differences: ', JSON.stringify(differences, null, 2));
}

/**
 * In some integrations, _key values for relationships were made with JupiterOne
 * database storage id, which will change when between sdk v1 and v2. These changes
 * are fine, so in order to avoid catching these, we construct a better key based
 * on the entity types and the relationship.
 */
function getRelationshipKey(relationship) {
  return relationship._fromEntityKey &&
    relationship._toEntityKey &&
    relationship._class
    ? 'normalized:' +
        relationship._fromEntityKey +
        '|' +
        relationship._class +
        '|' +
        relationship._toEntityKey
    : relationship._key;
}
