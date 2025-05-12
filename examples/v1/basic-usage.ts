import { ethers } from 'ethers';
import { EigenDAv1Client, EigenCredits } from '../../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    // Initialize client
    const client = new EigenDAv1Client({
      wallet
      // Optional: override default settings
      // apiUrl: 'https://custom.api.eigenda.xyz',
      // rpcUrl: 'https://custom.rpc.base.org'
    });

    const credits = new EigenCredits({
      wallet
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
