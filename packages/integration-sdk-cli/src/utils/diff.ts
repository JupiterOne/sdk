import fs from "fs";
import { diff as diffJson } from 'json-diff'

export function findDifferences(oldJsonDataPath, newJsonDataPath, logOnlyKeyChanges) {

  const neo = JSON.parse(fs.readFileSync(newJsonDataPath, 'utf8'))
  const old = JSON.parse(fs.readFileSync(oldJsonDataPath, 'utf8'))

  /**
   * These regexes are necessary due to the way we export the data from JupiterOne.
   */
  const GRAPH_OBJECT_KEY_PROPERTY = /^[er]\._key/;
  const ENTITY_PROPERTY = /^e\./;
  const RELATIONSHIP_PROPERTY = /^r\./;

  const extractor = (acc, obj) => {

    const entity: any = {};
    const relationship: any = {};
    for (const key in obj) {
      if (ENTITY_PROPERTY.test(key)) {
        entity[key.slice(2)] = obj[key];
        if (GRAPH_OBJECT_KEY_PROPERTY.test(key)) {
          acc[obj[key]] = entity;
        }
      } else if (RELATIONSHIP_PROPERTY.test(key)) {
        relationship[key.slice(2)] = obj[key];
        if (GRAPH_OBJECT_KEY_PROPERTY.test(key)) {
          acc[getRelationshipKey(relationship)] = relationship;
        }
      }
    }
    return acc;
  };

  const oldByKey = (old as any).data.reduce(extractor, {});
  const newByKey = (neo as any).data.reduce(extractor, {});

  const oldKeys: string[] = [];
  const newKeys: string[] = [];

  const pairs: { [key: string]: { key: string; old: any; neo: any } } = {};
  for (const [key, value] of Object.entries<any>(oldByKey)) {
    oldKeys.push(key);
    pairs[key] = { key, old: value, neo: newByKey[getRelationshipKey(value)]};
  }
  for (const [key, value] of Object.entries<any>(newByKey)) {
    newKeys.push(key)
    if (!pairs[key]) {
      pairs[key] = { key, old: oldByKey[getRelationshipKey(value)], neo: value };
    }
  }

  console.log({
    oldKeys: oldKeys.length,
    newKeys: newKeys.length,
  });

  const differences: any[] = [];
  for (const [key, { old, neo }] of Object.entries(pairs)) {
    if (!logOnlyKeyChanges || (!old || !neo)) {
      const mappedRelationship =
        'system-mapper' === (old?._source || neo?._source);

      const diff = diffJson(old, neo);
      differences.push({ key, mappedRelationship, diff });
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
  return (relationship._fromEntityKey && relationship._toEntityKey && relationship._class) ?
    '' + relationship._fromEntityKey + relationship._class + relationship._toEntityKey :
    relationship._key
}
