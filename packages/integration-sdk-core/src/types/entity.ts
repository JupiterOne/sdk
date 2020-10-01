import { PersistedObject } from './persistedObject';

export type PrimitiveEntity = EntityCoreProperties &
  PrimitiveEntityAdditionalProperties;

type EntityIdProperty = {
  /**
   * The natural identifier of the entity as provided by the data source API.
   *
   * Many APIs answer resources having a property representing the identify of
   * the resource within the target system. This value should be transferred to
   * the entity's `id` property.
   *
   * In some cases an entity is known to a number of systems. The systems that
   * do not own the entity will use mapped relationships and provide the `id`
   * value they maintain for the resource. The mapping system will merge the
   * values into a single Array.
   */
  id?: string | number | (string | number)[];
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

interface EntityCoreProperties extends Omit<PersistedObject, '_class'> {
  // entity can have multiple classes
  _class: string | string[];
}

type EntityAdditionalProperties = Record<string, EntityPropertyValue> &
  EntityIdProperty;

type EntityPropertyValue = PrimitiveEntityPropertyValue | EntityRawData[];

export interface RawDataTracking {
  /**
   * Maintains references to a collection of raw data uploads accumulated during
   * the construction of an entity.
   *
   * This data will not be included in any operations delivered to the persister.
   * Each input is placed in a queue by the `RawDataUploader` for upload to
   * temporary storage and the associated storage URI is added to
   * `_rawDataTempUris`.
   */
  _rawData?: EntityRawData[];
}

/**
 * Raw data to store
 */
export type EntityRawData = {
  /**
   * A name that identifies the payload when there are multiple data sources
   * used to build an entity.
   *
   * This name is part of a permanent key associated with the data. It must be
   * unique within the context of the entity. `'default'` is an acceptable value
   * when there is only one data payload, though it is recommended to use names
   * that are more meaningful when there is more than one.
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
   * Any type of data representing the source content used to build an entity.
   */
  rawData: any;
};
