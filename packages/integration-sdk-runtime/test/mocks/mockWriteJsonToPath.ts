// Prevent tests from creating ./.j1-integration directory
import * as fileSystem from '../../src/fileSystem';
// eslint-disable-next-line @typescript-eslint/no-empty-function
fileSystem['writeJsonToPath' as any] = () => {};
