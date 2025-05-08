
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

export class EigenDAv1Client implements IEigenDAClient {
  private apiUrl: string;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private creditsContract: ethers.Contract;

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

    const privateKey = config?.privateKey || process.env.EIGENDA_PRIVATE_KEY;
    if (!privateKey) {
      throw new ConfigurationError(
        'Private key not provided and EIGENDA_PRIVATE_KEY not set in environment'
      );
    }
    const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    this.wallet = new ethers.Wallet(normalizedPrivateKey, this.provider);

    const creditsContractAddress =
      config?.creditsContractAddress ||
      process.env.CREDITS_CONTRACT_ADDRESS ||
      DEFAULT_CREDITS_CONTRACT_ADDRESS;
    this.creditsContract = new ethers.Contract(creditsContractAddress, CreditsABI.abi, this.wallet);
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

  /**
   * Gets the balance for a given identifier.
   * @param {Uint8Array} identifier - The identifier to check balance for
   * @returns {Promise<number>} The balance in ETH
   * @throws {Error} When balance check fails
   */
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

  /**
   * Tops up credits for a given identifier.
   * @param {Uint8Array} identifier - The identifier to top up credits for
   * @param {number} amountEth - Amount of ETH to top up
   * @returns {Promise<{transactionHash: string, status: string}>} Transaction details
   * @throws {Error} When top up fails
   */
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

  /**
   * Creates a new identifier.
   * @returns {Promise<Uint8Array>} The newly created identifier
   * @throws {Error} When identifier creation fails
   */
  async createIdentifier(): Promise<Uint8Array> {
    try {
      const tx = await this.creditsContract.createIdentifier();
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: Log) => this.creditsContract.interface.parseLog(log))
        .find((event: LogDescription | null) => event?.name === 'IdentifierCreated');

      if (event) {
        const identifier = event.args.identifier;
        const hexString = identifier.slice(0, 2) === '0x' ? identifier.slice(2) : identifier;
        return ethers.getBytes('0x' + hexString.padStart(64, '0'));
      }
      throw new Error('No identifier in event logs');
    } catch (error: any) {
      throw new Error(`Failed to create identifier: ${error.message}`);
    }
  }

  /**
   * Gets all identifiers for the current wallet address.
   * @returns {Promise<Uint8Array[]>} Array of identifiers
   * @throws {Error} When getting identifiers fails
   */
  async getIdentifiers(): Promise<Uint8Array[]> {
    try {
      const count = await this.creditsContract.getUserIdentifierCount(this.wallet.address);
      const identifiers = await Promise.all(
        Array.from({ length: Number(count) }, (_, i) =>
          this.creditsContract.getUserIdentifierAt(this.wallet.address, i)
        )
      );
      return identifiers.map((id) => {
        const hexString = id.slice(0, 2) === '0x' ? id.slice(2) : id;
        return ethers.getBytes('0x' + hexString.padStart(64, '0'));
      });
    } catch (error: any) {
      throw new Error(`Failed to get identifiers: ${error.message}`);
    }
  }

  /**
   * Gets the owner of a given identifier.
   * @param {Uint8Array} identifier - The identifier to check ownership for
   * @returns {Promise<string>} The owner's address
   * @throws {Error} When getting owner fails
   */
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
