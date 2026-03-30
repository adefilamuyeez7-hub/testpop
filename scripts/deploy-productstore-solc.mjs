#!/usr/bin/env node

import ethers from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deployProductStore() {
  try {
    console.log("🚀 Deploying ProductStore to Base Sepolia...\n");

    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY not found in .env file");
    }

    // Create wallet and provider
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`, provider);

    console.log("📝 Wallet address:", wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

    if (balance === 0n) {
      throw new Error("Account has no balance. Fund it from https://faucet.base.org/");
    }

    // Read and compile ProductStore.sol
    const productStorePath = path.join(__dirname, "../contracts/ProductStore.sol");
    const sourceCode = fs.readFileSync(productStorePath, "utf-8");

    console.log("📦 Compiling ProductStore.sol...");
    
    // Use Solc compiler programmatically
    const solc = (await import("solc")).default;
    
    // Prepare sources
    const sources = {
      "ProductStore.sol": { content: sourceCode }
    };

    // Also add OpenZeppelin imports
    const openzeppelinPath = path.join(__dirname, "../node_modules/@openzeppelin/contracts");
    const ownerablePath = path.join(openzeppelinPath, "access/Ownable.sol");
    const reentrancyPath = path.join(openzeppelinPath, "utils/ReentrancyGuard.sol");
    
    if (fs.existsSync(ownerablePath) && fs.existsSync(reentrancyPath)) {
      sources["@openzeppelin/contracts/access/Ownable.sol"] = {
        content: fs.readFileSync(ownerablePath, "utf-8")
      };
      sources["@openzeppelin/contracts/utils/ReentrancyGuard.sol"] = {
        content: fs.readFileSync(reentrancyPath, "utf-8")
      };
    }

    const input = {
      language: "Solidity",
      sources,
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode"]
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "cancun"
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      console.error("Compilation errors:", output.errors);
      throw new Error("Solidity compilation failed");
    }

    const contractFile = output.contracts["ProductStore.sol"];
    if (!contractFile || !contractFile.ProductStore) {
      throw new Error("ProductStore contract not found in compiled output");
    }

    const { abi, evm } = contractFile.ProductStore;
    const bytecode = evm.bytecode.object;

    console.log("✅ Contract compiled successfully\n");

    // Deploy
    console.log("⏳ Deploying contract (this may take a minute)...");
    
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    const receipt = await contract.deploymentTransaction().wait(1);

    console.log("✅ Contract deployed!\n");
    console.log("📍 Contract Address:", contract.target);
    console.log("🔗 Block Explorer: https://sepolia.basescan.org/address/" + contract.target);

    // Save to file
    const deployedFile = path.join(__dirname, "../deployed-productstore.json");
    fs.writeFileSync(
      deployedFile,
      JSON.stringify(
        {
          network: "baseSepolia",
          address: contract.target,
          deployer: wallet.address,
          abi: abi,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    );

    console.log("\n📄 Deployment details saved to deployed-productstore.json");
    console.log("\n✨ Next steps:");
    console.log("1. Update src/lib/contracts/productStore.ts with:");
    console.log(`   export const PRODUCT_STORE_ADDRESS = "${contract.target}" as const;`);
    console.log("2. Run: npm run build");
    console.log("3. Deploy to production: vercel --prod");

    return contract.target;

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

deployProductStore();
