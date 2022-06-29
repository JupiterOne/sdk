import { processDeclaredTypesDiff } from '../../utils/processDeclaredTypesDiff';
import { ExecuteIntegrationResult } from '../../executeIntegration';

describe('processDeclaredTypesDiff', () => {
  test('undeclared types are correctly identified', () => {
    // Arrange
    const integrationStepResults = [
      {
        name: 'first',
        declaredTypes: ['a', 'b', 'c'],
        encounteredTypes: ['d', 'b', 'c'],
      },
      {
        name: 'second',
        declaredTypes: ['b', 'c', 'e'],
        encounteredTypes: ['b', 'c'],
      },
    ];

    const iteratee = jest.fn();

    // Act
    processDeclaredTypesDiff(
      { integrationStepResults } as ExecuteIntegrationResult,
      iteratee,
    );

    // Assert
    expect(iteratee).toHaveBeenCalledTimes(2);
    expect(iteratee).toHaveBeenNthCalledWith(1, integrationStepResults[0], [
      'd',
    ]);
    expect(iteratee).toHaveBeenNthCalledWith(2, integrationStepResults[1], []);
  });
});
