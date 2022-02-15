import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

export function filterGraphObjects<T = Entity | Relationship>(
  graphObjects: T[],
  filter: (graphObject: T) => boolean,
): { targets: T[]; rest: T[] } {
  const targets: T[] = [];
  const rest: T[] = [];

  for (const graphObject of graphObjects) {
    if (filter(graphObject)) {
      targets.push(graphObject);
    } else {
      rest.push(graphObject);
    }
  }
  return { targets, rest };
}
