import { Logger, LogLevel } from '../logger';

describe('Logger', () => {
  // Test that verifies the logger is in test mode
  test('should be in test environment mode during tests', () => {
    // Access the private static field using type assertion
    const isTestEnv = (Logger as any)['isTestEnvironment'];
    expect(isTestEnv).toBe(true);
  });

  // Test that the logger doesn't throw errors when used in tests
  test('should not throw errors when logging in test environment', () => {
    const logger = (Logger as any).getInstance();
    
    // These should not throw errors or create files
    expect(() => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.event('tool_invoked', { tool: 'test' });
    }).not.toThrow();
  });

  // Optionally, test with test environment disabled for a specific test
  test('can manually control test environment', () => {
    // Save original state
    const originalState = (Logger as any)['isTestEnvironment'];
    
    try {
      // Temporarily disable test environment
      Logger.setTestEnvironment(false);
      
      // This would create actual logs, but we're not asserting that
      // Just verify we can toggle the flag
      const isTestEnv = (Logger as any)['isTestEnvironment'];
      expect(isTestEnv).toBe(false);
      
      // Don't actually log anything in this test
    } finally {
      // Restore original state
      Logger.setTestEnvironment(originalState);
    }
  });
});