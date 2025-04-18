// jest.setup.ts
import { Logger, logger } from './src/utils/logger';

// Automatically set test environment for all tests
Logger.setTestEnvironment(true);

// Ensure proper cleanup after all tests
afterAll(async () => {
  // Close the logger instance to flush and cleanup any pending operations
  logger.close();
  
  // Create a small delay to allow async operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Restore normal behavior after all tests
  Logger.setTestEnvironment(false);
});

// Optional: Mock console methods to keep test output clean
// Uncomment if you want cleaner test output
/*
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'debug').mockImplementation(() => {});
*/