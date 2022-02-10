import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

import { MockJobState, createMockJobState } from '../jobState';

describe('data', () => {
  test('creates a job state object that can set and get data', async () => {
    const jobState = createMockJobState();
    await jobState.setData('my-key', 'whatever');
    await expect(jobState.getData('my-key')).resolves.toEqual('whatever');
  });

  test('initializes a job state object with data that can be gotten', async () => {
    const jobState = createMockJobState({ setData: { 'my-key': 'whatever' } });
    await expect(jobState.getData('my-key')).resolves.toEqual('whatever');
  });

  test('replaces existing data', async () => {
    const jobState = createMockJobState();
    await jobState.setData('my-key', 'whatever');
    await jobState.setData('my-key', 'ohyeah');
    await expect(jobState.getData('my-key')).resolves.toEqual('ohyeah');
  });

  test('should return "undefined" when a key is not found', async () => {
    const jobState = createMockJobState();
    expect(await jobState.getData('unknown')).toEqual(undefined);
  });

  test('should return "undefined" when data is deleted', async () => {
    const jobState = createMockJobState();
    await jobState.setData('my-key', 'whatever');
    await jobState.deleteData('my-key');
    await expect(jobState.getData('my-key')).resolves.toEqual(undefined);
  });

  describe('collectedData', () => {
    test('should return collectedData', async () => {
      const jobState = createMockJobState();
      await jobState.setData('my-key', 'whatever');
      expect(jobState.collectedData).toEqual({ 'my-key': 'whatever' });
    });

    test('should not include pre-existing relationships in collectedData', () => {
      const jobState = createMockJobState({
        setData: { 'my-key': 'whatever' },
      });
      expect(jobState.collectedData).toEqual({});
    });
  });
});

describe('entities', () => {
  const inputEntities: Entity[] = [
    {
      _type: 'test_a',
      _class: 'Resource',
      _key: 'a',
    },
    {
      _type: 'test_a',
      _class: 'Resource',
      _key: 'b',
    },
    {
      _type: 'test_b',
      _class: 'Resource',
      _key: 'c',
    },
  ];

  test('creates a job state object that can collect and query an array of entities', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState();
    const entities = await jobState.addEntities(inputEntities);

    await assertEntityFilteringCapabilities(jobState);

    expect(entities).toBe(inputEntities);
    expect(jobState.collectedEntities).toEqual(inputEntities);
  });

  test('creates a job state object that can collect a single entity', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState();
    const entity = await jobState.addEntity(inputEntities[0]);
    expect(entity).toBe(inputEntities[0]);
    expect(jobState.collectedEntities).toEqual([entity]);
  });

  test('does not include pre-existing entities in collectedEntities', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState({ entities: inputEntities });
    await assertEntityFilteringCapabilities(jobState);

    expect(jobState.collectedEntities).toEqual([]);
  });

  test('findEntity returns entity from jobState when _key matches', async () => {
    const jobState = createMockJobState();
    await jobState.addEntities(inputEntities);
    const result = await jobState.findEntity('a');
    expect(result).toEqual(inputEntities[0]);
  });

  test('findEntity returns initialized entity from jobState when _key matches', async () => {
    const jobState = createMockJobState({ entities: inputEntities });
    const result = await jobState.findEntity('a');
    expect(result).toEqual(inputEntities[0]);
  });

  test('findEntity returns initialized entity from jobState when _key matches with key normalization', async () => {
    const jobState = createMockJobState({
      normalizeGraphObjectKey: (_key) => _key.toLowerCase(),
    });
    const inputEntity = {
      _type: 'test',
      _class: 'Resource',
      _key: 'INCONSISTENT-casing',
    };
    await jobState.addEntities([inputEntity]);
    const result = await jobState.findEntity('inconsistent-CASING');
    expect(result).toEqual(inputEntity);
  });

  test('findEntity returns null when entity cannot be found in jobState', async () => {
    const jobState = createMockJobState();
    expect(await jobState.findEntity('does-not-exist')).toEqual(null);
  });

  async function assertEntityFilteringCapabilities(jobState: MockJobState) {
    const entitiesA: Entity[] = [];
    await jobState.iterateEntities({ _type: 'test_a' }, (e) => {
      entitiesA.push(e);
    });

    const entitiesB: Entity[] = [];
    await jobState.iterateEntities({ _type: 'test_b' }, (e) => {
      entitiesB.push(e);
    });

    expect(entitiesA).toEqual([inputEntities[0], inputEntities[1]]);
    expect(entitiesB).toEqual([inputEntities[2]]);
  }
});

describe('relationships', () => {
  const inputRelationships: Relationship[] = [
    {
      _type: 'test_a',
      _class: 'HAS',
      _key: 'a|test|b',
      _toEntityKey: 'a',
      _fromEntityKey: 'b',
    },
    {
      _type: 'test_a',
      _class: 'HAS',
      _key: 'b|test|c',
      _toEntityKey: 'b',
      _fromEntityKey: 'c',
    },
    {
      _type: 'test_b',
      _class: 'HAS',
      _key: 'c|test|d',
      _toEntityKey: 'c',
      _fromEntityKey: 'd',
    },
  ];

  test('creates a job state object that can collect and query relationships', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState();
    await jobState.addRelationships(inputRelationships);

    await assertRelationshipFilteringCapabilities(jobState);

    expect(jobState.collectedRelationships).toEqual(inputRelationships);
  });

  test('allows a single relationship to be added with "addRelationship"', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState();
    await jobState.addRelationship(inputRelationships[0]);
    expect(jobState.collectedEntities.length).toEqual(0);
    expect(jobState.collectedRelationships).toEqual([inputRelationships[0]]);
  });

  test('does not include pre-existing relationships in collectedRelationships', async () => {
    expect.hasAssertions();
    const jobState = createMockJobState({ relationships: inputRelationships });
    await assertRelationshipFilteringCapabilities(jobState);

    expect(jobState.collectedRelationships).toEqual([]);
  });

  async function assertRelationshipFilteringCapabilities(
    jobState: MockJobState,
  ) {
    const relationshipsA: Relationship[] = [];
    await jobState.iterateRelationships({ _type: 'test_a' }, (e) => {
      relationshipsA.push(e);
    });

    const relationshipsB: Relationship[] = [];
    await jobState.iterateRelationships({ _type: 'test_b' }, (e) => {
      relationshipsB.push(e);
    });

    expect(relationshipsA).toEqual([
      inputRelationships[0],
      inputRelationships[1],
    ]);
    expect(relationshipsB).toEqual([inputRelationships[2]]);
  }
});
