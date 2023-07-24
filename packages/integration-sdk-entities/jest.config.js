module.exports = {
  ...require('../../jest.config.base'),
  setupFilesAfterEnv: ['jest-extended/all', './jest.setup.ts'],
};
