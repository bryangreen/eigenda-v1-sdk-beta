import { ethers } from 'ethers';
import { Log, LogDescription } from 'ethers';
import CreditsABI from '../../abis/v1/Credits.json';
import { EigenCreditsConfig, IEigenCredits } from '../types';
import { DEFAULT_CREDITS_CONTRACT_ADDRESS } from '../utils/environment';

export class EigenCredits implements IEigenCredits {
  private creditsContract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor(config: EigenCreditsConfig, wallet: ethers.Wallet) {
    this.wallet = wallet;

    const creditsContractAddress =
      config?.creditsContractAddress ||
      process.env.CREDITS_CONTRACT_ADDRESS ||
      DEFAULT_CREDITS_CONTRACT_ADDRESS;
    this.creditsContract = new ethers.Contract(creditsContractAddress, CreditsABI.abi, this.wallet);
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
