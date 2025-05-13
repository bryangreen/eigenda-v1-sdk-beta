import { Log, LogDescription } from 'ethers';
import CreditsABI from '../../abis/v1/Credits.json';
import { ethers } from 'ethers';
import { EigenDAConfig, ConfigurationError, IEigenCredits } from '../types';
import {
  DEFAULT_CREDITS_CONTRACT_ADDRESS,
  DEFAULT_RPC_URL,
  validateConfig
} from '../utils/environment';
import { BaseWalletManager } from './base';

/**
 * Manages EigenDA credits operations
 */
export class EigenCredits extends BaseWalletManager implements IEigenCredits {
  private creditsContract: ethers.Contract;

  /**
   * Creates a new EigenCredits instance
   * @param config - Optional configuration for EigenDA
   * @throws {ConfigurationError} When configuration is invalid
   */
  constructor(config?: EigenDAConfig) {
    const configErrors = validateConfig(config || {});
    if (configErrors.length > 0) {
      throw new ConfigurationError(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    const rpcUrl = config?.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
    super(rpcUrl);

    if (config?.wallet) {
      this.setWallet(config.wallet);
    } else if (config?.privateKey) {
      const normalizedPrivateKey = config.privateKey.startsWith('0x')
        ? config.privateKey
        : `0x${config.privateKey}`;
      this.setWallet(new ethers.Wallet(normalizedPrivateKey));
    }

    const creditsContractAddress =
      config?.creditsContractAddress ||
      process.env.CREDITS_CONTRACT_ADDRESS ||
      DEFAULT_CREDITS_CONTRACT_ADDRESS;
    this.creditsContract = new ethers.Contract(
      creditsContractAddress,
      CreditsABI.abi,
      this.getWallet()
    );
  }

  /**
   * Gets the credit balance for a given identifier
   * @param identifier - The identifier to check the balance for
   * @returns The balance in ETH
   * @throws {Error} When the balance check fails
   */
  async getBalance(identifier: Uint8Array): Promise<number> {
    try {
      const hexString = Buffer.from(identifier).toString('hex');
      console.log('Formatted Identifier hex:', hexString);
      const formattedIdentifier = ethers.hexlify(ethers.zeroPadValue('0x' + hexString, 32));
      console.log('Formatted Identifier:', formattedIdentifier);
      const balance = await this.creditsContract.getBalance(formattedIdentifier);
      console.log('Balance:', balance);
      return Number(ethers.formatEther(balance));
    } catch (error: any) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Tops up credits for a given identifier
   * @param identifier - The identifier to top up credits for
   * @param amountEth - The amount of ETH to top up
   * @returns Transaction details including hash and status
   * @throws {Error} When the top up operation fails
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
   * Creates a new identifier for credits
   * @returns The newly created identifier
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
   * Gets all identifiers owned by the current wallet
   * @returns Array of identifiers
   * @throws {Error} When fetching identifiers fails
   */
  async getIdentifiers(): Promise<Uint8Array[]> {
    try {
      const count = await this.creditsContract.getUserIdentifierCount(this.getWallet().address);
      const identifiers = await Promise.all(
        Array.from({ length: Number(count) }, (_, i) =>
          this.creditsContract.getUserIdentifierAt(this.getWallet().address, i)
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
   * Gets the owner address of a given identifier
   * @param identifier - The identifier to check ownership for
   * @returns The owner's address
   * @throws {Error} When fetching owner fails
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
