import { createHash } from 'crypto';
import camelCase from 'lodash/camelCase';

const TRUE_REGEX = /^true$/i;
const FALSE_REGEX = /^false$/i;
const BASE10_NUMBER_REGEX = /^\d+$/;
const FLOAT_NUMBER_REGEX = /^\d+\.\d+$/;

export function parseStringPropertyValue(
  value: string,
): string | boolean | number | undefined {
  if (!value) {
    return undefined;
  }
  if (TRUE_REGEX.test(value)) {
    return true;
  }
  if (FALSE_REGEX.test(value)) {
    return false;
  }
  if (BASE10_NUMBER_REGEX.test(value)) {
    return parseInt(value, 10);
  }
  if (FLOAT_NUMBER_REGEX.test(value)) {
    return parseFloat(value);
  }
  return value;
}

const TIME_PROPERTY_NAMES = /^\w+((T|_t)ime|(O|_o)n|(A|_a)t|(D|_d)ate)$/;
function isTimeProperty(property: string): boolean {
  return TIME_PROPERTY_NAMES.test(property);
}

type ConvertPropertiesOptions = {
  /**
   * Convert `Object` properties using `JSON.stringify(value)`. Without this
   * option, `Object` properties are not transferred.
   */
  stringifyObject?: boolean;

  /**
   * Convert `Array` properties using `JSON.stringify(value)`. Without this
   * option, `Array` properties are not transferred.
   */
  stringifyArray?: boolean;

  /**
   * Parse primitive properties (string, boolean, number). Without this
   * option, values are transferred as-is.
   */
  parseString?: boolean;

  /**
   * Parse properties that are named with date/time-like suffixes into number of
   * milliseconds since epoch (UNIX timestamp).
   */
  parseTime?: boolean;

  /**
   * Prefix property names as `<prefix>.<property>` when transferring to the
   * converted object.
   */
  prefix?: string;
};

export function convertProperties(
  object: any = {},
  options: ConvertPropertiesOptions = {},
) {
  const supportedTypes = ['string', 'boolean', 'number'];
  const converted: any = {};

  for (const [key, value] of Object.entries(object)) {
    if (value == null) {
      continue;
    }

    const newKey =
      options.prefix && options.prefix.length > 0
        ? `${options.prefix}.${camelCase(key)}`
        : camelCase(key);

    if (typeof value === 'boolean' || typeof value === 'number') {
      converted[newKey] = value;
    } else if (typeof value === 'string') {
      if (options.parseString) {
        converted[newKey] = parseStringPropertyValue(value);
      } else if (options.parseTime && isTimeProperty(key)) {
        const time = parseTimePropertyValue(value);
        converted[newKey] = time ? time : value;
      } else {
        converted[newKey] = value;
      }
    } else if (Array.isArray(value)) {
      const firstEntry = value.length > 0 ? value[0] : undefined;
      if (firstEntry == undefined) {
        continue;
      }

      if (options.stringifyArray) {
        converted[newKey] = JSON.stringify(value);
      } else {
        if (typeof firstEntry !== 'object' || options.stringifyObject) {
          const items: string[] | boolean[] | number[] = value.map((v) => {
            if (supportedTypes.includes(typeof v)) {
              return v;
            } else if (options.stringifyObject) {
              return JSON.stringify(v);
            }
          });
          if (items.length > 0) {
            converted[newKey] = items;
          }
        }
      }
    } else if (options.stringifyObject) {
      converted[newKey] = JSON.stringify(value);
    }
  }

  return converted;
}

interface NameValuePair {
  name?: string;
  value?: string;
  Name?: string;
  Value?: string;
}

export function convertNameValuePairs(
  data: NameValuePair[] | undefined,
  options: {
    parseString?: boolean;
    prefix?: string;
  } = {},
) {
  const obj: any = {};
  for (const item of data || []) {
    const n = item.name || item.Name;
    const v = item.value || item.Value;
    if (n && v) {
      const key =
        options.prefix && options.prefix.length > 0
          ? `${options.prefix}.${camelCase(n)}`
          : camelCase(n);
      const value = options.parseString ? parseStringPropertyValue(v) : v;
      obj[key] = value;
    }
  }
  return obj;
}

/**
 * @deprecated
 * @see parseTimePropertyValue
 */
export function getTime(
  time: Date | string | number | undefined,
): number | undefined {
  return parseTimePropertyValue(time);
}

/**
 * Produces a time value in milliseconds since epoch (UNIX timestamp) using `new
 * Date(time).getTime()`.
 *
 * @param time a time value
 */
export function parseTimePropertyValue(
  time: Date | string | number | undefined,
): number | undefined {
  if (time) {
    const parsed = new Date(time).getTime();
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
}

/**
 * @description calculates the base64 sha256 hash of the stringified object
 * @param object object to hash stringified version of
 */
export function sha256(object: object | string): string {
  const data = JSON.stringify(object);
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('base64');
}
