import { ethers } from "ethers";
import fs from "fs";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = "https://sepolia.base.org";

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY not set in .env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("Deployer wallet:", wallet.address);

// Get balance
const balance = await provider.getBalance(wallet.address);
console.log("Balance:", ethers.formatEther(balance), "ETH\n");

// Read contract artifacts
const artDropBytecode = readFileSync(path.join(__dirname, "..", "artifacts", "contracts", "ArtDrop.sol", "ArtDrop.json"), "utf-8");
const poapBytecode = readFileSync(path.join(__dirname, "..", "artifacts", "contracts", "POAPCampaign.sol", "POAPCampaign.json"), "utf-8");

const artDropJSON = JSON.parse(artDropBytecode);
const poapJSON = JSON.parse(poapBytecode);

// Deploy ArtDrop
console.log("📦 Deploying ArtDrop...");
const ArtDropFactory = new ethers.ContractFactory(artDropJSON.abi, artDropJSON.bytecode, wallet);
const artDrop = await ArtDropFactory.deploy(wallet.address);
const artDropTx = await artDrop.waitForDeployment();
const artDropAddress = await artDrop.getAddress();
console.log("✅ ArtDrop deployed:", artDropAddress);

// Deploy POAPCampaign  
console.log("\n📦 Deploying POAPCampaign...");
const POAPFactory = new ethers.ContractFactory(poapJSON.abi, poapJSON.bytecode, wallet);
const poap = await POAPFactory.deploy();
const poapTx = await poap.waitForDeployment();
const poapAddress = await poap.getAddress();
console.log("✅ POAPCampaign deployed:", poapAddress);

// For ProductStore, we'll use the placeholder address for now
// since artifacts are not available
const productStoreAddress = "0x0000000000000000000000000000000000000000";
console.log("\n⚠️  ProductStore placeholder:", productStoreAddress);
console.log("   (To be deployed separately with full Hardhat setup)\n");

// Save addresses
const addresses = {
  ArtDrop: artDropAddress,
  POAPCampaign: poapAddress,
  ProductStore: productStoreAddress,
  deployedAt: new Date().toISOString(),
  deployerWallet: wallet.address,
  network: "Base Sepolia",
};

fs.writeFileSync(path.join(__dirname, "..", "deployed-addresses.json"), JSON.stringify(addresses, null, 2));
console.log("📋 Addresses saved to deployed-addresses.json\n");
console.log(JSON.stringify(addresses, null, 2));
