// jest.config.js
// Place this file in your Backend/ folder (same level as package.json)

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterFramework: [],  
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 30000,          // 30s — MongoDB in-memory can be slow on first run
  forceExit: true,             // exit after all tests done (prevents Jest hanging on open handles)
  detectOpenHandles: true,
  verbose: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
  ],
};
