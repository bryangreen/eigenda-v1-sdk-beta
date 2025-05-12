
import { ethers } from 'ethers';

/**
 * Interface for the main EigenDA client operations
 */
export interface IEigenDAClient {
  /**
   * Uploads content to EigenDA.
   * @param content - Content to upload
   * @param identifier - Optional identifier for upload
   * @returns Promise containing upload response with job and request IDs
   */
  upload(content: string, identifier?: Uint8Array): Promise<UploadResponse>;

  /**
   * Gets the status of a job.
   * @param jobId - Job ID to check
   * @returns Promise containing status response
   */
  getStatus(jobId: string): Promise<StatusResponse>;

  /**
   * Waits for a job to reach a target status.
   * @param jobId - Job ID to wait for
   * @param targetStatus - Target status to wait for
   * @param maxChecks - Maximum number of checks
   * @param checkInterval - Check interval in seconds
   * @param initialDelay - Initial delay in seconds
   * @returns Promise containing final status response
   */
  waitForStatus(
    jobId: string,
    targetStatus?: 'CONFIRMED' | 'FINALIZED',
    maxChecks?: number,
    checkInterval?: number,
    initialDelay?: number
  ): Promise<StatusResponse>;

  /**
   * Retrieves data from EigenDA.
   * @param options - Options for retrieving data
   * @returns Promise containing retrieved data
   */
  retrieve(options: RetrieveOptions): Promise<any>;
}

/**
 * Interface for managing EigenDA credits
 */
export interface IEigenCredits {
  /**
   * Creates a new identifier for credits
   * @returns Promise containing new identifier
   */
  createIdentifier(): Promise<Uint8Array>;

  /**
   * Gets all identifiers owned by the current wallet
   * @returns Promise containing array of identifiers
   */
  getIdentifiers(): Promise<Uint8Array[]>;

  /**
   * Gets the owner of an identifier
   * @param identifier - Identifier to check ownership for
   * @returns Promise containing owner's address
   */
  getIdentifierOwner(identifier: Uint8Array): Promise<string>;

  /**
   * Tops up credits for an identifier
   * @param identifier - Identifier to top up credits for
   * @param amountEth - Amount of ETH to top up
   * @returns Promise containing transaction details
   */
  topupCredits(
    identifier: Uint8Array,
    amountEth: number
  ): Promise<{ transactionHash: string; status: string }>;

  /**
   * Gets the credit balance for an identifier
   * @param identifier - Identifier to check balance for
   * @returns Promise containing balance in ETH
   */
  getBalance(identifier: Uint8Array): Promise<number>;
}

/**
 * Configuration options for EigenDA client
 */
export interface EigenDAConfig {
  /** API URL for EigenDA service */
  apiUrl?: string;
  /** RPC URL for blockchain connection */
  rpcUrl?: string;
  /** Private key for wallet */
  privateKey?: string;
  /** Ethers wallet instance */
  wallet?: ethers.Wallet;
  /** Credits contract address */
  creditsContractAddress?: string;
}

/**
 * Response from upload operation
 */
export interface UploadResponse {
  /** Unique job identifier */
  jobId: string;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Response from status check operation
 */
export interface StatusResponse {
  /** Current status of the operation */
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FINALIZED' | 'FAILED';
  /** Optional request identifier */
  requestId?: string;
  /** Optional blob information */
  blobInfo?: {
    batchHeaderHash: string;
    blobIndex: number;
  };
  /** Optional error message */
  error?: string;
}

/**
 * Options for data retrieval
 */
export interface RetrieveOptions {
  /** Job identifier */
  jobId?: string;
  /** Request identifier */
  requestId?: string;
  /** Batch header hash */
  batchHeaderHash?: string;
  /** Blob index */
  blobIndex?: number;
  /** Whether to wait for completion */
  waitForCompletion?: boolean;
}

/**
 * Base error class for EigenDA operations
 */
export class EigenDAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EigenDAError';
  }
}

/**
 * Error thrown during upload operations
 */
export class UploadError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Error thrown during retrieve operations
 */
export class RetrieveError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'RetrieveError';
  }
}

/**
 * Error thrown during status check operations
 */
export class StatusError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'StatusError';
  }
}

/**
 * Error thrown during configuration validation
 */
export class ConfigurationError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
