
import { ethers } from 'ethers';
import { EigenDAv1Client, EigenCredits } from '../../src';

async function main() {
  // Option 1: Using private key
  const privateKey = process.env.PRIVATE_KEY as string;
  const clientWithKey = new EigenDAv1Client({
    privateKey
  });
  const creditsWithKey = new EigenCredits({
    privateKey
  });

  // Option 2: Using wallet
  const wallet = new ethers.Wallet(privateKey);
  const clientWithWallet = new EigenDAv1Client({
    wallet
  });
  const creditsWithWallet = new EigenCredits({
    wallet
  });

  // Rest of your code using either client instance...
  const identifier = await creditsWithWallet.createIdentifier();
  console.log('Created identifier:', Buffer.from(identifier).toString('hex'));
}

main();
