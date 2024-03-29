/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A software agent or sensor that runs on a host/endpoint.
 */
export type HostAgent = Entity & {
  /**
   * The function of sensor/agent
   */
  function: (
    | 'endpoint-compliance'
    | 'endpoint-configuration'
    | 'endpoint-protection'
    | 'anti-malware'
    | 'DLP'
    | 'FIM'
    | 'host-firewall'
    | 'HIDS'
    | 'log-monitor'
    | 'activity-monitor'
    | 'vulnerability-detection'
    | 'container-security'
    | 'other'
  )[];
  [k: string]: unknown;
};
