import {
  convertNameValuePairs,
  convertProperties,
  parseTimePropertyValue,
  truncateEntityPropertyValue,
} from '../converters';

function strWithLen(len: number) {
  let str = '';
  for (let i = 0; i < len; i++) str += 'a';
  return str;
}

describe('convertProperties', () => {
  const original: any = {
    string: 'a',
    array: ['a', 'b', 'c'],
    number: 123,
    // eslint-disable-next-line
    snake_case: 'snake',
    TitleCase: 'title',
    aGoodTime: '2019-04-23T18:06:05Z',
    another_time: '2019-04-23T18:06:05Z',
    someDate: '2019-04-23T18:06:05Z',
    occurredOn: '2019-04-23T18:06:05Z',
    updatedAt: '2019-04-23T18:06:05Z',
    aBadTime: 'do I look like time to you?',
    anUndefinedTime: undefined,
    aNullTime: null,
    object: {
      name: 'me',
    },
    objectArray: [
      {
        wut: 'no matter',
      },
    ],
    arrayOfNull: [null],
    arrayOfUndefined: [undefined],
  };

  const converted: any = {
    string: 'a',
    array: ['a', 'b', 'c'],
    number: 123,
    snakeCase: 'snake',
    titleCase: 'title',
    aGoodTime: '2019-04-23T18:06:05Z',
    anotherTime: '2019-04-23T18:06:05Z',
    someDate: '2019-04-23T18:06:05Z',
    occurredOn: '2019-04-23T18:06:05Z',
    updatedAt: '2019-04-23T18:06:05Z',
    aBadTime: 'do I look like time to you?',
  };

  test('default options', () => {
    expect(convertProperties(original, {})).toEqual(converted);
  });

  test('stringify object', () => {
    expect(convertProperties(original, { stringifyObject: true })).toEqual({
      ...converted,
      object: JSON.stringify(original.object),
      objectArray: [JSON.stringify(original.objectArray[0])],
    });
  });

  test('stringify array', () => {
    expect(convertProperties(original, { stringifyArray: true })).toEqual({
      ...converted,
      array: JSON.stringify(original.array),
      objectArray: JSON.stringify(original.objectArray),
    });
  });

  test('parseTime', () => {
    expect(convertProperties(original, { parseTime: true })).toEqual({
      ...converted,
      aGoodTime: 1556042765000,
      anotherTime: 1556042765000,
      someDate: 1556042765000,
      occurredOn: 1556042765000,
      updatedAt: 1556042765000,
    });
  });
});

describe('convertNameValuePairs', () => {
  const nameValuePairs = [
    {
      name: 'one',
      value: '1',
    },
    {
      name: 'two',
      value: '2',
    },
  ];

  test('without any option', () => {
    expect(convertNameValuePairs(nameValuePairs)).toEqual({
      one: '1',
      two: '2',
    });
  });

  test('with parseString', () => {
    expect(
      convertNameValuePairs(nameValuePairs, {
        parseString: true,
      }),
    ).toEqual({
      one: 1,
      two: 2,
    });
  });

  test('with prefix', () => {
    expect(
      convertNameValuePairs(nameValuePairs, {
        prefix: 'n',
      }),
    ).toEqual({
      'n.one': '1',
      'n.two': '2',
    });
  });
});

describe('#truncateEntityPropertyValue', () => {
  test('should handle falsy values', () => {
    expect(truncateEntityPropertyValue(undefined)).toBeUndefined();
    expect(truncateEntityPropertyValue('')).toEqual('');
  });

  test('should not trim length of value if less than maximum length', () => {
    const value = strWithLen(4095);
    expect(truncateEntityPropertyValue(value)).toEqual(value);
  });

  test('should not trim length of value if equal to maximum length', () => {
    const value = strWithLen(4096);
    expect(truncateEntityPropertyValue(value)).toEqual(value);
  });

  test('should trim length of value if greater than maximum length', () => {
    const value = strWithLen(4097);

    expect(truncateEntityPropertyValue(value)).toEqual(
      value.substr(0, 4096 - 3) + '...',
    );
  });
});

describe('#parseTimePropertyValue', () => {
  test('should return undefined', () => {
    expect(parseTimePropertyValue(null)).toBeUndefined();
    expect(parseTimePropertyValue(undefined)).toBeUndefined();
    expect(parseTimePropertyValue('')).toBeUndefined();
    expect(parseTimePropertyValue(0 as any)).toBeUndefined();
    expect(parseTimePropertyValue('bargbklselk')).toBeUndefined();
  });
  test('should correctly parse Date', () => {
    expect(parseTimePropertyValue(new Date('2020-10-06T17:41:28Z'))).toBe(
      1602006088000,
    );
    expect(parseTimePropertyValue(new Date('2020-10-06'))).toBe(1601942400000);
  });
  test('should correctly parse string', () => {
    expect(parseTimePropertyValue('2020-10-06T17:41:28Z')).toBe(1602006088000);
    expect(parseTimePropertyValue('2020-10-06')).toBe(1601942400000);
    expect(parseTimePropertyValue('2020-10-06T17:41:28.999999999Z')).toBe(
      1602006088999,
    );
    expect(parseTimePropertyValue('2020-10-06T17:41:28.9999+00:00')).toBe(
      1602006088999,
    );
    expect(parseTimePropertyValue('1601942400' as any, 'sec')).toBe(
      1601942400000,
    );
    expect(parseTimePropertyValue('1601942400.887' as any, 'sec')).toBe(
      1601942400887,
    );
  });
  test('parsing number without precision', () => {
    expect(() => parseTimePropertyValue(1601942400 as any)).toThrowError(
      new Error('Argument sourcePrecision is required when parsing a number.'),
    );
    expect(() => parseTimePropertyValue('1601942400' as any)).toThrowError(
      new Error('Argument sourcePrecision is required when parsing a number.'),
    );
  });
  test('parsing number', () => {
    // Seconds
    expect(parseTimePropertyValue(parseInt('1601942400', 10), 'sec')).toBe(
      1601942400000,
    );
    expect(parseTimePropertyValue(Number(1601942400), 'sec')).toBe(
      1601942400000,
    );
    expect(parseTimePropertyValue(1601942400.99999, 'sec')).toBe(1601942400999);
    expect(parseTimePropertyValue(1601942400.0083234234, 'sec')).toBe(
      1601942400008,
    );
    // Milliseconds
    expect(parseTimePropertyValue(1601942400000, 'ms')).toBe(1601942400000);
    expect(parseTimePropertyValue(1601942400000.999, 'ms')).toBe(1601942400000);
  });
});
