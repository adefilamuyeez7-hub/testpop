#!/usr/bin/env node

/**
 * Deploy ArtDropFactory to Base Sepolia
 * 
 * This script:
 * 1. Deploys the ArtDropFactory contract
 * 2. Compiles and sets the ArtDropArtist bytecode in the factory
 * 
 * Usage:
 *   node deploy-factory.mjs
 * 
 * Environment variables:
 *   PRIVATE_KEY - Deployer private key (should be founder/admin)
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const RPC_URL = 'https://sepolia.base.org';
const ADDRESSES_FILE = path.join(__dirname, '../deployed-addresses.json');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/contracts');

async function main() {
  // Validate environment
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  console.log('🚀 Starting ArtDropFactory deployment...\n');

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(`📝 Deployer address: ${deployer.address}`);
  console.log(`🌐 Network: Base Sepolia (${RPC_URL})\n`);

  // Get founder wallet
  const founderWallet = deployer.address; // Use deployer as founder for now
  console.log(`👑 Founder wallet: ${founderWallet}\n`);

  try {
    // 1. Deploy ArtDropFactory
    console.log('📦 Deploying ArtDropFactory contract...');
    
    const factoryArtifactPath = path.join(ARTIFACTS_DIR, 'ArtDropFactory.sol/ArtDropFactory.json');
    if (!fs.existsSync(factoryArtifactPath)) {
      throw new Error(`Factory artifact not found at ${factoryArtifactPath}`);
    }
    
    const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));
    const factoryFactory = new ethers.ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      deployer
    );

    const factory = await factoryFactory.deploy(founderWallet);
    const factoryDeployTx = factory.deploymentTransaction();
    
    console.log(`✓ Factory deployed at: ${factory.target}`);
    console.log(`  Transaction: ${factoryDeployTx?.hash}\n`);

    // Wait for confirmation
    await factory.waitForDeployment();
    console.log('✓ Deployment confirmed\n');

    // 2. Set ArtDropArtist bytecode in factory
    console.log('📚 Setting ArtDropArtist template bytecode in factory...');
    
    const artistArtifactPath = path.join(ARTIFACTS_DIR, 'ArtDropArtist.sol/ArtDrop.json');
    if (!fs.existsSync(artistArtifactPath)) {
      throw new Error(`Artist artifact not found at ${artistArtifactPath}`);
    }
    
    const artistArtifact = JSON.parse(fs.readFileSync(artistArtifactPath, 'utf8'));
    const bytecodeHex = artistArtifact.bytecode;
    
    console.log(`  Bytecode size: ${(bytecodeHex.length / 2 - 1)} bytes`);
    
    // Set bytecode
    const setBytecodeGas = await factory.setArtDropBytecode.estimateGas(bytecodeHex);
    console.log(`  Estimated gas: ${setBytecodeGas.toString()}\n`);
    
    const tx = await factory.setArtDropBytecode(bytecodeHex);
    console.log(`  Transaction: ${tx.hash}`);
    
    await tx.wait();
    console.log('✓ Bytecode set in factory\n');

    // 3. Save deployment addresses
    console.log('💾 Saving deployment information...\n');
    
    let deployedAddresses = {};
    if (fs.existsSync(ADDRESSES_FILE)) {
      deployedAddresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
    }

    deployedAddresses.ArtDropFactory = {
      address: factory.target,
      deploymentTx: factoryDeployTx?.hash,
      deployedAt: new Date().toISOString(),
      founderWallet: founderWallet,
      network: 'Base Sepolia',
    };

    fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(deployedAddresses, null, 2));

    console.log('✅ DEPLOYMENT COMPLETE!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 DEPLOYMENT SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Factory Address:      ${factory.target}`);
    console.log(`Founder Wallet:       ${founderWallet}`);
    console.log(`Network:              Base Sepolia`);
    console.log(`Deployment Time:      ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n✨ Next steps:');
    console.log('1. Update FACTORY_ADDRESS in src/lib/contracts/artDropFactory.ts');
    console.log('2. Deploy individual artist contracts via deployArtistContract.mjs');
    console.log('3. Update artist profiles with contract addresses\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
