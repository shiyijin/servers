import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Client as KustoClient } from 'azure-kusto-data';
import { ADXHandler } from '../adx_handler';

interface MockKustoResult {
  primaryResults: Array<{
    toString(): string;
  }>;
}

const mockClient = {
  execute: jest.fn() as jest.MockedFunction<(database: string, query: string, properties: any) => Promise<MockKustoResult>>
};

// Mock the entire modules
jest.mock('azure-kusto-data', () => ({
  Client: jest.fn(() => mockClient as unknown as KustoClient),
  KustoConnectionStringBuilder: {
    withTokenCredential: jest.fn().mockReturnValue({})
  },
  ClientRequestProperties: jest.fn()
}));

// Mock Azure identity
const mockGetToken = jest.fn().mockImplementation(() => Promise.resolve({
  token: 'mock-token',
  expiresOnTimestamp: Date.now() + 3600000
}));

jest.mock('@azure/identity', () => ({
  AzureCliCredential: jest.fn().mockImplementation(() => ({
    getToken: mockGetToken
  }))
}));

describe('KustoHandler', () => {
  let handler: ADXHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.KUSTO_DEFAULT_CLUSTER = 'default-cluster';
    process.env.KUSTO_DEFAULT_DATABASE = 'default-db';

    // Initialize handler
    handler = new ADXHandler();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      await handler.initialize();
      //expect(consoleSpy).toHaveBeenCalledWith('KustoHandler initialized successfully');
    });
  });

  describe('getClient', () => {
    it('should not create a new client if clusterRrl only uppercase and lowercase differences', async () => {
      await handler.initialize();

      const clusterUrl = 'https://example.kusto.windows.net';
      const client = await handler.getClient(clusterUrl);
      const clusterUrl1 = 'https://EXAMPLE.kusto.windows.net';
      const client1 = await handler.getClient(clusterUrl);

      expect(mockClient.execute).not.toHaveBeenCalled();
      expect(client).toBe(client1);
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      await handler.initialize();
    });

    it('should require initialization before query execution', async () => {
      // Create new instance without initialization
      handler = new ADXHandler();
      
      const result = await handler.executeQuery({
        query: 'test query'
      });

      expect(result.content[0].type).toBe('text');
      const parsedResponse = JSON.parse(result.content[0].text);
      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain('not initialized');
      expect(result.isError).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      process.env.KUSTO_DEFAULT_CLUSTER = '';
      process.env.KUSTO_DEFAULT_DATABASE = '';

      const result = await handler.executeQuery({
        query: 'test query'
      });

      expect(result.content[0].type).toBe('text');
      const parsedResponse = JSON.parse(result.content[0].text);
      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain('Cluster URL must be provided');
      expect(result.isError).toBe(true);
    });
  });
});