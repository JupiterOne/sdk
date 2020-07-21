import { Volume } from "memfs/lib/volume";

export function fetchAssetsContents(vol: Volume) {
  const files = vol.toJSON();
  return Object.keys(files)
    .filter(filename => filename.endsWith('.csv'))
    .map(filename => files[filename]) as string[];
}
