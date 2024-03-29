/* eslint-disable */
import { RecordEntity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * An individual requirement for security, compliance, regulation or design.
 */
export type Requirement = RecordEntity & {
  /**
   * The title text of the requirement.
   */
  title: string;
  /**
   * The summary text of the requirement.
   */
  summary?: string;
  /**
   * The state of the requirement (e.g. 'implemented').
   */
  state?: string;
  [k: string]: unknown;
};
