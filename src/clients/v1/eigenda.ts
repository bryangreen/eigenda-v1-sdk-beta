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
import { BaseWalletManager } from './base';

export class EigenDAv1Client extends BaseWalletManager implements IEigenDAClient {
  private apiUrl: string;

  constructor(config?: EigenDAConfig) {
    const configErrors = validateConfig(config || {});
    if (configErrors.length > 0) {
      throw new ConfigurationError(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    const rpcUrl = config?.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
    super(rpcUrl);

    this.apiUrl = (config?.apiUrl || process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '');

    if (config?.wallet) {
      this.setWallet(config.wallet);
    } else if (config?.privateKey) {
      const normalizedPrivateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`;
      this.setWallet(new ethers.Wallet(normalizedPrivateKey));
    }
  }

  private async signRequest(requestData: any): Promise<string> {
    const dataToSign = {
      content: requestData.content,
      salt: requestData.salt
    };
    const message = JSON.stringify(dataToSign, Object.keys(dataToSign).sort());
    return await this.getWallet().signMessage(message);
  }

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
        account_id: this.getWallet().address,
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

  async getStatus(jobId: string): Promise<StatusResponse> {
    try {
      const response = await axios.get<StatusResponse>(`${this.apiUrl}/status/${jobId}`);
      return response.data;
    } catch (error: any) {
      throw new StatusError(`Status check failed: ${error.response?.data?.error || error.message}`);
    }
  }

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