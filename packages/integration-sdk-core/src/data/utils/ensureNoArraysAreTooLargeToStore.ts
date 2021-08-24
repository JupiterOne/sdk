import { AdditionalEntityProperties } from '..';

export function ensureNoArraysAreTooLargeToStore(
  properties: AdditionalEntityProperties | undefined,
): void | never {
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (Array.isArray(value)) {
      if (value.length >= 1_500) {
        throw new Error(
          `Property ${key} has too many array elements to be stored: ${value.length}`,
        );
      } else if (value.length >= 1_000) {
        console.warn(
          { propertyName: key, length: value.length },
          `Property is close to having too many array elements to be stored.`,
        );
      }
    }
  }
}
