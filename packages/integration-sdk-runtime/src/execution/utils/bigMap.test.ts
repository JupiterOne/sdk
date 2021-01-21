import { BigMap } from './bigMap';

describe('#BigMap', () => {
  test('should insert data into default map if under maximum key space limit', () => {
    const m = new BigMap<string, number>(5);
    m.set('a', 1);
    expect(m.has('a')).toEqual(true);
    expect(m.get('a')).toEqual(1);
    expect(m.getMapsLength()).toEqual(1);
  });

  test('should create a new map when key space limit reached', () => {
    const maximumMapKeySpace = 5;
    const m = new BigMap<string, number>(maximumMapKeySpace);
    const totalKeys = maximumMapKeySpace + 1;

    for (let i = 0; i < totalKeys; i++) {
      m.set(`k_${i}`, i);
    }

    for (let i = 0; i < totalKeys; i++) {
      expect(m.get(`k_${i}`)).toEqual(i);
    }

    expect(m.getMapsLength()).toEqual(2);
  });

  test('#get should return undefined if key not found', () => {
    const m = new BigMap<string, number>(5);
    expect(m.get('a')).toEqual(undefined);
  });

  test('#has should return false if key not found', () => {
    const m = new BigMap<string, number>(5);
    expect(m.has('a')).toEqual(false);
  });
});
