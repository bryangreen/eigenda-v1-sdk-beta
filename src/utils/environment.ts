export const DEFAULT_API_URL = 'https://test-agent-proxy-api.eigenda.xyz';
export const DEFAULT_RPC_URL = 'https://mainnet.base.org';
export const DEFAULT_CREDITS_CONTRACT_ADDRESS = '0x0CC001F1bDe9cd129092d4d24D935DB985Ce42A9';

export const MAX_STATUS_CHECKS = 60; // Maximum number of status checks (10 minutes with 10-second interval)
export const STATUS_CHECK_INTERVAL = 10; // Seconds between status checks
export const INITIAL_RETRIEVAL_DELAY = 300; // 5 minutes initial delay before first retrieval attempt

export const validateConfig = (config: {
  apiUrl?: string;
  rpcUrl?: string;
  privateKey?: string;
  creditsContractAddress?: string;
}) => {
  const errors: string[] = [];

  if (config.apiUrl && !isValidUrl(config.apiUrl)) {
    errors.push('Invalid API URL format');
  }

  if (config.rpcUrl && !isValidUrl(config.rpcUrl)) {
    errors.push('Invalid RPC URL format');
  }

  if (config.privateKey && !isValidPrivateKey(config.privateKey)) {
    errors.push('Invalid private key format');
  }

  if (config.creditsContractAddress && !isValidAddress(config.creditsContractAddress)) {
    errors.push('Invalid credits contract address format');
  }

  return errors;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidPrivateKey = (key: string): boolean => {
  const normalizedKey = key.startsWith('0x') ? key.slice(2) : key;
  return /^[0-9a-fA-F]{64}$/.test(normalizedKey);
};

const isValidAddress = (address: string): boolean => {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
};
