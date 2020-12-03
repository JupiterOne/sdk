// Prevent tests from creating ./.j1-integration directory
const fileSystem = require('../../dist/src/fileSystem');
fileSystem.writeJsonToPath = () => {};
