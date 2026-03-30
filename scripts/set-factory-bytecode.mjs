#!/usr/bin/env node

import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers, network } = hre;

  console.log("\n=== SET BYTECODE ON ARTDROPFACTORY ===\n");

  if (!process.argv[2]) {
    console.error("❌ Usage: npx hardhat run scripts/set-factory-bytecode.mjs --network baseSepolia -- <factory-address>");
    process.exit(1);
  }

  const factoryAddress = process.argv[2];
  console.log(`📝 Factory Address: ${factoryAddress}\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`📝 Sender: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  try {
    // Get factory instance
    const factoryABI = [
      {
        inputs: [{ internalType: "bytes", name: "_bytecode", type: "bytes" }],
        name: "setArtDropBytecode",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const factory = new ethers.Contract(factoryAddress, factoryABI, deployer);

    // Get bytecode
    console.log("📦 Compiling ArtDropArtist bytecode...");
    let artDropBytecode;
    
    try {
      const ArtDrop = await ethers.getContractFactory("contracts/ArtDropArtist.sol:ArtDrop");
      artDropBytecode = ArtDrop.bytecode;
      console.log(`✅ Bytecode size: ${(artDropBytecode.length / 2 - 1)} bytes\n`);
    } catch (error) {
      console.error("❌ Failed to get ArtDrop bytecode:", error.message);
      process.exit(1);
    }

    // Set bytecode
    console.log("📚 Setting ArtDropArtist bytecode in factory...");
    const setTx = await factory.setArtDropBytecode(artDropBytecode);
    console.log(`✅ Bytecode set - tx: ${setTx.hash}`);

    await setTx.wait();
    console.log("✅ Confirmed\n");

    console.log("=== COMPLETE ===\n");

  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
