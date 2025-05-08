import { ethers } from 'ethers';
import axios from 'axios';
import { randomBytes } from 'crypto';
import {
  EigenDAConfig,
  UploadResponse,
  StatusResponse,
  RetrieveOptions,
  UploadError,
  RetrieveError,
  StatusError,
  ConfigurationError,
  IEigenDAClient
} from '../types';
import {
  DEFAULT_API_URL,
  DEFAULT_RPC_URL,
  MAX_STATUS_CHECKS,
  STATUS_CHECK_INTERVAL,
  INITIAL_RETRIEVAL_DELAY,
  validateConfig
} from '../utils/environment';

export class EigenDAv1Client implements IEigenDAClient {
  private apiUrl: string;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  /**
   * Creates an instance of EigenDAv1Client.
   * @param {EigenDAConfig} [config] - Optional configuration object for the client
   * @throws {ConfigurationError} When configuration validation fails
   */
  constructor(config?: EigenDAConfig) {
    const configErrors = validateConfig(config || {});
    if (configErrors.length > 0) {
      throw new ConfigurationError(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    this.apiUrl = (config?.apiUrl || process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '');
    const rpcUrl = config?.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (config?.wallet) {
      this.wallet = config.wallet;
    } else {
      const privateKey = config?.privateKey || process.env.EIGENDA_PRIVATE_KEY;
      if (!privateKey) {
        throw new ConfigurationError(
          'Private key not provided and EIGENDA_PRIVATE_KEY not set in environment'
        );
      }
      const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(normalizedPrivateKey, this.provider);
    }
  }

  /**
   * Signs request data with the wallet's private key.
   * @param {any} requestData - The data to be signed
   * @returns {Promise<string>} The signature
   * @private
   */
  private async signRequest(requestData: any): Promise<string> {
    const dataToSign = {
      content: requestData.content,
      salt: requestData.salt
    };
    const message = JSON.stringify(dataToSign, Object.keys(dataToSign).sort());
    return await this.wallet.signMessage(message);
  }

  /**
   * Uploads content to EigenDA.
   * @param {string} content - The content to upload
   * @param {Uint8Array} [identifier] - Optional identifier for the upload
   * @returns {Promise<UploadResponse>} The upload response
   * @throws {UploadError} When upload fails
   */
  async upload(content: string, identifier?: Uint8Array): Promise<UploadResponse> {
    try {
      const salt = randomBytes(32).toString('hex');
      const identifierHex = identifier
        ? Buffer.from(identifier).toString('hex').padStart(64, '0')
        : undefined;

      const dataToSign = {
        content,
        salt
      };

      const signature = await this.signRequest(dataToSign);

      const requestData = {
        content,
        account_id: this.wallet.address,
        identifier: identifierHex,
        salt,
        signature
      };

      const response = await axios.post<UploadResponse>(`${this.apiUrl}/upload`, requestData);
      return response.data;
    } catch (error: any) {
      throw new UploadError(`Upload failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Gets the status of a job.
   * @param {string} jobId - The ID of the job to check
   * @returns {Promise<StatusResponse>} The status response
   * @throws {StatusError} When status check fails
   */
  async getStatus(jobId: string): Promise<StatusResponse> {
    try {
      const response = await axios.get<StatusResponse>(`${this.apiUrl}/status/${jobId}`);
      return response.data;
    } catch (error: any) {
      throw new StatusError(`Status check failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Waits for a job to reach a target status.
   * @param {string} jobId - The ID of the job to wait for
   * @param {'CONFIRMED' | 'FINALIZED'} [targetStatus='CONFIRMED'] - The target status to wait for
   * @param {number} [maxChecks=MAX_STATUS_CHECKS] - Maximum number of status checks
   * @param {number} [checkInterval=STATUS_CHECK_INTERVAL] - Interval between checks in seconds
   * @param {number} [initialDelay=INITIAL_RETRIEVAL_DELAY] - Initial delay before first check in seconds
   * @returns {Promise<StatusResponse>} The final status response
   * @throws {StatusError} When status check fails or times out
   */
  async waitForStatus(
    jobId: string,
    targetStatus: 'CONFIRMED' | 'FINALIZED' = 'CONFIRMED',
    maxChecks: number = MAX_STATUS_CHECKS,
    checkInterval: number = STATUS_CHECK_INTERVAL,
    initialDelay: number = INITIAL_RETRIEVAL_DELAY
  ): Promise<StatusResponse> {
    await new Promise((resolve) => setTimeout(resolve, initialDelay * 1000));

    let checks = 0;
    while (checks < maxChecks) {
      const statusResponse = await this.getStatus(jobId);
      if (statusResponse.status === targetStatus) {
        return statusResponse;
      } else if (statusResponse.status === 'FAILED') {
        throw new StatusError(`Job failed: ${statusResponse.error || 'Unknown error'}`);
      }

      checks++;
      if (checks < maxChecks) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval * 1000));
      }
    }

    throw new StatusError(`Timeout waiting for status ${targetStatus} after ${maxChecks} checks`);
  }

  /**
   * Retrieves data from EigenDA.
   * @param {RetrieveOptions} options - Options for retrieving data
   * @returns {Promise<any>} The retrieved data
   * @throws {RetrieveError} When retrieval fails
   */
  async retrieve(options: RetrieveOptions): Promise<any> {
    try {
      const { jobId, requestId, batchHeaderHash, blobIndex, waitForCompletion = false } = options;

      let finalRequestId = requestId;
      if (jobId && waitForCompletion) {
        const status = await this.waitForStatus(jobId);
        finalRequestId = status.requestId;
        if (!finalRequestId) {
          throw new RetrieveError('No request_id in completed status');
        }
      }

      const requestData: any = {};
      if (finalRequestId) {
        requestData.request_id = finalRequestId;
      } else if (jobId) {
        requestData.job_id = jobId;
      } else if (batchHeaderHash && blobIndex !== undefined) {
        requestData.batch_header_hash = batchHeaderHash;
        requestData.blob_index = blobIndex;
      } else {
        throw new RetrieveError(
          'Must provide either jobId, requestId, or both batchHeaderHash and blobIndex'
        );
      }

      const response = await axios.post(`${this.apiUrl}/retrieve`, requestData, {
        responseType: 'arraybuffer'
      });

      try {
        const textContent = new TextDecoder().decode(response.data);
        return JSON.parse(textContent);
      } catch {
        return new Uint8Array(response.data);
      }
    } catch (error: any) {
      throw new RetrieveError(`Retrieval failed: ${error.response?.data?.error || error.message}`);
    }
  }
}
