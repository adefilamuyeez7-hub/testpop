#!/usr/bin/env node

/**
 * AUTOMATED DEPLOYMENT
 * Compiles and deploys to Base Sepolia without manual Remix steps
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import solc with proper module handling
const solcImport = await import("solc");
const solc = solcImport.default;

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

// Import callback for dependency resolution
function findImports(importPath) {
  const contractsDir = path.join(__dirname, "../contracts");
  const nodeModulesDir = path.join(__dirname, "../node_modules");

  // Try contracts dir first
  const contractPath = path.join(contractsDir, importPath);
  if (fs.existsSync(contractPath)) {
    return { contents: fs.readFileSync(contractPath, "utf8") };
  }

  // Try node_modules
  const nodeModulePath = path.join(nodeModulesDir, importPath);
  if (fs.existsSync(nodeModulePath)) {
    return { contents: fs.readFileSync(nodeModulePath, "utf8") };
  }

  return { error: `File not found: ${importPath}` };
}

async function compileContract(contractPath) {
  console.log(`📦 Compiling ${path.basename(contractPath)}...`);

  const source = fs.readFileSync(contractPath, "utf8");
  const filename = path.basename(contractPath);

  const input = {
    language: "Solidity",
    sources: {
      [filename]: { content: source },
    },
    settings: {
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  try {
    // Only use import callback if contract has imports
    const hasImports = source.includes("import");
    const compileOptions = hasImports ? { import: findImports } : undefined;
    
    const output = JSON.parse(solc.compile(JSON.stringify(input), compileOptions));

    if (output.errors && output.errors.some((e) => e.severity === "error")) {
      console.error("❌ Compilation errors:");
      output.errors.forEach((e) => {
        console.error(`\n  File: ${e.sourceLocation?.file || 'unknown'}`);
        console.error(`  Line: ${e.sourceLocation?.start || 'unknown'}`);
        console.error(`  Message: ${e.message}`);
      });
      process.exit(1);
    }

    const contracts = output.contracts[filename];
    if (!contracts) {
      console.error("❌ No contracts compiled");
      process.exit(1);
    }

    // Get bytecode for main contract
    const contractNames = Object.keys(contracts);
    const mainContractName = contractNames[0];
    const bytecode = contracts[mainContractName].evm.bytecode.object;

    console.log(`✅ Compiled: ${mainContractName}`);
    console.log(`   Bytecode length: ${bytecode.length / 2} bytes\n`);

    return { bytecode: "0x" + bytecode, abi: contracts[mainContractName].abi };
  } catch (error) {
    console.error("❌ Compilation failed:", error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 ARTDROP AUTOMATED DEPLOYMENT - BASE SEPOLIA");
  console.log("=".repeat(70) + "\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ PRIVATE_KEY not set");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const signer = new ethers.Wallet(privateKey, provider);

  console.log(`🔑 Deployer:  ${signer.address}`);
  console.log(`📡 Network:   Base Sepolia`);
  console.log(`🔗 Chain ID:  84532\n`);

  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log(`💰 Balance:   ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("❌ No ETH in wallet!");
    console.error("👉 https://www.coinbase.com/faucets/base-sepolia-faucet");
    process.exit(1);
  }

  // Compile contracts
  console.log("📝 COMPILATION STEP\n");
  const factoryPath = path.join(__dirname, "../contracts/ArtDropFactory.sol");
  const artdropPath = path.join(__dirname, "../contracts/ArtDropArtist.sol");

  if (!fs.existsSync(factoryPath)) {
    console.error(`❌ ${factoryPath} not found`);
    process.exit(1);
  }
  if (!fs.existsSync(artdropPath)) {
    console.error(`❌ ${artdropPath} not found`);
    process.exit(1);
  }

  const factory = await compileContract(factoryPath);
  const artdrop = await compileContract(artdropPath);

  // Deploy factory
  console.log("📝 DEPLOYMENT STEP\n");
  console.log("⏳ Deploying ArtDropFactory...\n");

  let factoryAddress;
  try {
    const factoryFactory = new ethers.ContractFactory(FACTORY_ABI, factory.bytecode, signer);
    const deployedFactory = await factoryFactory.deploy();
    await deployedFactory.waitForDeployment();
    factoryAddress = await deployedFactory.getAddress();

    console.log(`✅ Factory deployed!`);
    console.log(`📍 Address: ${factoryAddress}\n`);
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }

  // Set ArtDrop bytecode
  console.log("⏳ Setting ArtDrop bytecode in factory...\n");

  try {
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
    const tx = await factoryContract.setArtDropBytecode(artdrop.bytecode);
    console.log(`📤 TX: ${tx.hash}`);
    console.log("⏳ Waiting...\n");
    await tx.wait();
    console.log("✅ ArtDrop bytecode set!\n");
  } catch (error) {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  }

  // Deploy artist contract
  console.log("⏳ Deploying artist contract...\n");

  let artistContractAddress;
  try {
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
    const tx = await factoryContract.deployArtDrop(signer.address);
    console.log(`📤 TX: ${tx.hash}`);
    console.log("⏳ Waiting...\n");

    const receipt = await tx.wait();

    // Parse event
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log of receipt.logs) {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "ArtDropDeployed") {
        artistContractAddress = parsed.args[1];
        break;
      }
    }

    console.log("✅ Artist contract deployed!");
    console.log(`📍 Address: ${artistContractAddress}`);
    console.log(`🎨 Artist:  ${signer.address}\n`);
  } catch (error) {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  }

  // Save addresses
  const addressesPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(
      {
        factory: factoryAddress,
        artistContract: artistContractAddress,
        chainId: 84532,
        network: "base-sepolia",
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // Summary
  console.log("=".repeat(70));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`\n📍 Factory Address:  ${factoryAddress}`);
  console.log(`📍 Artist Contract:  ${artistContractAddress}`);
  console.log(`📍 Saved to: deployed-addresses.json\n`);
  console.log("📝 NEXT STEPS:\n");
  console.log("1. Update frontend:");
  console.log(`   src/lib/contracts/artDropFactory.ts`);
  console.log(`   export const FACTORY_ADDRESS = "${factoryAddress}";\n`);
  console.log("2. Rebuild and redeploy:");
  console.log("   npm run build");
  console.log("   npx vercel --prod\n");
  console.log("3. Verify contracts:");
  console.log(`   https://sepolia.basescan.org/address/${factoryAddress}\n`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
