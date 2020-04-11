import { promises as fs } from 'fs';

import { vol } from 'memfs';
import { v4 as uuid } from 'uuid';
import times from 'lodash/times';

import {
  FileSystemGraphObjectStore,
  GRAPH_OBJECT_BUFFER_THRESHOLD,
} from '../FileSystemGraphObjectStore';

import { generateEntity, generateRelationship } from './util/graphObjects';

import { Entity, Relationship } from '../../../types';

jest.mock('fs');

afterEach(() => {
  vol.reset();
});

describe('flushEntitiesToDisk', () => {
  test('should write entities to the graph directory and symlink files to the index directory', async () => {
    const { cacheDirectory, step, jobState } = setupLocalStepJobState();
    const entityType = uuid();
    const entities = times(25, () => generateEntity({ _type: entityType }));
    await jobState.addEntities(entities);

    await jobState.flushEntitiesToDisk();

    const entitiesDirectory = `${cacheDirectory}/graph/${step}/entities`;

    const stepDataFiles = await fs.readdir(entitiesDirectory);
    expect(stepDataFiles).toHaveLength(1);

    const writtenStepData = await fs.readFile(
      `${entitiesDirectory}/${stepDataFiles[0]}`,
      'utf8',
    );
    expect(JSON.parse(writtenStepData)).toEqual({ entities });

    const stats = await fs.lstat(
      `${cacheDirectory}/index/entities/${entityType}/${stepDataFiles[0]}`,
    );
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(
      `${cacheDirectory}/index/entities/${entityType}/${stepDataFiles[0]}`,
      'utf8',
    );
    expect(symlinkedData).toEqual(writtenStepData);
  });
});

describe('flushRelationshipsToDisk', () => {
  test('should write relationships to the graph directory and symlink files to the index directory', async () => {
    const { cacheDirectory, step, jobState } = setupLocalStepJobState();
    const relationshipType = uuid();
    const relationships = times(25, () =>
      generateRelationship({ _type: relationshipType }),
    );
    await jobState.addRelationships(relationships);

    await jobState.flushRelationshipsToDisk();

    const relationshipsDirectory = `${cacheDirectory}/graph/${step}/relationships`;

    const stepDataFiles = await fs.readdir(relationshipsDirectory);
    expect(stepDataFiles).toHaveLength(1);

    const writtenData = await fs.readFile(
      `${relationshipsDirectory}/${stepDataFiles[0]}`,
      'utf8',
    );
    expect(JSON.parse(writtenData)).toEqual({ relationships });

    const stats = await fs.lstat(
      `${cacheDirectory}/index/relationships/${relationshipType}/${stepDataFiles[0]}`,
    );
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(
      `${cacheDirectory}/index/relationships/${relationshipType}/${stepDataFiles[0]}`,
      'utf8',
    );
    expect(symlinkedData).toEqual(writtenData);
  });
});

describe('flush', () => {
  test('should flush both entities and relationships to disk', async () => {
    const { jobState } = setupLocalStepJobState();
    await jobState.addEntities([generateEntity()]);
    await jobState.addRelationships([generateRelationship()]);

    const flushEntitiesSpy = jest.spyOn(jobState, 'flushEntitiesToDisk');
    const flushRelationshipsSpy = jest.spyOn(
      jobState,
      'flushRelationshipsToDisk',
    );

    await jobState.flush();

    expect(flushEntitiesSpy).toHaveBeenCalledTimes(1);
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('addEntities', () => {
  test('should automatically flush entities to disk after hitting a certain threshold', async () => {
    const { jobState } = setupLocalStepJobState();
    const entities = times(GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
      generateEntity(),
    );

    const flushEntitiesSpy = jest.spyOn(jobState, 'flushEntitiesToDisk');
    await jobState.addEntities(entities);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushEntitiesSpy).toHaveBeenCalledTimes(0);

    // adding an additional entity should trigger the flushing
    await jobState.addEntities([generateEntity()]);
    expect(flushEntitiesSpy).toHaveBeenCalledTimes(1);
  });
});

describe('addRelationships', () => {
  test('should automatically flush relationships to disk after hitting a certain threshold', async () => {
    const { jobState } = setupLocalStepJobState();
    const relationships = times(GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
      generateRelationship(),
    );

    const flushRelationshipsSpy = jest.spyOn(
      jobState,
      'flushRelationshipsToDisk',
    );
    await jobState.addRelationships(relationships);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(0);

    // adding an additional relationship should trigger the flushing
    await jobState.addRelationships([generateRelationship()]);
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('iterateEntities', () => {
  test('should flush buffered entities and iterate the entity "_type" index stored on disk', async () => {
    const { jobState } = setupLocalStepJobState();

    const matchingType = uuid();

    const nonMatchingEntities = times(25, () =>
      generateEntity({ _type: uuid() }),
    );
    const matchingEntities = times(25, () =>
      generateEntity({ _type: matchingType }),
    );

    await jobState.addEntities([...nonMatchingEntities, ...matchingEntities]);

    const collectedEntities: Entity[] = [];
    const collectEntity = (e: Entity) => {
      collectedEntities.push(e);
    };

    await jobState.iterateEntities({ _type: matchingType }, collectEntity);
    expect(jobState.entities).toHaveLength(0);

    expect(collectedEntities).toEqual(matchingEntities);
  });
});

describe('iterateRelationships', () => {
  test('should flush buffered relationshipos and iterate the relationship "_type" index stored on disk', async () => {
    const { jobState } = setupLocalStepJobState();

    const matchingType = uuid();

    const nonMatchingRelationships = times(25, () =>
      generateRelationship({ _type: uuid() }),
    );
    const matchingRelationships = times(25, () =>
      generateRelationship({ _type: matchingType }),
    );

    await jobState.addRelationships([
      ...nonMatchingRelationships,
      ...matchingRelationships,
    ]);
    await jobState.flush();

    const collectedRelationships: Relationship[] = [];
    const collectRelationship = (r: Relationship) => {
      collectedRelationships.push(r);
    };

    await jobState.iterateRelationships(
      { _type: matchingType },
      collectRelationship,
    );
    expect(jobState.relationships).toHaveLength(0);

    expect(collectedRelationships).toEqual(matchingRelationships);
  });
});

function setupLocalStepJobState() {
  const step = uuid();
  const cacheDirectory = '/' + uuid();
  const jobState = new FileSystemGraphObjectStore({ step, cacheDirectory });

  return {
    step,
    cacheDirectory,
    jobState,
  };
}
