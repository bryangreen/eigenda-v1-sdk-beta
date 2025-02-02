# EigenDA SDK

A developer-friendly TypeScript/JavaScript SDK for interacting with EigenDA proxy. This SDK simplifies the process of storing and retrieving data using EigenDA's data availability solution.

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
import { EigenDAClient } from 'eigenda-sdk';

// Initialize the client
const client = new EigenDAClient({
  apiUrl: 'YOUR_API_URL',  // Optional: defaults to mainnet
  rpcUrl: 'YOUR_RPC_URL',  // Optional: defaults to mainnet
  privateKey: 'YOUR_PRIVATE_KEY'
});

// Upload data
const uploadResult = await client.upload('Hello EigenDA!');
console.log('Upload Job ID:', uploadResult.jobId);

// Check status
const status = await client.getStatus(uploadResult.jobId);
console.log('Status:', status);

// Retrieve data
const data = await client.retrieve({ jobId: uploadResult.jobId });
console.log('Retrieved Data:', data);
```

## Features

- Simple and intuitive API
- TypeScript support
- Comprehensive error handling
- Automatic retries and status checking
- Full type definitions
- Promise-based async/await interface

## API Reference

### `EigenDAClient`

The main class for interacting with EigenDA.

#### Constructor

```typescript
new EigenDAClient(config?: {
  apiUrl?: string;
  rpcUrl?: string;
  privateKey?: string;
  creditsContractAddress?: string;
})
```

#### Methods

##### `upload(content: string, identifier?: Uint8Array): Promise<UploadResponse>`
Upload data to EigenDA.

##### `getStatus(jobId: string): Promise<StatusResponse>`
Check the status of an upload.

##### `retrieve(options: RetrieveOptions): Promise<any>`
Retrieve data from EigenDA.

##### `getBalance(identifier: Uint8Array): Promise<number>`
Get the credit balance for an identifier.

##### `topupCredits(identifier: Uint8Array, amountEth: number): Promise<{ transactionHash: string; status: string }>`
Add credits to an identifier.

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
