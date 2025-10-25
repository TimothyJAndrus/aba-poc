// Test setup and configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'aba_scheduling_test';
process.env.JWT_SECRET = 'test-secret-key';

// Mock external services for testing
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test utilities
(global as any).testConfig = {
  database: {
    name: 'aba_scheduling_test',
  },
};