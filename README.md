
# EigenDA SDK

A developer-friendly TypeScript/JavaScript SDK for interacting with EigenDA proxy. This SDK simplifies the process of storing and retrieving data using EigenDA's data availability solution.

> **Note**: This SDK currently supports EigenDA v1. Support for EigenDA v2 is coming soon! Also, this SDK works with an experimental EigenDA "Credits" system. This will be replaced in future versions. 

## Installation

```bash
npm install eigenda-sdk
```

## Limits and Costs

- **Maximum Blob Size**: 2.5MB per blob
- **Cost**: 0.015 ETH ($60) per GB

Need higher limits or credits for student/indie projects? Contact us

## Quick Start

```typescript
import { EigenDAv1Client, EigenCredits } from 'eigenda-sdk';
import { ethers } from 'ethers';

// Option 1a: Initialize with private key -or-
const client = new EigenDAv1Client({
  privateKey: 'YOUR_PRIVATE_KEY',  // Either privateKey or wallet is required
  apiUrl: 'YOUR_API_URL',         // Optional: defaults to test API URL
  rpcUrl: 'YOUR_RPC_URL'          // Optional: defaults to Base mainnet
});

const credits = new EigenCredits({
  privateKey: 'YOUR_PRIVATE_KEY',  // Either privateKey or wallet is required
  creditsContractAddress: 'YOUR_CONTRACT_ADDRESS'  // Optional: defaults to mainnet address
});

// Option 1b: Initialize with wallet
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY');
const clientWithWallet = new EigenDAv1Client({
  wallet,                         // Either wallet or privateKey is required
  apiUrl: 'YOUR_API_URL',        // Optional: defaults to test API URL
  rpcUrl: 'YOUR_RPC_URL'         // Optional: defaults to Base mainnet
});

const creditsWithWallet = new EigenCredits({
  wallet,                         // Either wallet or privateKey is required
  creditsContractAddress: 'YOUR_CONTRACT_ADDRESS'  // Optional: defaults to mainnet address
});

// Create an identifier for managing credits
const identifier = await credits.createIdentifier();
console.log('Created identifier:', Buffer.from(identifier).toString('hex'));

// Top up credits
await credits.topupCredits(identifier, 0.015); // 0.015 ETH

// Upload data using the identifier
const uploadResult = await client.upload('Hello EigenDA!', identifier);
console.log('Upload Job ID:', uploadResult.jobId);

// Check status
const status = await client.getStatus(uploadResult.jobId);
console.log('Status:', status);

// Retrieve data
const data = await client.retrieve({ jobId: uploadResult.jobId });
console.log('Retrieved Data:', data);
```

## Features

- Separate clients for EigenDA v1 or v2
- Ability to work directly with Credits or EigenDA
- Simple and intuitive API
- TypeScript support
- Comprehensive error handling
- Automatic retries and status checking
- Full type definitions
- Promise-based async/await interface

## API Reference

### `EigenDAv1Client`

The main class for interacting with EigenDA v1.

#### Constructor

```typescript
new EigenDAv1Client(config?: {
  apiUrl?: string;
  rpcUrl?: string;
  privateKey?: string;
  wallet?: ethers.Wallet;
})
```

#### Methods

##### `upload(content: string, identifier?: Uint8Array): Promise<UploadResponse>`
Upload data to EigenDA.

##### `getStatus(jobId: string): Promise<StatusResponse>`
Check the status of an upload.

##### `retrieve(options: RetrieveOptions): Promise<any>`
Retrieve data from EigenDA.

### `EigenCredits`

Class for managing EigenDA credits and identifiers.

#### Constructor

```typescript
new EigenCredits(config?: {
  privateKey?: string;
  wallet?: ethers.Wallet;
  creditsContractAddress?: string;
})
```

#### Methods

##### `createIdentifier(): Promise<Uint8Array>`
Creates a new identifier for managing credits.

##### `getIdentifiers(): Promise<Uint8Array[]>`
Gets all identifiers owned by the current wallet.

##### `getIdentifierOwner(identifier: Uint8Array): Promise<string>`
Gets the owner address of a given identifier.

##### `topupCredits(identifier: Uint8Array, amountEth: number): Promise<{ transactionHash: string; status: string }>`
Adds credits to an identifier.

##### `getBalance(identifier: Uint8Array): Promise<number>`
Gets the credit balance for an identifier.

## Error Handling

The SDK includes comprehensive error handling. All methods throw typed errors that extend `Error`:

```typescript
try {
  await client.upload('Hello EigenDA!');
} catch (error) {
  if (error instanceof EigenDAError) {
    console.error('EigenDA Error:', error.message);
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
