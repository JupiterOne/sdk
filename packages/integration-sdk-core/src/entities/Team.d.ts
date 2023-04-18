/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A team consists of multiple member Person entities. For example, the Development team or the Security team.
 */
export type Team = Entity & {
  /**
   * The team email address
   */
  email?: string;
  [k: string]: unknown;
};