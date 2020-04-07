import { PersistedObject } from './persistedObject';

export type Entity = PersistedObject &
  EntityOverrides &
  EntityAdditionalProperties;

interface EntityOverrides {
  // entity can have multiple classes
  _class: string | string[];
}

type EntityAdditionalProperties = Record<string, EntityPropertyValue>;

type EntityPropertyValue =
  | Array<string | number | boolean>
  | string
  | string[]
  | number
  | number[]
  | boolean
  | undefined
  | null;
