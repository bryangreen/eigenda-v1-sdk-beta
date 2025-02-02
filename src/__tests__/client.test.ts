import { EigenDAClient, ConfigurationError, UploadError, StatusError, RetrieveError } from '../';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Default test values
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
const TEST_API_URL = process.env.TEST_API_URL || 'https://test-agent-proxy-api.eigenda.xyz';
const TEST_RPC_URL = process.env.TEST_RPC_URL || 'https://mainnet.base.org';

describe('EigenDAClient', () => {
  const mockConfig = {
    privateKey: TEST_PRIVATE_KEY,
    apiUrl: TEST_API_URL,
    rpcUrl: TEST_RPC_URL
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks before each test
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const client = new EigenDAClient(mockConfig);
      expect(client).toBeInstanceOf(EigenDAClient);
    });

    it('should throw ConfigurationError with invalid private key', () => {
      expect(() => new EigenDAClient({ ...mockConfig, privateKey: 'invalid' }))
        .toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when no private key provided', () => {
      expect(() => new EigenDAClient({ 
        apiUrl: TEST_API_URL,
        rpcUrl: TEST_RPC_URL
      })).toThrow(ConfigurationError);
    });
  });

  describe('upload', () => {
    const mockUploadResponse = {
      jobId: 'test-job-id',
      requestId: 'test-request-id'
    };

    it('should upload content successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockUploadResponse });
      
      const client = new EigenDAClient(mockConfig);
      const result = await client.upload('test content');
      
      expect(result).toEqual(mockUploadResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          content: 'test content',
          account_id: expect.any(String),
          salt: expect.any(String),
          signature: expect.any(String)
        })
      );
    });

    it('should handle upload errors', async () => {
      const errorMessage = 'Network error';
      mockedAxios.post.mockRejectedValueOnce({ 
        message: errorMessage,
        response: { data: { error: errorMessage } }
      });

      const client = new EigenDAClient(mockConfig);
      await expect(client.upload('test content'))
        .rejects
        .toThrow(UploadError);
    });
  });

  describe('getStatus', () => {
    const mockStatusResponse = {
      status: 'CONFIRMED',
      requestId: 'test-request-id'
    };

    it('should get status successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockStatusResponse });
      
      const client = new EigenDAClient(mockConfig);
      const result = await client.getStatus('test-job-id');
      
      expect(result).toEqual(mockStatusResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/status/test-job-id')
      );
    });

    it('should handle status check errors', async () => {
      const errorMessage = 'Network error';
      mockedAxios.get.mockRejectedValueOnce({ 
        message: errorMessage,
        response: { data: { error: errorMessage } }
      });

      const client = new EigenDAClient(mockConfig);
      await expect(client.getStatus('test-job-id'))
        .rejects
        .toThrow(StatusError);
    });
  });

  describe('retrieve', () => {
    const mockContent = { content: 'test content' };
    const mockRetrieveResponse = {
      data: Buffer.from(JSON.stringify(mockContent))
    };

    it('should retrieve content successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockRetrieveResponse);
      
      const client = new EigenDAClient(mockConfig);
      const result = await client.retrieve({ jobId: 'test-job-id' });
      
      expect(result).toEqual(mockContent);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/retrieve'),
        { job_id: 'test-job-id' },
        expect.any(Object)
      );
    });

    it('should handle retrieval errors', async () => {
      const errorMessage = 'Network error';
      mockedAxios.post.mockRejectedValueOnce({ 
        message: errorMessage,
        response: { data: { error: errorMessage } }
      });

      const client = new EigenDAClient(mockConfig);
      await expect(client.retrieve({ jobId: 'test-job-id' }))
        .rejects
        .toThrow(RetrieveError);
    });

    it('should handle non-JSON responses', async () => {
      const binaryData = Buffer.from([1, 2, 3, 4]);
      mockedAxios.post.mockResolvedValueOnce({ data: binaryData });
      
      const client = new EigenDAClient(mockConfig);
      const result = await client.retrieve({ jobId: 'test-job-id' });
      
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });
});
