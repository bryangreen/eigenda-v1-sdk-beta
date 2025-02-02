import { EigenDAClient } from '../src';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize client with custom configuration
    const client = new EigenDAClient({
      privateKey: process.env.PRIVATE_KEY,
      apiUrl: process.env.API_URL,
      rpcUrl: process.env.BASE_RPC_URL,
      creditsContractAddress: process.env.CREDITS_CONTRACT_ADDRESS
    });

    // Create a new identifier
    console.log('Creating identifier...');
    const identifier = randomBytes(32);
    console.log('Identifier:', identifier.toString('hex'));

    // Top up credits
    console.log('Topping up credits...');
    const topupResult = await client.topupCredits(identifier, 0.1); // 0.1 ETH
    console.log('Topup result:', topupResult);

    // Check balance
    console.log('Checking balance...');
    const balance = await client.getBalance(identifier);
    console.log('Balance:', balance, 'ETH');

    // Upload data with identifier
    console.log('Uploading data...');
    const content = JSON.stringify({
      message: 'Hello EigenDA!',
      timestamp: Date.now()
    });
    const uploadResult = await client.upload(content, identifier);
    console.log('Upload result:', uploadResult);

    // Wait for confirmation with custom parameters
    console.log('Waiting for confirmation...');
    const status = await client.waitForStatus(
      uploadResult.jobId,
      'CONFIRMED',
      30, // max checks
      20, // check interval (seconds)
      60 // initial delay (seconds)
    );
    console.log('Status:', status);

    // Retrieve data with different options
    console.log('Retrieving by job ID...');
    const dataByJobId = await client.retrieve({
      jobId: uploadResult.jobId,
      waitForCompletion: true
    });
    console.log('Retrieved data by job ID:', dataByJobId);

    if (status.requestId) {
      console.log('Retrieving by request ID...');
      const dataByRequestId = await client.retrieve({
        requestId: status.requestId
      });
      console.log('Retrieved data by request ID:', dataByRequestId);
    }

    if (status.blobInfo) {
      console.log('Retrieving by blob info...');
      const dataByBlobInfo = await client.retrieve({
        batchHeaderHash: status.blobInfo.batchHeaderHash,
        blobIndex: status.blobInfo.blobIndex
      });
      console.log('Retrieved data by blob info:', dataByBlobInfo);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
