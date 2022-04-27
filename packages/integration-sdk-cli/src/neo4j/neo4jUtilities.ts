export function startsWithNumeric(str: string): boolean {
  return /^\d/.test(str);
}

export function sanitizePropertyName(propertyName: string): string {
  let sanitizedName = '';
  if (startsWithNumeric(propertyName)) {
    sanitizedName += 'n';
  }
  sanitizedName += propertyName;
  sanitizedName = sanitizedName.replace(
    /[\s!@#$%^&*()\-=+\\|'";:/?.,><`~\t\n[\]{}]/g,
    '_',
  );
  return sanitizedName;
}

export function sanitizeValue(value: string): string {
  return value.replace(/\\*"/gi, '\\"');
}

export function buildPropertyParameters(propList: Object) {
  const propertyParameters = {};

  for (const key in propList) {
    const propVal = propList[key];

    if (key === '_rawData') {
      // stringify JSON in rawData so we can store it.
      propertyParameters[key] = `"${JSON.stringify(propVal)}"`;
    } else {
      // Sanitize out characters that aren't allowed in property names
      const propertyName = sanitizePropertyName(key);

      if (propVal === undefined || propVal === null) {
        // Ignore properties that have the value `undefined` or `null`.
        continue;
      }

      // If we're dealing with a number or boolean, leave alone, otherwise
      // wrap in single quotes to convert to a string and escape all
      // other single quotes so they don't terminate strings prematurely.
      if (typeof propVal == 'number' || typeof propVal == 'boolean') {
        propertyParameters[propertyName] = propVal;
      } else {
        propertyParameters[propertyName] = sanitizeValue(propVal.toString());
      }
    }
  }

  return propertyParameters;
}
