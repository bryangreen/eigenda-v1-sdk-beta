
export interface IEigenDAClient {
  /**
   * Uploads content to EigenDA.
   * @param content The content to upload
   * @param identifier Optional identifier for the upload
   */
  upload(content: string, identifier?: Uint8Array): Promise<UploadResponse>;

  /**
   * Gets the status of a job.
   * @param jobId The ID of the job to check
   */
  getStatus(jobId: string): Promise<StatusResponse>;

  /**
   * Waits for a job to reach a target status.
   * @param jobId The ID of the job to wait for
   * @param targetStatus The target status to wait for
   * @param maxChecks Maximum number of status checks
   * @param checkInterval Interval between checks in seconds
   * @param initialDelay Initial delay before first check in seconds
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
   * @param options Options for retrieving data
   */
  retrieve(options: RetrieveOptions): Promise<any>;

  /**
   * Gets the balance for a given identifier.
   * @param identifier The identifier to check balance for
   */
  getBalance(identifier: Uint8Array): Promise<number>;

  /**
   * Tops up credits for a given identifier.
   * @param identifier The identifier to top up credits for
   * @param amountEth Amount of ETH to top up
   */
  topupCredits(
    identifier: Uint8Array,
    amountEth: number
  ): Promise<{ transactionHash: string; status: string }>;

  /**
   * Creates a new identifier.
   */
  createIdentifier(): Promise<Uint8Array>;

  /**
   * Gets all identifiers for the current wallet address.
   */
  getIdentifiers(): Promise<Uint8Array[]>;

  /**
   * Gets the owner of a given identifier.
   * @param identifier The identifier to check ownership for
   */
  getIdentifierOwner(identifier: Uint8Array): Promise<string>;
}

export interface EigenDAConfig {
  apiUrl?: string;
  rpcUrl?: string;
  privateKey?: string;
  creditsContractAddress?: string;
}

export interface UploadResponse {
  jobId: string;
  requestId: string;
}

export interface StatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FINALIZED' | 'FAILED';
  requestId?: string;
  blobInfo?: {
    batchHeaderHash: string;
    blobIndex: number;
  };
  error?: string;
}

export interface RetrieveOptions {
  jobId?: string;
  requestId?: string;
  batchHeaderHash?: string;
  blobIndex?: number;
  waitForCompletion?: boolean;
}

export class EigenDAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EigenDAError';
  }
}

export class UploadError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export class RetrieveError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'RetrieveError';
  }
}

export class StatusError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'StatusError';
  }
}

export class ConfigurationError extends EigenDAError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
