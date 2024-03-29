/* eslint-disable */
import { Entity } from './Base';

/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A physical device or media, such as a server, laptop, workstation, smartphone, tablet, router, firewall, switch, wifi-access-point, usb-drive, etc. The exact data type is described in the _type property of the Entity.
 */
export type Device = Entity & {
  /**
   * The device category
   */
  category: string | null;
  /**
   * Same as hardwareVendor: The manufacturer or vendor of the device, e.g. Apple Inc., Generic
   */
  make: string | null;
  /**
   * Same as hardwareModel: The device hardware model, e.g. MacBookPro13,3
   */
  model: string | null;
  /**
   * Same as hardwareVersion: The device hardware version
   */
  version?: string;
  /**
   * Same as hardwareSerial: The device serial number
   */
  serial: string | null;
  /**
   * The unique device identifier, traditionally known as a UDID
   */
  deviceId: string | null;
  /**
   * The manufacturer or vendor of the device, e.g. Apple Inc., Generic
   */
  hardwareVendor?: string;
  /**
   * The device hardware model, e.g. MacBookPro13,3
   */
  hardwareModel?: string;
  /**
   * The device hardware version
   */
  hardwareVersion?: string;
  /**
   * The device serial number
   */
  hardwareSerial?: string;
  /**
   * The asset tag number/label that matches the identifier in asset tracking system, for company owned physical devices
   */
  assetTag?: string;
  /**
   * Operating System Platform
   */
  platform?:
    | 'darwin'
    | 'linux'
    | 'unix'
    | 'windows'
    | 'android'
    | 'ios'
    | 'embedded'
    | 'other';
  /**
   * Operating System Full Details (e.g. macOS High Sierra version 10.13.6)
   */
  osDetails?: string;
  /**
   * Operating System Name (e.g. macOS)
   */
  osName?: string;
  /**
   * Operating System Version (e.g. 10.13.6)
   */
  osVersion?: string;
  /**
   * The email addresses of the users this device is assigned to. Used if the device is shared by more than one user. Otherwise the 'owner' is the sole user. Leave empty/undefined if the device is unassigned.
   */
  userEmails?: string[];
  /**
   * Site where this device is located.
   */
  location?: string;
  /**
   * The purchase cost of the device.
   */
  cost?: number;
  /**
   * The estimated business value of the device. The value is typically calculated as the monetary cost of the device + the value of data on the device.
   */
  value?: number;
  /**
   * Indicates if this is a BYOD device -- an employee-provided device that has access to company systems/resources.
   */
  BYOD?: boolean;
  /**
   * Indicates if security updates are auto-installed
   */
  autoSecurityPatchEnabled?: boolean;
  /**
   * Indicates if operating system updates are auto-installed
   */
  autoSystemPatchEnabled?: boolean;
  /**
   * Indicates if the primary device storage is encrypted
   */
  encrypted?: boolean;
  /**
   * Indicates if malware protection is enabled
   */
  malwareProtected?: boolean;
  /**
   * Indicates if local/host firewall is enabled
   */
  firewallEnabled?: boolean;
  /**
   * Indicates if remote access/login to the device is enabled
   */
  remoteAccessEnabled?: boolean;
  /**
   * Indicates if screen lock protection is enabled
   */
  screenLockEnabled?: boolean;
  /**
   * Screen lock timeout in seconds
   */
  screenLockTimeout?: number;
  /**
   * Status label of this device
   */
  status?:
    | 'assigned'
    | 'archived'
    | 'decommissioned'
    | 'defective'
    | 'deployed'
    | 'disposed'
    | 'locked'
    | 'lost/stolen'
    | 'pending'
    | 'ready'
    | 'unknown'
    | 'other';
  [k: string]: unknown;
};
