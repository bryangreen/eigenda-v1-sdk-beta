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
