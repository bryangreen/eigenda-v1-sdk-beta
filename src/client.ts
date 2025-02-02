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
  ConfigurationError
} from './types';
import {
  DEFAULT_API_URL,
  DEFAULT_RPC_URL,
  DEFAULT_CREDITS_CONTRACT_ADDRESS,
  MAX_STATUS_CHECKS,
  STATUS_CHECK_INTERVAL,
  INITIAL_RETRIEVAL_DELAY,
  validateConfig
} from './utils/environment';
import CreditsABI from './contracts/Credits.json';
import { Log, LogDescription } from 'ethers';

export class EigenDAClient {
  private apiUrl: string;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private creditsContract: ethers.Contract;

  constructor(config?: EigenDAConfig) {
    // Validate configuration
    const configErrors = validateConfig(config || {});
    if (configErrors.length > 0) {
      throw new ConfigurationError(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    this.apiUrl = (config?.apiUrl || process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, '');

    // Setup provider
    const rpcUrl = config?.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Setup wallet
    const privateKey = config?.privateKey || process.env.EIGENDA_PRIVATE_KEY;
    if (!privateKey) {
      throw new ConfigurationError(
        'Private key not provided and EIGENDA_PRIVATE_KEY not set in environment'
      );
    }
    const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    this.wallet = new ethers.Wallet(normalizedPrivateKey, this.provider);

    // Setup contract
    const creditsContractAddress =
      config?.creditsContractAddress ||
      process.env.CREDITS_CONTRACT_ADDRESS ||
      DEFAULT_CREDITS_CONTRACT_ADDRESS;
    this.creditsContract = new ethers.Contract(creditsContractAddress, CreditsABI.abi, this.wallet);
  }

  private async signRequest(requestData: any): Promise<string> {
    const dataToSign = {
      content: requestData.content,
      salt: requestData.salt
    };
    const message = JSON.stringify(dataToSign, Object.keys(dataToSign).sort());
    return await this.wallet.signMessage(message);
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

  async getBalance(identifier: Uint8Array): Promise<number> {
    try {
      const hexString = Buffer.from(identifier).toString('hex');
      const formattedIdentifier = ethers.hexlify(ethers.zeroPadValue('0x' + hexString, 32));
      const balance = await this.creditsContract.getBalance(formattedIdentifier);
      return Number(ethers.formatEther(balance));
    } catch (error: any) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async topupCredits(
    identifier: Uint8Array,
    amountEth: number
  ): Promise<{ transactionHash: string; status: string }> {
    try {
      const hexString = Buffer.from(identifier).toString('hex');
      const formattedIdentifier = ethers.hexlify(ethers.zeroPadValue('0x' + hexString, 32));
      const tx = await this.creditsContract.topup(formattedIdentifier, {
        value: ethers.parseEther(amountEth.toString())
      });
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error: any) {
      throw new Error(`Failed to top up credits: ${error.message}`);
    }
  }

  async createIdentifier(): Promise<Uint8Array> {
    try {
      const tx = await this.creditsContract.createIdentifier();
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: Log) => this.creditsContract.interface.parseLog(log))
        .find((event: LogDescription | null) => event?.name === 'IdentifierCreated');

      if (event) {
        // Convert the identifier to proper bytes32 format
        const identifier = event.args.identifier;
        // Remove '0x' prefix if present and ensure 32 bytes
        const hexString = identifier.slice(0, 2) === '0x' ? identifier.slice(2) : identifier;
        return ethers.getBytes('0x' + hexString.padStart(64, '0'));
      }
      throw new Error("No identifier in event logs");
    } catch (error: any) {
      throw new Error(`Failed to create identifier: ${error.message}`);
    }
  }

  async getIdentifiers(): Promise<Uint8Array[]> {
    try {
      const count = await this.creditsContract.getUserIdentifierCount(this.wallet.address);
      const identifiers = await Promise.all(
        Array.from({ length: Number(count) }, (_, i) =>
          this.creditsContract.getUserIdentifierAt(this.wallet.address, i)
        )
      );
      // Convert each identifier to proper bytes32 format
      return identifiers.map(id => {
        const hexString = id.slice(0, 2) === '0x' ? id.slice(2) : id;
        return ethers.getBytes('0x' + hexString.padStart(64, '0'));
      });
    } catch (error: any) {
      throw new Error(`Failed to get identifiers: ${error.message}`);
    }
  }

  async getIdentifierOwner(identifier: Uint8Array): Promise<string> {
    try {
      const hexString = Buffer.from(identifier).toString('hex');
      const formattedIdentifier = ethers.hexlify(ethers.zeroPadValue('0x' + hexString, 32));
      return await this.creditsContract.getIdentifierOwner(formattedIdentifier);
    } catch (error: any) {
      throw new Error(`Failed to get identifier owner: ${error.message}`);
    }
  }
}
