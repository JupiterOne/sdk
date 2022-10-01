import {
  registerEventHandlers,
} from './registerEventHandlers';

test('registerEventHandlers registers a handler for unhandledRejection, uncaughtException, and multipleResolves', () => {
  const noopCallback = (err, event) => {
    return;
  };

  const multipleResolvesCount = process.listeners('multipleResolves').length;
  const uncaughtExceptionCount = process.listeners('uncaughtException').length;
  const unhandledRejectionCount =
    process.listeners('unhandledRejection').length;

  registerEventHandlers(noopCallback);

  expect(process.listeners('multipleResolves').length).toBe(
    multipleResolvesCount + 1,
  );
  expect(process.listeners('uncaughtException').length).toBe(
    uncaughtExceptionCount + 1,
  );
  expect(process.listeners('unhandledRejection').length).toBe(
    unhandledRejectionCount + 1,
  );
});
