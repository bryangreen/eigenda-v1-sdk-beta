
/**
 * Class for managing EigenDA credits and identifiers
 */
export class EigenCredits implements IEigenCredits {
  private creditsContract: ethers.Contract;
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  /**
   * Creates an instance of EigenCredits
   * @param config - Configuration object for the client
   * @throws {ConfigurationError} When configuration is invalid
   */
  constructor(config?: EigenDAConfig) {
    const configErrors = validateConfig(config || {});
    if (configErrors.length > 0) {
      throw new ConfigurationError(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    const rpcUrl = config?.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (config?.wallet) {
      this.wallet = config.wallet;
    } else {
      const privateKey = config?.privateKey || process.env.EIGENDA_PRIVATE_KEY;
      if (!privateKey) {
        throw new ConfigurationError(
          'Private key not provided and EIGENDA_PRIVATE_KEY not set in environment'
        );
      }
      const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(normalizedPrivateKey, this.provider);
    }

    const creditsContractAddress =
      config?.creditsContractAddress ||
      process.env.CREDITS_CONTRACT_ADDRESS ||
      DEFAULT_CREDITS_CONTRACT_ADDRESS;
    this.creditsContract = new ethers.Contract(creditsContractAddress, CreditsABI.abi, this.wallet);
  }

  /**
   * Gets the balance for a given identifier
   * @param identifier - The identifier to check balance for
   * @returns The balance in ETH
   * @throws {Error} If balance check fails
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
   * Tops up credits for an identifier
   * @param identifier - The identifier to top up
   * @param amountEth - Amount of ETH to top up
   * @returns Transaction details
   * @throws {Error} If top up fails
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
   * Creates a new identifier
   * @returns The created identifier
   * @throws {Error} If identifier creation fails
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
   * Gets all identifiers for the current wallet
   * @returns Array of identifiers
   * @throws {Error} If fetching identifiers fails
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
   * Gets the owner of an identifier
   * @param identifier - The identifier to check ownership for
   * @returns The owner's address
   * @throws {Error} If fetching owner fails
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
