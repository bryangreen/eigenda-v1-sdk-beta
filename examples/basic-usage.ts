import { EigenDAClient } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize client
    const client = new EigenDAClient({
      privateKey: process.env.PRIVATE_KEY
      // Optional: override default settings
      // apiUrl: 'https://custom.api.eigenda.xyz',
      // rpcUrl: 'https://custom.rpc.base.org'
    });

    // Upload data
    console.log('Uploading data...');
    const uploadResult = await client.upload('Hello EigenDA!');
    console.log('Upload successful:', uploadResult);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const status = await client.waitForStatus(uploadResult.jobId);
    console.log('Status:', status);

    // Retrieve data
    console.log('Retrieving data...');
    const data = await client.retrieve({
      jobId: uploadResult.jobId,
      waitForCompletion: true
    });
    console.log('Retrieved data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
