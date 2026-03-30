#!/usr/bin/env node

/**
 * Deploy ArtDropFactory using bytecode from Remix
 * 
 * STEPS:
 * 1. Go to https://remix.ethereum.org/
 * 2. Create file: ArtDropFactory.sol
 * 3. Paste contents from contracts/ArtDropFactory.sol
 * 4. Compiler: 0.8.28, EVM: cancun
 * 5. Compile, then copy bytecode from "Solidity Compiler" panel
 * 6. Paste bytecode below (remove 0x prefix):
 * 7. Run: $env:PRIVATE_KEY="0x..."; node scripts/deploy-factory-direct.mjs
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ PASTE REMIX BYTECODE HERE ============
// Go to https://remix.ethereum.org/ and get this from the compiler output
const FACTORY_BYTECODE = ``;  // Remove leading 0x

// ABI for ArtDropFactory (this is correct)
const FACTORY_ABI = [
  {
    inputs: [],
    name: "deployArtDrop",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes", name: "bytecode", type: "bytes" }],
    name: "setArtDropBytecode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "artist", type: "address" }],
    name: "getArtistContract",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "artist", type: "address" },
      { indexed: false, internalType: "address", name: "contractAddress", type: "address" },
    ],
    name: "ArtDropDeployed",
    type: "event",
  },
];

// ArtDrop ABI (for contract creation via factory)
const ARTDROP_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_artist", type: "address" },
      { internalType: "address", name: "_founderWallet", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "artist",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "founderWallet",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

async function main() {
  if (!FACTORY_BYTECODE || FACTORY_BYTECODE.length < 100) {
    console.error("❌ ERROR: Bytecode not set!");
    console.error("\n📋 STEPS:");
    console.error("1. Go to https://remix.ethereum.org/");
    console.error("2. Create new file: ArtDropFactory.sol");
    console.error("3. Copy paste from: contracts/ArtDropFactory.sol");
    console.error("4. Compiler: 0.8.28 | EVM: cancun");
    console.error("5. Click 'Compile ArtDropFactory.sol'");
    console.error("6. In Solidity Compiler panel, click copy bytecode");
    console.error("7. Paste above in FACTORY_BYTECODE (remove 0x prefix)");
    console.error("8. Save and rerun this script\n");
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ ERROR: PRIVATE_KEY not set");
    console.error("Usage: $env:PRIVATE_KEY='0x...'; node scripts/deploy-factory-direct.mjs");
    process.exit(1);
  }

  const RPC_URL = "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(privateKey, provider);

  console.log(`🔑 Deployer: ${signer.address}`);
  console.log(`📡 Network: Base Sepolia`);
  console.log(`💰 Chain ID: 84532\n`);

  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log(`💵 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("❌ No ETH in wallet. Get testnet ETH from:");
    console.error("   https://www.coinbase.com/faucets/base-sepolia-faucet");
    process.exit(1);
  }

  try {
    console.log("📝 Deploying ArtDropFactory...\n");
    
    const factoryFactory = new ethers.ContractFactory(
      FACTORY_ABI,
      "0x" + FACTORY_BYTECODE,
      signer
    );

    const factory = await factoryFactory.deploy();
    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    console.log(`✅ Factory deployed!`);
    console.log(`📍 Address: ${factoryAddress}\n`);

    // Now we need the ArtDrop bytecode too
    console.log("⚠️  NEXT: Get ArtDrop bytecode from Remix");
    console.log("1. Create new file: ArtDrop.sol");
    console.log("2. Copy from: contracts/ArtDropArtist.sol");
    console.log("3. Compile with 0.8.28 | EVM: cancun");
    console.log("4. Copy the 'ArtDrop' contract bytecode");
    console.log("5. Paste into scripts/set-artdrop-bytecode.mjs");
    console.log("6. Run: node scripts/set-artdrop-bytecode.mjs\n");

    // Save factory address
    const addresses = {
      factory: factoryAddress,
      chainId: 84532,
      network: "base-sepolia",
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(__dirname, "../deployed-addresses.json"),
      JSON.stringify(addresses, null, 2)
    );

    console.log("✅ Factory address saved to deployed-addresses.json\n");

  } catch (error) {
    console.error("❌ Deployment failed:");
    console.error(error.message);
    if (error.reason) console.error("Reason:", error.reason);
    process.exit(1);
  }
}

main();
