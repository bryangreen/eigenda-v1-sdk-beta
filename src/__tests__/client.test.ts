import { ConfigurationError, UploadError, RetrieveError } from '../clients/types';
import { EigenDAv1Client } from '../clients/v1/client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock ethers
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  return {
    ...originalModule,
    Contract: jest.fn().mockImplementation(() => ({
      createIdentifier: jest.fn().mockImplementation(() =>
        Promise.resolve({
          wait: () =>
            Promise.resolve({
              logs: []
            })
        })
      ),
      getUserIdentifierCount: jest.fn().mockResolvedValue(0),
      getUserIdentifierAt: jest.fn().mockResolvedValue('0x'),
      getIdentifierOwner: jest.fn().mockResolvedValue('0x'),
      getBalance: jest.fn().mockResolvedValue(0),
      topup: jest.fn().mockResolvedValue({ wait: () => Promise.resolve({ status: 1 }) }),
      interface: {
        parseLog: jest.fn()
      }
    }))
  };
});

// Default test values
const TEST_PRIVATE_KEY =
  process.env.TEST_PRIVATE_KEY ||
  '0x1234567890123456789012345678901234567890123456789012345678901234';
const TEST_API_URL = process.env.TEST_API_URL || 'https://test-agent-proxy-api.eigenda.xyz';
const TEST_RPC_URL = process.env.TEST_RPC_URL || 'https://mainnet.base.org';

type MockedContract = {
  createIdentifier: jest.Mock;
  getUserIdentifierCount: jest.Mock;
  getUserIdentifierAt: jest.Mock;
  getIdentifierOwner: jest.Mock;
  getBalance: jest.Mock;
  topup: jest.Mock;
  interface: {
    parseLog: jest.Mock;
  };
};

describe('EigenDAv1Client', () => {
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
      const client = new EigenDAv1Client(mockConfig);
      expect(client).toBeInstanceOf(EigenDAv1Client);
    });

    it('should throw ConfigurationError with invalid private key', () => {
      expect(() => new EigenDAv1Client({ ...mockConfig, privateKey: 'invalid' })).toThrow(
        ConfigurationError
      );
    });

    it('should throw ConfigurationError when no private key provided', () => {
      expect(
        () =>
          new EigenDAv1Client({
            apiUrl: TEST_API_URL,
            rpcUrl: TEST_RPC_URL
          })
      ).toThrow(ConfigurationError);
    });

    it('should use default values when not provided', () => {
      const client = new EigenDAv1Client({ privateKey: TEST_PRIVATE_KEY });
      expect(client).toBeInstanceOf(EigenDAv1Client);
    });
  });

  describe('upload', () => {
    const mockUploadResponse = {
      jobId: 'test-job-id',
      requestId: 'test-request-id'
    };

    it('should upload content successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockUploadResponse });

      const client = new EigenDAv1Client(mockConfig);
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

      const client = new EigenDAv1Client(mockConfig);
      await expect(client.upload('test content')).rejects.toThrow(UploadError);
    });

    it('should upload with identifier', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockUploadResponse });
      const identifier = new Uint8Array([1, 2, 3, 4]);

      const client = new EigenDAv1Client(mockConfig);
      const result = await client.upload('test content', identifier);

      expect(result).toEqual(mockUploadResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          identifier: expect.any(String)
        })
      );
    });
  });

  describe('retrieve', () => {
    const mockContent = { content: 'test content' };
    const mockRetrieveResponse = {
      data: Buffer.from(JSON.stringify(mockContent))
    };

    it('should retrieve content successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockRetrieveResponse);

      const client = new EigenDAv1Client(mockConfig);
      const result = await client.retrieve({ jobId: 'test-job-id' });

      expect(result).toEqual(mockContent);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/retrieve'),
        { job_id: 'test-job-id' },
        expect.any(Object)
      );
    });

    it('should retrieve with requestId', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockRetrieveResponse);

      const client = new EigenDAv1Client(mockConfig);
      await client.retrieve({ requestId: 'test-request-id' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/retrieve'),
        { request_id: 'test-request-id' },
        expect.any(Object)
      );
    });

    it('should retrieve with blob info', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockRetrieveResponse);

      const client = new EigenDAv1Client(mockConfig);
      await client.retrieve({
        batchHeaderHash: 'test-hash',
        blobIndex: 0
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/retrieve'),
        {
          batch_header_hash: 'test-hash',
          blob_index: 0
        },
        expect.any(Object)
      );
    });

    it('should handle retrieval errors', async () => {
      const errorMessage = 'Network error';
      mockedAxios.post.mockRejectedValueOnce({
        message: errorMessage,
        response: { data: { error: errorMessage } }
      });

      const client = new EigenDAv1Client(mockConfig);
      await expect(client.retrieve({ jobId: 'test-job-id' })).rejects.toThrow(RetrieveError);
    });

    it('should handle non-JSON responses', async () => {
      const binaryData = Buffer.from([1, 2, 3, 4]);
      mockedAxios.post.mockResolvedValueOnce({ data: binaryData });

      const client = new EigenDAv1Client(mockConfig);
      const result = await client.retrieve({ jobId: 'test-job-id' });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should throw error when no valid retrieval options provided', async () => {
      const client = new EigenDAv1Client(mockConfig);
      await expect(client.retrieve({})).rejects.toThrow(RetrieveError);
    });
  });
});
