#!/usr/bin/env node

import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers, network } = hre;

  console.log("\n=== ARTDROPFACTORY DEPLOYMENT TO BASE SEPOLIA ===\n");

  // Verify network
  if (network.name !== "baseSepolia") {
    console.error(`❌ Wrong network! Current: ${network.name}, Expected: baseSepolia`);
    console.error("Run with: npx hardhat run scripts/deploy-factory-basesepolia.mjs --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  try {
    // Deploy ArtDropFactory
    console.log("🏭 Deploying ArtDropFactory...");
    const ArtDropFactory = await ethers.getContractFactory("ArtDropFactory");
    const factory = await ArtDropFactory.deploy(deployer.address);
    const txHash = factory.deploymentTransaction()?.hash;

    console.log(`✅ Deployment tx: ${txHash}`);
    console.log("⏳ Waiting for confirmation...\n");

    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    console.log(`✅ ArtDropFactory deployed to: ${factoryAddress}\n`);

    // Save deployment info
    const deploymentDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const deploymentInfo = {
      network: network.name,
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      deployer: deployer.address,
      factory: {
        address: factoryAddress,
        deploymentTx: txHash,
      },
      timestamp: new Date().toISOString(),
      note: "Run: npx hardhat run scripts/set-factory-bytecode.mjs --network baseSepolia -- " + factoryAddress,
    };

    const filePath = path.join(deploymentDir, "factory_basesepolia.json");
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Saved deployment info to: ${filePath}\n`);

    console.log("=== NEXT STEP ===\n");
    console.log("Set the ArtDropArtist bytecode on the factory:");
    console.log(`npx hardhat run scripts/set-factory-bytecode.mjs --network baseSepolia -- ${factoryAddress}\n`);

  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
