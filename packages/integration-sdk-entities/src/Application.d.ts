/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A software product or application.
 */
export type Application = Entity & {
  /**
   * Indicates if this is a Commercial Off-The-Shelf software application. Custom in-house developed application should have this set to false.
   */
  COTS?: boolean;
  /**
   * Indicates if this is a Free or Open-Source software application or library. Custom in-house developed application should have this set to false.
   */
  FOSS?: boolean;
  /**
   * Indicates if this is a Software-as-a-Service product.
   */
  SaaS?: boolean;
  /**
   * Indicates if this is an externally acquired software application. Custom in-house developed application should have this set to false.
   */
  external?: boolean;
  /**
   * Indicates if this is a mobile app.
   */
  mobile?: boolean;
  /**
   * Stores the type of license
   */
  license?: string;
  /**
   * The URL to the full license
   */
  licenseURL?: string;
  /**
   * The Production URL
   */
  productionURL?: string;
  /**
   * The Non-Production / Staging URL
   */
  stagingURL?: string;
  /**
   * The Development URL
   */
  devURL?: string;
  /**
   * The Test URL
   */
  testURL?: string;
  /**
   * The additional URLs related to this application.
   */
  alternateURLs?: string[];
  [k: string]: unknown;
};
