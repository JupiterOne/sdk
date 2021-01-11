import { cloneDeep, isObject, isString } from 'lodash';

export function trimStringValues<T extends { [k: string]: any }>(
  object: T,
  fieldsToSkip: string[] = [],
): T {
  const trimmed = cloneDeep(object);
  Object.keys(trimmed).forEach((key: keyof T) => {
    const val = trimmed[key];
    if (isString(val) && !fieldsToSkip.includes(key as string)) {
      trimmed[key] = val.trim();
    } else if (isObject(val)) {
      trimmed[key] = trimStringValues(val, fieldsToSkip);
    }
  });
  return trimmed;
}
