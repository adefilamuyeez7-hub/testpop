#!/usr/bin/env node
/**
 * Testnet Setup & Funding Script
 * Sets up testnet environment with funded accounts
 * 
 * Usage:
 *   node scripts/setup-testnet.js
 */

import hre from "hardhat";

const Log = {
  success: (msg) => console.log(`✅ ${msg}`),
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

async function setupTestnet() {
  try {
    Log.info(`\n🔧 POPUP Testnet Setup\n`);
    
    const [deployer, user1, user2, user3] = await hre.ethers.getSigners();
    
    Log.info(`Accounts:`);
    Log.info(`  Deployer: ${deployer.address}`);
    Log.info(`  User1:    ${user1.address}`);
    Log.info(`  User2:    ${user2.address}`);
    Log.info(`  User3:    ${user3.address}`);
    
    // Get network info
    const network = await hre.ethers.provider.getNetwork();
    Log.info(`\nNetwork: ${network.name} (Chain ${network.chainId})`);
    
    // Check balances
    Log.info(`\n💰 Account Balances:`);
    const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
    const user1Balance = await hre.ethers.provider.getBalance(user1.address);
    const user2Balance = await hre.ethers.provider.getBalance(user2.address);
    const user3Balance = await hre.ethers.provider.getBalance(user3.address);
    
    Log.info(`  Deployer: ${hre.ethers.formatEther(deployerBalance)} ETH`);
    Log.info(`  User1:    ${hre.ethers.formatEther(user1Balance)} ETH`);
    Log.info(`  User2:    ${hre.ethers.formatEther(user2Balance)} ETH`);
    Log.info(`  User3:    ${hre.ethers.formatEther(user3Balance)} ETH`);
    
    // On local hardhat network, automatically fund accounts
    if (network.chainId === 31337) {
      Log.warning(`\n⚠️  Hardhat network detected - accounts have initial balance`);
      Log.info(`Test accounts are pre-configured.`);
    } else if (hre.network.name === "sepolia") {
      Log.warning(`\n⚠️  Sepolia testnet - requires external funding`);
      Log.info(`To fund your accounts:`);
      Log.info(`  1. Visit: https://sepoliafaucet.com`);
      Log.info(`  2. Enter deployer address: ${deployer.address}`);
      Log.info(`  3. Check balance in ~1 minute`);
    }
    
    Log.success(`\n✅ Testnet setup complete!\n`);
    
  } catch (error) {
    Log.error(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

setupTestnet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
