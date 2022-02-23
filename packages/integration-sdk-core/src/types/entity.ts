import { PersistedObject } from './persistedObject';

export type PrimitiveEntity = EntityCoreProperties &
  PrimitiveEntityAdditionalProperties;

type EntityIdProperty = {
  /**
   * The natural identifier of the entity as provided by the data source API.
   *
   * Many APIs answer resources having a property representing the identity of
   * the resource within the data source system. This value should be
   * transferred to the entity's `id` property.
   *
   * In some cases an entity is known to a number of systems. The integrations
   * that do not own the entity will use mapped relationships and provide the
   * `id` value the data source maintains for the resource. The mapper will
   * merge the values into a single Array.
   *
   * An identity value that is maintained as a number must be converted to a
   * string. It is advisable to store the value in an additional property, such
   * as `<resource>Id`, where `<resource>` reflects the type of resource
   * represented by the entity (i.e. `domainId`, `userId`, etc.)
   */
  id?: string | string[];
};

type PrimitiveEntityAdditionalProperties = Record<
  string,
  PrimitiveEntityPropertyValue
> &
  EntityIdProperty;

type PrimitiveEntityPropertyValue =
  | Array<string | number | boolean>
  | string
  | string[]
  | number
  | number[]
  | boolean
  | undefined
  | null;

export type Entity = EntityCoreProperties &
  RawDataTracking &
  EntityAdditionalProperties;

export interface EntityCoreProperties extends Omit<PersistedObject, '_class'> {
  /**
   * Relationships are allowed a single `_class` value; entities are
   * allowed multiple values.
   */
  _class: string | string[];
}

type EntityAdditionalProperties = Record<string, EntityPropertyValue> &
  EntityIdProperty;

type EntityPropertyValue = PrimitiveEntityPropertyValue | EntityRawData[];

export interface RawDataTracking {
  /**
   * Maintains references to a collection of raw data accumulated during
   * the construction of an entity.
   */
  _rawData?: EntityRawData[];
}

/**
 * Entities are typically produced by collecting resources from another system and
 * transforming the data to meet the goals of the JupiterOne data model. The source
 * "raw" data can be tracked alongside the entity.
 */
export type EntityRawData = {
  /**
   * A name that identifies the payload when there are multiple data sources
   * used to build an entity.
   *
   * This name is part of a permanent key associated with the data. It must be
   * unique within the context of the entity. `'default'` is typically used
   * when there is only one data payload. It is recommended to use names
   * that are more meaningful when there is more than one resource used to build
   * the entity.
   *
   * For example, consider an AWS IAM Role entity, where the role has an
   * embedded policy obtained through a separate API call:
   *
   * ```
   * [
   *   { name: 'role', ... },
   *   { name: 'policy', ... }
   * ]
   * ```
   */
  name: string;

  /**
   * A string or an object of any type representing the source content used
   * to build an entity.
   */
  rawData: NonArrayObject | string;
};

type NonArrayObject = {
  [k: string]: any;
  // `reduceRight` is used determine the difference between an object and an array
  // the side effect is that we can not have an object with a key of `reduceRight`
  reduceRight?: never;
};
