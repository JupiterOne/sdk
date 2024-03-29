/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A security or IT Control. A control can be implemented by a vendor/service, a person/team, a program/process, an automation code/script/configuration, or a system/host/device. Therefore, this is most likely an additional Class applied to a Service (e.g. Okta SSO), a Device (e.g. a physical firewall), or a HostAgent (e.g. Carbon Black CbDefense Agent). Controls are mapped to security policy procedures and compliance standards/requirements.
 */
export type Control = Entity & {
  /**
   * The function of the control. It can be a string or string array. Value of each item should be either all lower case or, in the case of an acronym, all upper case.
   */
  function?:
    | (
        | 'directory'
        | 'inventory'
        | 'access-control'
        | 'access-review'
        | 'compliance'
        | 'monitoring'
        | 'logging'
        | 'auditing'
        | 'scheduling'
        | 'configuration-audit'
        | 'key-management'
        | 'password-management'
        | 'secret-management'
        | 'config-management'
        | 'device-management'
        | 'patch-management'
        | 'endpoint-management'
        | 'endpoint-protection'
        | 'data-protection'
        | 'data-encryption'
        | 'pen-test'
        | 'bug-bounty'
        | 'appsec'
        | 'application-security'
        | 'container-security'
        | 'package-registry'
        | 'infrastructure'
        | 'ticketing'
        | 'training'
        | 'firewall'
        | 'networking'
        | 'wifi'
        | 'physical-access'
        | 'video-surveillance'
        | 'DNS'
        | 'VPN'
        | 'IAM'
        | 'SSO'
        | 'MFA'
        | 'PAM'
        | 'DLP'
        | 'SAST'
        | 'DAST'
        | 'IAST'
        | 'MAST'
        | 'RASP'
        | 'SCA'
        | 'SCM'
        | 'VAS'
        | 'VMS'
        | 'AV'
        | 'CA'
        | 'PKI'
        | 'IDS'
        | 'IPS'
        | 'HIDS'
        | 'NIDS'
        | 'WAF'
        | 'MDM'
        | 'EMM'
        | 'EDR'
        | 'EPP'
        | 'SIEM'
        | 'ITAM'
        | 'ITSM'
        | 'SSH'
        | 'SFTP'
        | 'VRM'
      )
    | (
        | 'directory'
        | 'inventory'
        | 'access-control'
        | 'access-review'
        | 'compliance'
        | 'monitoring'
        | 'logging'
        | 'auditing'
        | 'scheduling'
        | 'configuration-audit'
        | 'key-management'
        | 'password-management'
        | 'secret-management'
        | 'config-management'
        | 'device-management'
        | 'patch-management'
        | 'endpoint-management'
        | 'endpoint-protection'
        | 'data-protection'
        | 'data-encryption'
        | 'pen-test'
        | 'bug-bounty'
        | 'appsec'
        | 'application-security'
        | 'container-security'
        | 'package-registry'
        | 'infrastructure'
        | 'ticketing'
        | 'training'
        | 'firewall'
        | 'networking'
        | 'wifi'
        | 'physical-access'
        | 'video-surveillance'
        | 'DNS'
        | 'VPN'
        | 'IAM'
        | 'SSO'
        | 'MFA'
        | 'PAM'
        | 'DLP'
        | 'SAST'
        | 'DAST'
        | 'IAST'
        | 'MAST'
        | 'RASP'
        | 'SCA'
        | 'SCM'
        | 'VAS'
        | 'VMS'
        | 'AV'
        | 'CA'
        | 'PKI'
        | 'IDS'
        | 'IPS'
        | 'HIDS'
        | 'NIDS'
        | 'WAF'
        | 'MDM'
        | 'EMM'
        | 'EDR'
        | 'EPP'
        | 'SIEM'
        | 'ITAM'
        | 'ITSM'
        | 'SSH'
        | 'SFTP'
        | 'VRM'
      )[];
  [k: string]: unknown;
};
