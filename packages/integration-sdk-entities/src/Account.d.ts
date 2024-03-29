/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * An organizational account for a service or a set of services (e.g. AWS, Okta, Bitbucket Team, Google G-Suite account, Apple Developer Account). Each Account should be connected to a Service.
 */
export type Account = Entity & {
  /**
   * The main URL to access this account, e.g. https://jupiterone.okta.com
   */
  accessURL?: string;
  /**
   * Specifies whether multi-factor authentication (MFA) is enabled/required for users of this account.
   */
  mfaEnabled?: boolean;
  [k: string]: unknown;
};
