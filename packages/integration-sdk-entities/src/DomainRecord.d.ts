/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * The DNS Record of a Domain Zone.
 */
export type DomainRecord = Entity & {
  /**
   * DNS Record type.
   */
  type:
    | 'A'
    | 'AAAA'
    | 'ALIAS'
    | 'CAA'
    | 'CERT'
    | 'CNAME'
    | 'DNSKEY'
    | 'DS'
    | 'LOC'
    | 'MX'
    | 'NX'
    | 'NS'
    | 'NAPTR'
    | 'PTR'
    | 'SMIMEA'
    | 'SOA'
    | 'SPF'
    | 'SRV'
    | 'SSHFP'
    | 'TLSA'
    | 'TXT'
    | 'URI';
  /**
   * Time to Live before resolver cache expires.
   */
  TTL: number;
  /**
   * The record value. Could be referenced as `data`, `content`, `resourceRecords`, `aliasTarget` or another property name depending on the DNS provider.
   */
  value?: string | string[];
  [k: string]: unknown;
};