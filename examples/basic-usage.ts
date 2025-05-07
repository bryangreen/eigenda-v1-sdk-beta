import { EigenDAv1Client } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize client
    const client = new EigenDAv1Client({
      privateKey: process.env.PRIVATE_KEY
      // Optional: override default settings
      // apiUrl: 'https://custom.api.eigenda.xyz',
      // rpcUrl: 'https://custom.rpc.base.org'
    });

    // Get or create an identifier
    console.log('Checking for existing identifiers...');
    let identifier;
    const existingIdentifiers = await client.getIdentifiers();
    
    if (existingIdentifiers.length > 0) {
      identifier = existingIdentifiers[0];
      console.log('Using existing identifier:', Buffer.from(identifier).toString('hex'));
    } else {
      console.log('No existing identifier found. Creating new one...');
      identifier = await client.createIdentifier();
      console.log('Created new identifier:', Buffer.from(identifier).toString('hex'));
    }

    // Upload data
    console.log('Uploading data...');
    const uploadResult = await client.upload('Hello EigenDA!', identifier);
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
