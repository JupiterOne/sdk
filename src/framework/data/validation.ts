import { RawDataTracking } from '../types';
import { IntegrationError } from '../../errors';

/**
 * Validates collection of raw data, throwing an error when invalid.
 *
 * @param trackingEntity entity with _rawData
 * @throws Error when a duplicate name is encountered
 */
export function validateRawData(trackingEntity: RawDataTracking): void {
  if (trackingEntity._rawData) {
    const names = new Set<string>();
    for (const data of trackingEntity._rawData) {
      if (names.has(data.name)) {
        throw new IntegrationError({
          code: 'DUPLICATE_RAW_DATA_NAME',
          message: `Duplicate raw data name '${data.name}'!`,
        });
      } else {
        names.add(data.name);
      }
    }
  }
}
