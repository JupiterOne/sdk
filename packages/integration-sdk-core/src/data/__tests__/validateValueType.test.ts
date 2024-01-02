/* eslint-disable no-console */
import { validateValueType } from '../createIntegrationEntity';

describe('validateValueType', () => {
  test('should accept string type', () => {
    expect(() => validateValueType('Sample String', 'testPath')).not.toThrow();
  });

  test('should accept number type', () => {
    expect(() => validateValueType(123, 'testPath')).not.toThrow();
  });

  test('should accept boolean type', () => {
    expect(() => validateValueType(true, 'testPath')).not.toThrow();
  });

  test('should accept null type', () => {
    expect(() => validateValueType(null, 'testPath')).not.toThrow();
  });

  test('should accept array of supported types', () => {
    expect(() => validateValueType([1, 'a', true], 'testPath')).not.toThrow();
  });

  test('should reject nested arrays with unsupported types', () => {
    expect(() =>
      validateValueType([1, ['a', { key: 'value' }], true], 'testPath'),
    ).toThrow();
  });

  test('should reject object type', () => {
    expect(() => validateValueType({ key: 'value' }, 'testPath')).toThrow();
  });

  test('should reject unsupported type in array', () => {
    expect(() =>
      validateValueType([1, 2, { key: 'value' }], 'testPath'),
    ).toThrow();
  });

  test('should reject array inside arrays', () => {
    expect(() =>
      validateValueType([1, 2, { key: 'value' }, [1, [4, 5, 6]]], 'testPath'),
    ).toThrow();
  });
});

describe('validateValueType - successful performance tests', () => {
  const largeDatasetSize = 500000;

  function generateLargeDataset(type) {
    switch (type) {
      case 'string':
        return new Array(largeDatasetSize).fill('testString');
      case 'number':
        return Array.from({ length: largeDatasetSize }, (_, i) => i);
      case 'boolean':
        return new Array(largeDatasetSize).fill(true);
      case 'array':
        return new Array(largeDatasetSize).fill([1, 2, 3]);
      case 'undefined':
        return new Array(largeDatasetSize).fill(undefined);
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  ['string', 'number', 'boolean', 'array', 'undefined'].forEach((type) => {
    test(`should handle large dataset of type ${type} efficiently`, () => {
      const largeDataset = generateLargeDataset(type);

      const start = performance.now();
      largeDataset.forEach((item) =>
        validateValueType(item, `testPath-${type}`),
      );
      const end = performance.now();

      const executionTime = end - start;

      console.log(`Execution time for ${type} dataset: ${executionTime} ms`);

      const acceptableTimeLimit = 1000;
      expect(executionTime).toBeLessThan(acceptableTimeLimit);
    });
  });
});

describe('validateValueType - error Scenarios', () => {
  const largeDatasetSize = 500000;

  function generateErrorDataset() {
    const data: any[] = [];
    for (let i = 0; i < largeDatasetSize; i++) {
      if (i % 50000 === 0) {
        data.push({ key: `value-${i}` });
      } else {
        data.push(i % 2 === 0 ? `string-${i}` : i);
      }
    }
    return data;
  }

  test(`should throw error for large dataset with unsupported types`, () => {
    const errorDataset = generateErrorDataset();
    let executionTime = 0;

    const start = performance.now();
    try {
      errorDataset.forEach((item) =>
        validateValueType(item, `testPath-errorCase`),
      );
      const end = performance.now();
      executionTime = end - start;
    } catch (error) {
      const end = performance.now();
      executionTime = end - start;

      console.log(`Execution time until error: ${executionTime} ms`);
    }

    expect(executionTime).toBeGreaterThan(0);

    const acceptableErrorDetectionTime = 1000;
    expect(executionTime).toBeLessThan(acceptableErrorDetectionTime);

    expect(() => {
      errorDataset.forEach((item) =>
        validateValueType(item, `testPath-errorCase`),
      );
    }).toThrow();
  });
});
