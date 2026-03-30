#!/usr/bin/env node

/**
 * Deploy Individual ArtDrop Contract for an Artist
 * 
 * This script:
 * 1. Calls the ArtDropFactory to deploy a new ArtDrop contract for an artist
 * 2. Stores the contract address in Supabase
 * 
 * Usage:
 *   node deploy-artist-contract.mjs <artistWallet>
 *   Example: node deploy-artist-contract.mjs 0x1234...
 * 
 * Environment variables:
 *   PRIVATE_KEY - Factory owner private key
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_ANON_KEY - Supabase anonymous key
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const RPC_URL = 'https://sepolia.base.org';
const ADDRESSES_FILE = path.join(__dirname, '../deployed-addresses.json');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/contracts');

// Validate inputs
if (process.argv.length < 3) {
  console.error('Usage: node deploy-artist-contract.mjs <artistWallet>');
  console.error('Example: node deploy-artist-contract.mjs 0x1234567890123456789012345678901234567890');
  process.exit(1);
}

const ARTIST_WALLET = ethers.getAddress(process.argv[2]); // Validates checksum

// Factory ABI (embedded - no artifact needed)
const FACTORY_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'artistWallet', type: 'address' }],
    name: 'deployArtDrop',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'artist', type: 'address' },
      { indexed: false, internalType: 'address', name: 'contractAddress', type: 'address' },
    ],
    name: 'ArtDropDeployed',
    type: 'event',
  },
];

async function main() {
  // Validate environment
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  if (!fs.existsSync(ADDRESSES_FILE)) {
    throw new Error(`Deployed addresses file not found: ${ADDRESSES_FILE}`);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
  const FACTORY_ADDRESS = deployedAddresses.factory || deployedAddresses.ArtDropFactory?.address;
  
  if (!FACTORY_ADDRESS) {
    throw new Error('Factory not deployed. Run deploy-factory-direct.mjs first');
  }

  const ARTIST_WALLET = ethers.getAddress(process.argv[2]); // Validates checksum

  console.log('🚀 Starting artist contract deployment...\n');

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`📝 Deployer address: ${deployer.address}`);
  console.log(`🎨 Artist wallet:    ${ARTIST_WALLET}`);
  console.log(`🏭 Factory address:  ${FACTORY_ADDRESS}`);
  console.log(`🌐 Network:          Base Sepolia\n`);

  try {
    // Load factory contract
    console.log('📦 Loading factory contract...\n');

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, deployer);

    // Deploy artist contract
    console.log('🔄 Deploying artist contract via factory...\n');

    const deployGas = await factory.deployArtDrop.estimateGas(ARTIST_WALLET);
    console.log(`  Estimated gas: ${deployGas.toString()}`);

    const tx = await factory.deployArtDrop(ARTIST_WALLET);
    console.log(`  Transaction: ${tx.hash}`);
    console.log('  Waiting for confirmation...\n');

    // Wait for deployment
    const receipt = await tx.wait();
    console.log(`  Confirmed in block: ${receipt.blockNumber}\n`);

    // Parse deployment event to get contract address
    const deployedEvent = receipt.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event?.name === 'ArtDropDeployed');

    if (!deployedEvent) {
      throw new Error('Could not find ArtDropDeployed event in transaction receipt');
    }

    const ARTIST_CONTRACT_ADDRESS = deployedEvent.args[1]; // artDropContract parameter

    console.log('✅ ARTIST CONTRACT DEPLOYED!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 DEPLOYMENT SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Artist Wallet:       ${ARTIST_WALLET}`);
    console.log(`Contract Address:    ${ARTIST_CONTRACT_ADDRESS}`);
    console.log(`Deployment TX:       ${tx.hash}`);
    console.log(`Network:             Base Sepolia`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Update Supabase if credentials provided
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      console.log('📝 Updating Supabase...\n');

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const { error } = await supabase
        .from('artists')
        .update({
          contract_address: ARTIST_CONTRACT_ADDRESS,
          contract_deployment_tx: tx.hash,
          contract_deployed_at: new Date().toISOString(),
        })
        .eq('wallet', ARTIST_WALLET.toLowerCase());

      if (error) {
        console.warn(`⚠️  Warning: Could not update Supabase: ${error.message}`);
        console.warn('   You may need to update the database manually.\n');
      } else {
        console.log('✓ Supabase updated with contract address\n');
      }
    } else {
      console.log('⚠️  Supabase credentials not provided.');
      console.log('   Update manually with:');
      console.log(`   - Artist wallet: ${ARTIST_WALLET}`);
      console.log(`   - Contract address: ${ARTIST_CONTRACT_ADDRESS}`);
      console.log(`   - Deployment tx: ${tx.hash}\n`);
    }

    console.log('✨ Next steps:');
    console.log(`1. Use contract address: ${ARTIST_CONTRACT_ADDRESS}`);
    console.log('2. Test subscription, drops, and minting');
    console.log('3. Share contract address with artist\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
