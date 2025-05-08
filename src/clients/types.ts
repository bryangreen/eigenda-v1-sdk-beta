export interface IEigenDAClient {
  /**
   * Uploads content to EigenDA.
   * @param content Content to upload
   * @param identifier Optional identifier for upload
   */
  upload(content: string, identifier?: Uint8Array): Promise<UploadResponse>;

  /**
   * Gets the status of a job.
   * @param jobId Job ID to check
   */
  getStatus(jobId: string): Promise<StatusResponse>;

  /**
   * Waits for a job to reach a target status.
   * @param jobId Job ID to wait for
   * @param targetStatus Target status to wait for
   * @param maxChecks Maximum number of checks
   * @param checkInterval Check interval in seconds
   * @param initialDelay Initial delay in seconds
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
}

export interface IEigenCredits {
  createIdentifier(): Promise<Uint8Array>;
  getIdentifiers(): Promise<Uint8Array[]>;
  getIdentifierOwner(identifier: Uint8Array): Promise<string>;
  topupCredits(
    identifier: Uint8Array,
    amountEth: number
  ): Promise<{ transactionHash: string; status: string }>;
  getBalance(identifier: Uint8Array): Promise<number>;
}

export interface EigenDAConfig {
  apiUrl?: string;
  rpcUrl?: string;
  privateKey?: string;
}

export interface EigenCreditsConfig {
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
