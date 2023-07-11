import { FlushedGraphObjectData } from '../../storage/types';
import {
  createTestEntity,
  createTestRelationship,
} from '@jupiterone/integration-sdk-private-test-utils';
import { randomUUID as uuid } from 'crypto';
import { createApiClient, getApiBaseUrl } from '../../api';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';
import { createMockIntegrationLogger } from '../../../test/util/fixtures';
import { Entity, EntityRawData, Relationship } from '@jupiterone/integration-sdk-core';
import {
  BYTES_IN_MB,
  SynchronizationJobContext,
  uploadGraphObjectData,
} from '..';

function createFlushedGraphObjectData(
  numEntity: number,
  numRelationship: number,
): FlushedGraphObjectData {
  const entities: Entity[] = [];
  for (let i = 0; i < numEntity; i++) {
    entities.push(createTestEntity());
  }
  const relationships: Relationship[] = [];
  for (let i = 0; i < numRelationship; i++) {
    relationships.push(createTestRelationship());
  }

  return {
    entities: entities,
    relationships: relationships,
  };
}

describe('#createPersisterApiStepGraphObjectDataUploader', () => {
  const flushedObjectData = createFlushedGraphObjectData(20, 20);

  test('should use different batch sizes when given a batchSize and relationshipBatchSize', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });

    const postSpy = jest.spyOn(apiClient, 'post') as any;

    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };

    await uploadGraphObjectData(
      synchronizationJobContext,
      flushedObjectData,
      5,
      10,
    );

    const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );

    for (const call of entityCalls) {
      expect(call[1].entities.length).toBeLessThanOrEqual(5);
    }
    for (const call of relationshipsCalls) {
      expect(call[1].relationships.length).toBeLessThanOrEqual(10);
    }
  });

  test('should use batchSize when no relationship batchSize given', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });

    const postSpy = jest.spyOn(apiClient, 'post') as any;

    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };

    await uploadGraphObjectData(
      synchronizationJobContext,
      flushedObjectData,
      5,
    );

    const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );

    for (const call of entityCalls) {
      expect(call[1].entities.length).toBeLessThanOrEqual(5);
    }
    for (const call of relationshipsCalls) {
      expect(call[1].relationships.length).toBeLessThanOrEqual(5);
    }
  });

  test('should still use separate relationship batch size when entity batch size not given', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });

    const postSpy = jest.spyOn(apiClient, 'post') as any;
    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };

    await uploadGraphObjectData(
      synchronizationJobContext,
      flushedObjectData,
      undefined,
      5,
    );

    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );

    for (const call of relationshipsCalls) {
      expect(call[1].relationships.length).toBeLessThanOrEqual(5);
    }
  });

  test('should fall back to defaults when no batchSize given', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });

    const postSpy = jest.spyOn(apiClient, 'post') as any;
    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };

    await uploadGraphObjectData(synchronizationJobContext, flushedObjectData);

    const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );

    // This test implicitly relies on the default being higher than 20
    for (const call of entityCalls) {
      expect(call[1].entities.length).toBe(20);
    }

    for (const call of relationshipsCalls) {
      expect(call[1].relationships.length).toBe(20);
    }
  });

  test('should use batchSizeInMB if provided', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });

    for (let i = 1; i < 100; i++) {
      const postSpy = jest.spyOn(apiClient, 'post') as any;

      postSpy.mockResolvedValue({});

      const job = generateSynchronizationJob();
      const synchronizationJobContext: SynchronizationJobContext = {
        logger: createMockIntegrationLogger(),
        apiClient,
        job,
      };
      const mbNumber: number = 0.001 * i;
      await uploadGraphObjectData(synchronizationJobContext, flushedObjectData,250,250,mbNumber);

      const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
      const relationshipsCalls = postSpy.mock.calls.filter(
        (c) => c[1].relationships,
      );
      for (const call of entityCalls) {
        expect(
          Buffer.byteLength(JSON.stringify(call[1].entities)),
        ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber );
      }
      for (const call of relationshipsCalls) {
        expect(
          Buffer.byteLength(JSON.stringify(call[1].relationships)),
        ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber );
      }
    }
  });

  test('should batch a really big ammount of entities-relationships 50k entities + 50k relationships', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });
    const bigObjectData = createFlushedGraphObjectData(50000, 50000);
    const postSpy = jest.spyOn(apiClient, 'post') as any;

    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };
    const mbNumber: number =5;
    await uploadGraphObjectData(synchronizationJobContext, bigObjectData,250,250,mbNumber);

    const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );
    expect(entityCalls.length).toBe(3)
    expect(relationshipsCalls.length).toBe(4)
    let entitySentToSync:string[] = []
    let relationshipSentToSync:string[] = []
    for (const call of entityCalls) {
      entitySentToSync = entitySentToSync.concat((call[1].entities as Entity[]).map(item => item._key) )
      expect(
        Buffer.byteLength(JSON.stringify(call[1].entities)),
      ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber); 
    }
    for (const call of relationshipsCalls) {
      relationshipSentToSync = relationshipSentToSync.concat((call[1].relationships as Relationship[]).map(item => item._key) )
      expect(
        Buffer.byteLength(JSON.stringify(call[1].relationships)),
      ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber);
    }
    //Check that all elements that we wanted to sync were called
    expect(bigObjectData.entities.map(item => item._key).sort() ).toEqual(entitySentToSync.sort())
    expect(bigObjectData.relationships.map(item => item._key).sort() ).toEqual(relationshipSentToSync.sort())
  });


  test('should batch a small ammount of big entities 10x(7MB each)', async () => {
    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: uuid(),
    });
    const bigObjectData = createFlushedGraphObjectData(10, 0);
    for(const entity of bigObjectData.entities){
      const bigRawData:EntityRawData = {name:'rawData',rawData:'rawData'.repeat(1000000)};
      
      entity._rawData=[bigRawData]
    }
 
    const postSpy = jest.spyOn(apiClient, 'post') as any;

    postSpy.mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };
    const mbNumber: number =5;
    await uploadGraphObjectData(synchronizationJobContext, bigObjectData,250,250,mbNumber);

    const entityCalls = postSpy.mock.calls.filter((c) => c[1].entities);
    const relationshipsCalls = postSpy.mock.calls.filter(
      (c) => c[1].relationships,
    );
    expect(entityCalls.length).toBe(10)
    let sentToSync:string[] = []
    for (const call of entityCalls) {
      sentToSync = sentToSync.concat((call[1].entities as Entity[]).map(item => item._key) )
      expect(
        Buffer.byteLength(JSON.stringify(call[1].entities)),
      ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber); 
    }
    for (const call of relationshipsCalls) {
      expect(
        Buffer.byteLength(JSON.stringify(call[1].relationships)),
      ).toBeLessThanOrEqual(BYTES_IN_MB * mbNumber);
    }
    expect(bigObjectData.entities.map(item => item._key).sort() ).toEqual(sentToSync.sort())
  });
});
