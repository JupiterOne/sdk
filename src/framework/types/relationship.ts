import { PersistedObject } from './persistedObject';

export type Relationship = PersistedObject &
  RelationshipRequiredProperties &
  RelationshipAdditionalProperties;

interface RelationshipRequiredProperties {
  /**
   * The key that the edge is directed toward.
   */
  _toEntityKey: string;

  /**
   * The key that the edge is directed from.
   */
  _fromEntityKey: string;
}

type RelationshipAdditionalProperties = Record<
  string,
  RelationshipPropertyValue
>;
type RelationshipPropertyValue = string | number | boolean | undefined | null;
