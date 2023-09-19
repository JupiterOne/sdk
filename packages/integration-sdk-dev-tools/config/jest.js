module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  restoreMocks: true,
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '!**/node_modules/*',
    '!**/dist/*',
    '!**/*.bak/*',
  ],
  collectCoverage: false,
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@jupiterone/integration-sdk-dev-tools/config/setupJestTestFramework.js',
  ],
};
