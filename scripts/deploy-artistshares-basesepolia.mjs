#!/usr/bin/env node

import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers, network } = hre;

  console.log("\n=== ARTISTSHARESTOKEN DEPLOYMENT TO BASE SEPOLIA ===\n");

  if (network.name !== "baseSepolia") {
    console.error(`❌ Wrong network! Current: ${network.name}, Expected: baseSepolia`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  // The artist is typically the deployer
  const artistAddress = deployer.address;
  console.log(`🎨 Artist Address: ${artistAddress}\n`);

  try {
    console.log("📦 Deploying ArtistSharesToken...");
    const ArtistSharesToken = await ethers.getContractFactory("ArtistSharesToken");
    const token = await ArtistSharesToken.deploy(artistAddress);
    const txHash = token.deploymentTransaction()?.hash;

    console.log(`✅ Deployment tx: ${txHash}`);
    console.log("⏳ Waiting for confirmation...\n");

    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    console.log(`✅ ArtistSharesToken deployed to: ${tokenAddress}\n`);

    // Save deployment info
    const deploymentDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const deploymentInfo = {
      network: network.name,
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      deployer: deployer.address,
      token: {
        address: tokenAddress,
        artist: artistAddress,
        name: "Artist Shares",
        symbol: "SHARES",
        deploymentTx: txHash,
      },
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(deploymentDir, "artistshares_basesepolia.json");
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Saved deployment info to: ${filePath}\n`);

    console.log("=== DEPLOYMENT COMPLETE ===\n");
    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Add to .env.local:\nVITE_ARTIST_SHARES_ADDRESS=${tokenAddress}\n`);

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
