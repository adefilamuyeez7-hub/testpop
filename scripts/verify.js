#!/usr/bin/env node
/**
 * Contract Verification Script
 * Verifies deployed contracts on Etherscan
 * 
 * Usage:
 *   npx hardhat run scripts/verify.js --network sepolia
 */

import hre from "hardhat";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const Log = {
  success: (msg) => console.log(`✅ ${msg}`),
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

async function loadDeployment() {
  try {
    const deploymentDir = path.join(__dirname, "../deployments");
    const files = await fs.readdir(deploymentDir);
    const networkFiles = files.filter((f) =>
      f.startsWith(`deployment-${hre.network.name}`)
    );
    
    if (networkFiles.length === 0) {
      throw new Error(`No deployment found for network ${hre.network.name}`);
    }
    
    // Get most recent deployment
    const latestFile = networkFiles.sort().reverse()[0];
    const deploymentPath = path.join(deploymentDir, latestFile);
    const data = await fs.readFile(deploymentPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    Log.error(`Could not load deployment: ${error.message}`);
    process.exit(1);
  }
}

async function verifyContract(name, address) {
  Log.info(`Verifying ${name}...`);
  
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    Log.success(`${name} verified successfully`);
    return true;
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      Log.warning(`${name} already verified`);
      return true;
    }
    Log.error(`${name} verification failed: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    Log.info(`\n🔍 POPUP Contract Verification\n`);
    Log.info(`Network: ${hre.network.name}`);
    
    const deployment = await loadDeployment();
    const contracts = deployment.contracts;
    
    Log.info(`\nVerifying contracts:\n`);
    
    let verified = 0;
    const contractList = Object.entries(contracts);
    
    for (const [name, address] of contractList) {
      const success = await verifyContract(name, address);
      if (success) verified++;
    }
    
    Log.success(`\n✅ Verification complete! ${verified}/${contractList.length} verified\n`);
    
  } catch (error) {
    Log.error(`Verification failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
