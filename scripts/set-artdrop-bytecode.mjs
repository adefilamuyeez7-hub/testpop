#!/usr/bin/env node

/**
 * Set ArtDrop Bytecode in Factory
 * 
 * This script takes the compiled ArtDrop bytecode from Remix
 * and registers it with the factory so it can deploy artist contracts.
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FACTORY_ABI = [
  {
    inputs: [{ internalType: "bytes", name: "bytecode", type: "bytes" }],
    name: "setArtDropBytecode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ ERROR: PRIVATE_KEY not set");
    console.error("Usage: $env:PRIVATE_KEY='0x...'; node scripts/set-artdrop-bytecode.mjs");
    process.exit(1);
  }

  // Load factory address
  const addressesPath = path.join(__dirname, "../deployed-addresses.json");
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ deployed-addresses.json not found");
    console.error("   Run deploy-factory-direct.mjs first");
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const factoryAddress = addresses.factory;

  console.log("🔧 Set ArtDrop Bytecode in Factory\n");
  console.log(`📍 Factory: ${factoryAddress}`);
  console.log(`🔑 Signer: ${new ethers.Wallet(privateKey).address}\n`);

  // Get bytecode from user
  console.log("📋 STEPS TO GET BYTECODE:");
  console.log("1. Go to https://remix.ethereum.org/");
  console.log("2. Create file: ArtDrop.sol");
  console.log("3. Paste from: contracts/ArtDropArtist.sol");
  console.log("4. Compiler: 0.8.28 | EVM: cancun");
  console.log("5. Compile and find 'ArtDrop' contract");
  console.log("6. Click copy bytecode (long hex starting with 6080604052...)\n");

  const bytecodeInput = await prompt("Paste bytecode here: ");
  rl.close();

  if (!bytecodeInput || bytecodeInput.length < 100) {
    console.error("❌ Invalid bytecode");
    process.exit(1);
  }

  // Clean up bytecode (remove 0x if present)
  const bytecode = bytecodeInput.startsWith("0x")
    ? bytecodeInput
    : "0x" + bytecodeInput;

  try {
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const signer = new ethers.Wallet(privateKey, provider);

    console.log("\n⏳ Sending transaction...\n");

    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
    const tx = await factory.setArtDropBytecode(bytecode);

    console.log(`📤 TX Hash: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...\n`);

    const receipt = await tx.wait();

    console.log(`✅ Bytecode set!`);
    console.log(`📦 Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`💰 Cost: ${ethers.formatEther(receipt.gasPrice * receipt.gasUsed)} ETH\n`);

    // Save to addresses file
    addresses.bytecodeSetAt = new Date().toISOString();
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));

    console.log("🎉 Factory is now ready!");
    console.log("\n📝 Next: Deploy artist contracts");
    console.log("   node scripts/deploy-artist-contract.mjs 0xArtistWallet");

  } catch (error) {
    console.error("❌ Transaction failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();
