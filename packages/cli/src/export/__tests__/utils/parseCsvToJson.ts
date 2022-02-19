import csvToJson from 'csvtojson';

export function parseCsvToJson(json: string) {
  return csvToJson({
    checkType: true,
    flatKeys: true,
  }).fromString(json);
}
