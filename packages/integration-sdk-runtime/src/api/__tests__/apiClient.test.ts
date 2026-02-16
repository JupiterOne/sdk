import { JupiterOneApiClient } from '../apiClient';

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  isHandledError: jest.fn(),
} as any;

describe('JupiterOneApiClient', () => {
  describe('constructor', () => {
    it('sets _compressUploads to true by default', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'test-account',
        accessToken: 'test-token',
      });
      expect(client._compressUploads).toBe(true);
    });

    it('sets _compressUploads to false when explicitly disabled', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'test-account',
        accessToken: 'test-token',
        compressUploads: false,
      });
      expect(client._compressUploads).toBe(false);
    });
  });

  describe('getAuthorizationHeaders', () => {
    it('returns correct headers with Bearer token', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'my-account',
        accessToken: 'my-token',
      });
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer my-token',
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
    });

    it('omits Authorization header when no accessToken provided', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'my-account',
      });
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
      expect(headers.Authorization).toBeUndefined();
    });
  });
});
