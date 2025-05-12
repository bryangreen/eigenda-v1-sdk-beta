
import { ethers } from 'ethers';
import { ConfigurationError } from '../types';

export abstract class BaseWalletManager {
  protected wallet: ethers.Wallet | undefined;
  protected provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  setWallet(wallet: ethers.Wallet) {
    this.wallet = wallet.connect(this.provider);
  }

  protected getWallet(): ethers.Wallet {
    if (!this.wallet) {
      throw new ConfigurationError('Wallet not set. Call setWallet() first.');
    }
    return this.wallet;
  }
}
