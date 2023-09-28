import {
  IntegrationError,
  IntegrationErrorEventName,
} from '@jupiterone/integration-sdk-core';
import { restoreProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';
import { createIntegrationLogger } from '../../logger';
import { shrinkBatchRawData } from '../shrinkBatchRawData';
import { DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES } from '..';

describe('shrinkBatchRawData', () => {
  const logger = createIntegrationLogger({
    name: 'test',
  });
  logger.error = jest.fn();
  logger.publishErrorEvent = jest.fn();
  logger.info = jest.fn();

  afterEach(() => {
    restoreProjectStructure();
    jest.clearAllMocks();
  });

  it('should shrink rawData until batch size is < 6 million bytes', () => {
    const largeData = new Array(450000).join('aaaaaaaaaa');
    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              testRawData: 'test123',
              willGetRemovedFirst:
                'yes it will get removed first b/c it has largest raw data',
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              willGetRemovedSecond: true,
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey3',
        _type: 'testType',
        _rawData: [
          {
            name: 'test3',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];
    const startingSize = Buffer.byteLength(JSON.stringify(data));
    const finalData = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              testRawData: 'test123',
              willGetRemovedFirst:
                'yes it will get removed first b/c it has largest raw data',
              testLargeRawData: 'TRUNCATED',
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              willGetRemovedSecond: true,
              testLargeRawData: 'TRUNCATED',
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey3',
        _type: 'testType',
        _rawData: [
          {
            name: 'test3',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: expect.stringContaining('aaaaaaa'),
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];

    shrinkBatchRawData(data, logger, DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES);
    expect(logger.info).toBeCalledTimes(2);
    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Attempting to shrink rawData',
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        initialSize: startingSize,
        totalSize: Buffer.byteLength(JSON.stringify(data)),
        itemsRemoved: 2,
      }),
      'Shrink raw data result',
    );
    expect(data).toEqual(finalData);
  });
  it('should detect if data is unshrinkable and throw error', () => {
    const largeData = new Array(700000).join('aaaaaaaaaa');
    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              largeRawDataProp: largeData + 'more',
              testRawData: 'test123',
              testFinalData: 'test789',
              anotherLargeRawDataProp: largeData,
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        // poison pill in entity properties
        largeProperty: largeData,
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey3',
        _type: 'testType',
        _rawData: [
          {
            name: 'test3',
            rawData: {
              testRawData: 'test123',
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];
    try {
      shrinkBatchRawData(data, logger, DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES);
      throw new Error('this was not supposed to happen');
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrationError);
      expect(logger.error).toBeCalledTimes(1);
      // should give details on largest entity in batch after finished shrinking, this should be item with _key=testKey3
      expect(logger.error).toBeCalledWith(
        expect.objectContaining({
          largestEntityPropSizeMap: {
            _class: 6,
            _key: 10,
            _rawData: 80,
            _type: 10,
            largeProperty: 6999992,
          },
        }),
        expect.stringContaining(
          'Encountered upload size error after fully shrinking.',
        ),
      );
      expect(logger.publishErrorEvent).toBeCalledTimes(1);
      expect(logger.publishErrorEvent).toBeCalledWith(
        expect.objectContaining({
          name: IntegrationErrorEventName.EntitySizeLimitEncountered,
        }),
      );
      expect(logger.info).toBeCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
    }
  });
  it('should fail to shrink rawData due to no entities', () => {
    const data = [];
    let shrinkErr;
    try {
      shrinkBatchRawData(data, logger, 0);
    } catch (err) {
      shrinkErr = err;
      expect(shrinkErr instanceof IntegrationError).toEqual(true);
      expect(shrinkErr.message).toEqual(
        'Failed to upload integration data because payload is too large and cannot shrink',
      );
      expect(shrinkErr.code).toEqual('INTEGRATION_UPLOAD_FAILED');
    }
    expect(shrinkErr).not.toBe(undefined);
    expect(logger.info).toBeCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
  });
  it('should fail to shrink rawData due to no _rawData entries', () => {
    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
      },
    ];
    let shrinkErr;
    try {
      shrinkBatchRawData(data, logger, 0);
    } catch (err) {
      shrinkErr = err;
      expect(shrinkErr instanceof IntegrationError).toEqual(true);
      expect(shrinkErr.message).toEqual(
        'Failed to upload integration data because payload is too large and cannot shrink',
      );
      expect(shrinkErr.code).toEqual('INTEGRATION_UPLOAD_FAILED');
    }
    expect(shrinkErr).not.toBe(undefined);
    expect(logger.info).toBeCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
  });

  it('should assign 0 to the size of an undefined property when building the property map', () => {
    let shrinkBatchRawDataSucceeded = false;
    const largeData = new Array(700000).join('aaaaaaaaaa');
    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              largeRawDataProp: largeData + 'more',
              testRawData: 'test123',
              testFinalData: 'test789',
              anotherLargeRawDataProp: largeData,
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        largeProperty: largeData,
        undefProp: undefined,
        falseyProp: false,
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];
    try {
      shrinkBatchRawData(data, logger, DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES);
      shrinkBatchRawDataSucceeded = true;
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrationError);
      expect(logger.error).toBeCalledTimes(1);
      // should give details on largest entity in batch after finished shrinking, this should be item with _key=testKey3
      expect(logger.error).toBeCalledWith(
        expect.objectContaining({
          largestEntityPropSizeMap: {
            _class: 6,
            _key: 10,
            _rawData: 80,
            _type: 10,
            largeProperty: 6999992,
            falseyProp: 5,
            undefProp: 0,
          },
        }),
        expect.stringContaining(
          'Encountered upload size error after fully shrinking.',
        ),
      );
      expect(logger.publishErrorEvent).toBeCalledTimes(1);
      expect(logger.publishErrorEvent).toBeCalledWith(
        expect.objectContaining({
          name: IntegrationErrorEventName.EntitySizeLimitEncountered,
        }),
      );
      expect(logger.info).toBeCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
    }

    expect(shrinkBatchRawDataSucceeded).toEqual(false);
  });
});
