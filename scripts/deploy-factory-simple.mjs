#!/usr/bin/env node

/**
 * Deploy ArtDropFactory and compile artifacts
 * Uses direct ethers.js without hardhat
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read contract source files
const artistContractPath = path.join(__dirname, '../contracts/ArtDropArtist.sol');
const factoryContractPath = path.join(__dirname, '../contracts/ArtDropFactory.sol');

console.log('📖 Reading contract files...');
console.log('ArtDropArtist.sol:', fs.existsSync(artistContractPath) ? '✅' : '❌');
console.log('ArtDropFactory.sol:', fs.existsSync(factoryContractPath) ? '✅' : '❌');

// Check if precompiled artifacts exist
const artifactsDir = path.join(__dirname, '../artifacts/contracts');
const artistArtifactPath = path.join(artifactsDir, 'ArtDropArtist.sol/ArtDrop.json');
const factoryArtifactPath = path.join(artifactsDir, 'ArtDropFactory.sol/ArtDropFactory.json');

console.log('\n📦 Checking for compiled artifacts...');
console.log('ArtDrop artifact:', fs.existsSync(artistArtifactPath) ? '✅' : '❌');
console.log('ArtDropFactory artifact:', fs.existsSync(factoryArtifactPath) ? '✅' : '❌');

if (!fs.existsSync(artistArtifactPath)) {
  console.error('\n❌ ERROR: ArtDrop.json artifact not found');
  console.error('Please compile contracts first:');
  console.error('  Try: npx hardhat compile');
  console.error('  Or use a remote compiler service');
  process.exit(1);
}

if (!fs.existsSync(factoryArtifactPath)) {
  console.error('\n❌ ERROR: ArtDropFactory.json artifact not found');
  console.error('Please compile contracts first');
  process.exit(1);
}

console.log('\n✅ All artifacts found!\n');

// Now proceed with deployment
if (!process.env.PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY environment variable is required');
  process.exit(1);
}

const RPC_URL = 'https://sepolia.base.org';
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, '../deployed-addresses.json');

async function main() {
  console.log('🚀 Starting ArtDropFactory deployment...\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`📝 Deployer: ${deployer.address}`);
  console.log(`🌐 Network: Base Sepolia\n`);

  try {
    // Load artifacts
    const artistArtifact = JSON.parse(fs.readFileSync(artistArtifactPath, 'utf8'));
    const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));

    // Deploy Factory
    console.log('📦 Deploying ArtDropFactory...');
    const founderWallet = deployer.address;
    
    const factoryFactory = new ethers.ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      deployer
    );

    const factory = await factoryFactory.deploy(founderWallet);
    const factoryDeployTx = factory.deploymentTransaction();

    console.log(`✓ Factory deployed to: ${factory.target}`);
    console.log(`  Tx: ${factoryDeployTx?.hash}\n`);

    // Wait for deployment
    await factory.waitForDeployment();
    console.log('✓ Deployment confirmed\n');

    // Set bytecode
    console.log('📚 Setting ArtDropArtist bytecode in factory...');
    const bytecodeHex = artistArtifact.bytecode;
    console.log(`  Bytecode size: ${(bytecodeHex.length / 2 - 1)} bytes\n`);

    const tx = await factory.setArtDropBytecode(bytecodeHex);
    console.log(`✓ Bytecode set`);
    console.log(`  Tx: ${tx.hash}\n`);

    await tx.wait();

    // Save addresses
    console.log('💾 Saving deployment info...\n');
    
    let deployedAddresses = {};
    if (fs.existsSync(DEPLOYED_ADDRESSES_FILE)) {
      deployedAddresses = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, 'utf8'));
    }

    deployedAddresses.ArtDropFactory = {
      address: factory.target,
      deploymentTx: factoryDeployTx?.hash,
      deployedAt: new Date().toISOString(),
      founderWallet: founderWallet,
      network: 'Base Sepolia',
    };

    fs.writeFileSync(DEPLOYED_ADDRESSES_FILE, JSON.stringify(deployedAddresses, null, 2));

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ DEPLOYMENT SUCCESSFUL!\n');
    console.log('📋 FACTORY DEPLOYMENT SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Factory Address:      ${factory.target}`);
    console.log(`Founder Wallet:       ${founderWallet}`);
    console.log(`Network:              Base Sepolia`);
    console.log(`Deployment Time:      ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('✨ Next steps:');
    console.log(`1. Update FACTORY_ADDRESS in src/lib/contracts/artDropFactory.ts:`);
    console.log(`   export const FACTORY_ADDRESS = "${factory.target}" as const;\n`);
    console.log('2. Deploy individual artist contracts:');
    console.log('   npx node scripts/deploy-artist-contract.mjs 0xArtistWallet\n');

  } catch (error) {
    console.error('❌ Deployment error:', error.message);
    process.exit(1);
  }
}

main();
