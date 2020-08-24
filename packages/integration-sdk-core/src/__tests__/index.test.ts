import { RelationshipClass } from '../index';

describe('#RelationshipClass', () => {
  test('should export @jupiterone/data-model properties in the index', () => {
    expect(
      Object.values(RelationshipClass).filter((v) => typeof v !== 'string')
        .length,
    ).toEqual(0);
    expect(RelationshipClass.HAS).toEqual('HAS');
  });
});
