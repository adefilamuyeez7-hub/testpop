#!/usr/bin/env node

/**
 * COMPLETE DEPLOYMENT FLOW
 * Deploys ArtDropFactory + ArtDropArtist to Base Sepolia
 * 
 * This script guides you through:
 * 1. Getting bytecode from Remix
 * 2. Deploying factory
 * 3. Setting ArtDrop bytecode
 * 4. Deploying first artist contract
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

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
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "artist", type: "address" },
      { indexed: false, internalType: "address", name: "contractAddress", type: "address" },
    ],
    name: "ArtDropDeployed",
    type: "event",
  },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 ARTDROP FACTORY DEPLOYMENT - BASE SEPOLIA");
  console.log("=".repeat(70) + "\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ ERROR: PRIVATE_KEY not set");
    console.error("\nSet it with:");
    console.error('$env:PRIVATE_KEY="0x..."');
    rl.close();
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const signer = new ethers.Wallet(privateKey, provider);
  const deployerAddress = signer.address;

  console.log(`🔑 Deployer:  ${deployerAddress}`);
  console.log(`📡 Network:   Base Sepolia`);
  console.log(`🔗 Chain ID:  84532\n`);

  // Check balance
  const balance = await provider.getBalance(deployerAddress);
  console.log(`💰 Balance:   ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("❌ No ETH in wallet!");
    console.error("\nGet testnet ETH:");
    console.error("👉 https://www.coinbase.com/faucets/base-sepolia-faucet\n");
    rl.close();
    process.exit(1);
  }

  // ─── STEP 1: Get Factory Bytecode ────────────────────────────────────────
  console.log("📋 STEP 1: Get Factory Bytecode from Remix\n");
  console.log("1. Go to: https://remix.ethereum.org/");
  console.log("2. Create new file: ArtDropFactory.sol");
  console.log("3. Copy from: contracts/ArtDropFactory.sol");
  console.log("4. Compiler: 0.8.28");
  console.log("5. EVM version: cancun");
  console.log("6. Click 'Compile ArtDropFactory.sol'");
  console.log("7. In Solidity Compiler panel, copy bytecode\n");

  const factoryBytecodeInput = await prompt(
    "Paste factory bytecode (without 0x prefix): "
  );

  if (!factoryBytecodeInput || factoryBytecodeInput.length < 100) {
    console.error("❌ Invalid bytecode length");
    rl.close();
    process.exit(1);
  }

  const factoryBytecode = "0x" + factoryBytecodeInput.replace(/^0x/, "");

  // ─── STEP 2: Deploy Factory ─────────────────────────────────────────────
  console.log("\n⏳ Deploying ArtDropFactory...\n");

  let factoryAddress;
  try {
    const factoryFactory = new ethers.ContractFactory(FACTORY_ABI, factoryBytecode, signer);
    const factory = await factoryFactory.deploy();
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();

    console.log(`✅ Factory deployed!`);
    console.log(`📍 Address: ${factoryAddress}\n`);
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    rl.close();
    process.exit(1);
  }

  // Save address
  const addressesPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(
      {
        factory: factoryAddress,
        chainId: 84532,
        network: "base-sepolia",
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // ─── STEP 3: Get ArtDrop Bytecode ──────────────────────────────────────
  console.log("📋 STEP 2: Get ArtDrop Bytecode from Remix\n");
  console.log("1. In Remix, create new file: ArtDrop.sol");
  console.log("2. Copy from: contracts/ArtDropArtist.sol");
  console.log("3. Compiler: 0.8.28");
  console.log("4. EVM version: cancun");
  console.log("5. Click 'Compile ArtDrop.sol'");
  console.log("6. Find 'ArtDrop' contract, copy bytecode\n");

  const artdropBytecodeInput = await prompt(
    "Paste ArtDrop bytecode (without 0x prefix): "
  );

  if (!artdropBytecodeInput || artdropBytecodeInput.length < 100) {
    console.error("❌ Invalid bytecode length");
    rl.close();
    process.exit(1);
  }

  const artdropBytecode = "0x" + artdropBytecodeInput.replace(/^0x/, "");

  // ─── STEP 4: Set ArtDrop Bytecode in Factory ──────────────────────────
  console.log("\n⏳ Setting ArtDrop bytecode in factory...\n");

  try {
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
    const tx = await factory.setArtDropBytecode(artdropBytecode);
    console.log(`📤 TX: ${tx.hash}`);
    console.log("⏳ Waiting...\n");
    await tx.wait();
    console.log("✅ ArtDrop bytecode set!\n");
  } catch (error) {
    console.error("❌ Failed:", error.message);
    rl.close();
    process.exit(1);
  }

  // ─── STEP 5: Deploy Artist Contract (Optional) ─────────────────────────
  const deployArtist = await prompt(
    "Deploy artist contract now? (y/n, default: y): "
  );

  if (deployArtist.toLowerCase() !== "n") {
    const artistWallet = await prompt(
      "Artist wallet address (default: deployer): "
    );

    const resolvedArtistWallet = artistWallet
      ? ethers.getAddress(artistWallet)
      : deployerAddress;

    console.log("\n⏳ Deploying artist contract...\n");

    try {
      const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
      const tx = await factory.deployArtDrop(resolvedArtistWallet);
      console.log(`📤 TX: ${tx.hash}`);
      console.log("⏳ Waiting...\n");

      const receipt = await tx.wait();

      // Parse event
      const iface = new ethers.Interface(FACTORY_ABI);
      let artistContractAddress;

      for (const log of receipt.logs) {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "ArtDropDeployed") {
          artistContractAddress = parsed.args[1];
          break;
        }
      }

      console.log("✅ Artist contract deployed!");
      console.log(`📍 Address: ${artistContractAddress}`);
      console.log(`🎨 Artist:  ${resolvedArtistWallet}\n`);
    } catch (error) {
      console.error("❌ Failed:", error.message);
    }
  }

  // ─── SUMMARY ───────────────────────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`\n📍 Factory Address: ${factoryAddress}`);
  console.log(`📍 Saved to: deployed-addresses.json\n`);
  console.log("📝 NEXT STEPS:\n");
  console.log("1. Update frontend:");
  console.log(`   src/lib/contracts/artDropFactory.ts`);
  console.log(`   → Set FACTORY_ADDRESS = "${factoryAddress}"\n`);
  console.log("2. Rebuild and redeploy:");
  console.log("   npm run build");
  console.log("   npx vercel --prod\n");
  console.log("3. Verify on block explorer:");
  console.log("   https://sepolia.basescan.org/?q=" + factoryAddress + "\n");

  rl.close();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  rl.close();
  process.exit(1);
});
