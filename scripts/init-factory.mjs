#!/usr/bin/env node

import hre from "hardhat";

const factoryAddress = "0xFd58d0f5F0423201Edb756d0f44D667106fc5705";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("\n=== SET BYTECODE ON FACTORY ===\n");
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Sender: ${deployer.address}\n`);

  try {
    // Get factory
    const factory = await ethers.getContractAt("ArtDropFactory", factoryAddress);

    // Get bytecode
    console.log("📦 Compiling ArtDropArtist bytecode...");
    const ArtDrop = await ethers.getContractFactory("contracts/ArtDropArtist.sol:ArtDrop");
    const bytecode = ArtDrop.bytecode;
    console.log(`✅ Bytecode size: ${(bytecode.length / 2 - 1)} bytes\n`);

    // Set bytecode
    console.log("📚 Setting bytecode...");
    const tx = await factory.setArtDropBytecode(bytecode);
    console.log(`✅ Tx: ${tx.hash}`);

    await tx.wait();
    console.log("✅ Confirmed\n");

    console.log("=== COMPLETE ===\n");
    console.log(`Factory Ready: ${factoryAddress}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
