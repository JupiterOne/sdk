/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A specific repository or data store containing backup data.
 */
export type Backup = Entity & {
  /**
   * Indicates whether the backup data is encrypted.
   */
  encrypted?: boolean;
  [k: string]: unknown;
};
