import { Promisable } from 'type-fest';

import { Entity, Relationship } from '../../types';
import { JobState, GraphObjectFilter, GraphObjectIteratee } from '../types';

import { flushDataToDisk } from './flushDataToDisk';

export const GRAPH_OBJECT_BUFFER_THRESHOLD = 500; // arbitrarily selected, subject to tuning

interface LocalStepJobStateInput {
  step: string;
  cacheDirectory?: string;
}

export class LocalStepJobState implements JobState {
  readonly cacheDirectory?: string;
  readonly step: string;

  entities: Entity[];
  relationships: Relationship[];

  constructor({ step, cacheDirectory }: LocalStepJobStateInput) {
    this.step = step;
    this.cacheDirectory = cacheDirectory;

    this.entities = [];
    this.relationships = [];
  }

  async addEntities(newEntities: Entity[]) {
    this.entities = this.entities.concat(newEntities);

    if (this.entities.length >= GRAPH_OBJECT_BUFFER_THRESHOLD) {
      await this.flushEntitiesToDisk();
    }
  }

  async addRelationships(newRelationships: Relationship[]) {
    this.relationships = this.relationships.concat(newRelationships);

    if (this.relationships.length >= GRAPH_OBJECT_BUFFER_THRESHOLD) {
      await this.flushRelationshipsToDisk();
    }
  }

  async iterateEntities(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Entity>,
  ) {
    /* stub for now */
    return;
  }

  async iterateRelationships(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Relationship>,
  ) {
    /* stub for now */
    return;
  }

  async flush() {
    const work: Promisable<void>[] = [];

    if (this.entities.length) {
      work.push(this.flushEntitiesToDisk());
    }

    if (this.relationships.length) {
      work.push(this.flushRelationshipsToDisk());
    }

    await Promise.all(work);
  }

  async flushEntitiesToDisk() {
    await flushDataToDisk({
      step: this.step,
      cacheDirectory: this.cacheDirectory,
      collectionType: 'entities',
      data: this.entities,
    });

    this.entities = [];
  }

  async flushRelationshipsToDisk() {
    await flushDataToDisk({
      step: this.step,
      cacheDirectory: this.cacheDirectory,
      collectionType: 'relationships',
      data: this.relationships,
    });

    this.relationships = [];
  }
}
