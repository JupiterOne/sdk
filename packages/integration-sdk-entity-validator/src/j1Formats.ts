import Ajv, { Format as AjvFormat } from 'ajv';
import addFormats from 'ajv-formats';

const ipv4 = addFormats.get('ipv4') as RegExp;
const ipv6 = addFormats.get('ipv6') as RegExp;

const ipv4CidrRegex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[12]?[0-9])$/;
const ipv6CidrRegex =
  /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$|^([0-9a-fA-F]{1,4}:){1,7}:\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$|^::\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$|^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$/;

const asnRegex = /^AS\d{2,6}$/;

const j1JsonSchemaFormats = {
  ip: (x) => ipv4.test(x) || ipv6.test(x),
  ipCidr: (x) => ipv4CidrRegex.test(x) || ipv6CidrRegex.test(x),
  asn: (x: string) => asnRegex.test(x),
} satisfies Record<string, AjvFormat>;

export const addJ1Formats = (ajvInstance: Ajv) => {
  for (const [name, format] of Object.entries(j1JsonSchemaFormats)) {
    ajvInstance.addFormat(name, format);
  }
  return ajvInstance;
};
