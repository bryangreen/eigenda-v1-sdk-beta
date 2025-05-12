import { ethers } from 'ethers';
import { EigenDAv1Client, EigenCredits } from '../../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    // Initialize client with custom configuration
    const client = new EigenDAv1Client({
      wallet,
      apiUrl: process.env.API_URL,
      rpcUrl: process.env.BASE_RPC_URL
    });

    // Initialize EigenCredits with custom configuration
    const credits = new EigenCredits({
      wallet,
      creditsContractAddress: process.env.CREDITS_CONTRACT_ADDRESS
    });

    // Get or create an identifier
    console.log('Checking for existing identifiers...');
    let identifier;
    const existingIdentifiers = await credits.getIdentifiers();

    if (existingIdentifiers.length > 0) {
      identifier = existingIdentifiers[0];
      console.log('Using existing identifier:', Buffer.from(identifier).toString('hex'));
    } else {
      console.log('No existing identifier found. Creating new one...');
      identifier = await credits.createIdentifier();
      console.log('Created new identifier:', Buffer.from(identifier).toString('hex'));
    }

    // Check balance
    console.log('Checking balance...');
    const balance = await credits.getBalance(identifier);
    console.log('Balance:', balance, 'ETH');

    // Top up credits if balance is low
    if (balance < 0.001) {
      console.log('Balance is low. Topping up credits...');
      const topupResult = await credits.topupCredits(identifier, 0.001); // 0.001 ETH
      console.log('Topup result:', topupResult);

      // Verify new balance
      const newBalance = await credits.getBalance(identifier);
      console.log('New balance:', newBalance, 'ETH');
    }

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
