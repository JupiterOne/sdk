import { convertNameValuePairs, convertProperties } from '../converters';

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
