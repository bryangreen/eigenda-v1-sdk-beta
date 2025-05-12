
import { ethers } from 'ethers';
import { ConfigurationError } from '../types';

/**
 * Base class for managing wallet operations
 */
export abstract class BaseWalletManager {
  protected wallet: ethers.Wallet | undefined;
  protected provider: ethers.JsonRpcProvider;

  /**
   * Creates a new BaseWalletManager instance
   * @param rpcUrl - The RPC URL to connect to
   */
  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Sets the wallet for transactions
   * @param wallet - The ethers wallet instance
   */
  setWallet(wallet: ethers.Wallet) {
    this.wallet = wallet.connect(this.provider);
  }

  /**
   * Gets the current wallet instance
   * @returns The connected wallet instance
   * @throws {ConfigurationError} When wallet is not set
   */
  protected getWallet(): ethers.Wallet {
    if (!this.wallet) {
      throw new ConfigurationError('Wallet not set. Call setWallet() first.');
    }
    return this.wallet;
  }
}
