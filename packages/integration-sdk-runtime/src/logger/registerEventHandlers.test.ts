import { registerEventHandlers } from './registerEventHandlers';

test('registerEventHandlers registers a handler for uncaughtException', () => {
  const noopCallback = (err, event) => {
    return;
  };

  const uncaughtExceptionCount = process.listeners('uncaughtException').length;
  registerEventHandlers(noopCallback);

  expect(process.listeners('uncaughtException').length).toBe(
    uncaughtExceptionCount + 1,
  );
});
