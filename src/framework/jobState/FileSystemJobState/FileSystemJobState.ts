import { Entity, Relationship } from '../../types';
import { JobState, GraphObjectFilter, GraphObjectIteratee } from '../types';

import { flushDataToDisk } from './flushDataToDisk';

import {
  iterateEntityTypeIndex,
  iterateRelationshipTypeIndex,
} from './indices';

export const GRAPH_OBJECT_BUFFER_THRESHOLD = 500; // arbitrarily selected, subject to tuning

interface LocalStepJobStateInput {
  step: string;
  cacheDirectory?: string;
}

export class FileSystemJobState implements JobState {
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
    await this.flushEntitiesToDisk();

    await iterateEntityTypeIndex({
      cacheDirectory: this.cacheDirectory,
      type: filter._type,
      iteratee,
    });
  }

  async iterateRelationships(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Relationship>,
  ) {
    await this.flushRelationshipsToDisk();

    await iterateRelationshipTypeIndex({
      cacheDirectory: this.cacheDirectory,
      type: filter._type,
      iteratee,
    });
  }

  async flush() {
    await Promise.all([
      this.flushEntitiesToDisk(),
      this.flushRelationshipsToDisk(),
    ]);
  }

  async flushEntitiesToDisk() {
    if (this.entities.length) {
      await flushDataToDisk({
        step: this.step,
        cacheDirectory: this.cacheDirectory,
        collectionType: 'entities',
        data: this.entities,
      });

      this.entities = [];
    }
  }

  async flushRelationshipsToDisk() {
    if (this.relationships.length) {
      await flushDataToDisk({
        step: this.step,
        cacheDirectory: this.cacheDirectory,
        collectionType: 'relationships',
        data: this.relationships,
      });

      this.relationships = [];
    }
  }
}
