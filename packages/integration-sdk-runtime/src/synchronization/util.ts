import { promisify } from 'util';
import { gzip } from 'zlib';

const gz = promisify(gzip);
export async function gzipData(data: object) {
  return await gz(JSON.stringify(data));
}
