import { cloneDeep, isObject, isString } from 'lodash';

export function trimStringValues<T extends { [k: string]: any }>(object: T): T {
  const trimmed = cloneDeep(object);
  Object.keys(trimmed).forEach((key: keyof typeof trimmed) => {
    if (isString(trimmed[key])) {
      trimmed[key] = trimmed[key].trim();
    } else if (isObject(trimmed[key])) {
      trimmed[key] = trimStringValues(trimmed[key]);
    }
  });
  return trimmed;
}
