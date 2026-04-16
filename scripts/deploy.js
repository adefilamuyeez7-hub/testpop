#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEPLOYMENTS_DIR = path.join(ROOT, "deployments");
const ZERO_ADDRESS = ethers.ZeroAddress;

for (const envFile of [".env.local", ".env", path.join("server", ".env.local"), path.join("server", ".env")]) {
  dotenv.config({ path: path.join(ROOT, envFile) });
}

const CHAIN_CONFIG = {
  baseSepolia: {
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "",
  },
  base: {
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL || "",
  },
  sepolia: {
    chainId: 11155111,
    rpcUrl: process.env.SEPOLIA_RPC_URL || "",
  },
};

const deploymentLog = {
  timestamp: new Date().toISOString(),
  network: process.argv[2] || "baseSepolia",
  chainId: null,
  deployer: null,
  contracts: {},
  config: {},
  transactions: {},
};

const log = {
  info: (message) => console.log(`[info] ${message}`),
  success: (message) => console.log(`[ok] ${message}`),
  error: (message) => console.error(`[error] ${message}`),
};

async function loadArtifact(baseName) {
  const abiPath = path.join(ROOT, `${baseName}.abi`);
  const binPath = path.join(ROOT, `${baseName}.bin`);
  const [abiRaw, bytecodeRaw] = await Promise.all([
    fs.readFile(abiPath, "utf8"),
    fs.readFile(binPath, "utf8"),
  ]);

  return {
    abi: JSON.parse(abiRaw),
    bytecode: `0x${bytecodeRaw.trim()}`,
  };
}

function requireEnv(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeAddress(value, label) {
  if (!value) return ZERO_ADDRESS;
  try {
    return ethers.getAddress(value);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

async function deployContract(name, artifactBaseName, signer, constructorArgs = []) {
  log.info(`Deploying ${name}...`);
  const artifact = await loadArtifact(artifactBaseName);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash || null;
  deploymentLog.contracts[name] = address;
  deploymentLog.transactions[name] = txHash;
  log.success(`${name} deployed at ${address}`);
  return contract;
}

async function main() {
  const networkName = process.argv[2] || "baseSepolia";
  const network = CHAIN_CONFIG[networkName];
  if (!network) {
    throw new Error(`Unsupported network "${networkName}". Use one of: ${Object.keys(CHAIN_CONFIG).join(", ")}`);
  }

  const rpcUrl = requireEnv(
    networkName === "baseSepolia"
      ? "BASE_SEPOLIA_RPC_URL"
      : networkName === "base"
        ? "BASE_RPC_URL"
        : "SEPOLIA_RPC_URL",
    network.rpcUrl,
  );
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY", process.env.PRIVATE_KEY || "");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const deployer = await signer.getAddress();
  const balance = await provider.getBalance(deployer);

  deploymentLog.network = networkName;
  deploymentLog.chainId = network.chainId;
  deploymentLog.deployer = deployer;

  const platformFeeRecipient = normalizeAddress(
    process.env.PLATFORM_FEE_RECIPIENT || deployer,
    "PLATFORM_FEE_RECIPIENT",
  );
  const usdcAddress = normalizeAddress(
    process.env.BASE_SEPOLIA_USDC_ADDRESS || process.env.USDC_ADDRESS || ZERO_ADDRESS,
    "USDC_ADDRESS",
  );
  const usdtAddress = normalizeAddress(
    process.env.BASE_SEPOLIA_USDT_ADDRESS || process.env.USDT_ADDRESS || ZERO_ADDRESS,
    "USDT_ADDRESS",
  );

  deploymentLog.config = {
    platformFeeRecipient,
    usdcAddress,
    usdtAddress,
  };

  log.info(`Deploying to ${networkName} (${network.chainId}) as ${deployer}`);
  log.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);

  const referralManager = await deployContract(
    "PopupReferralManager",
    "contracts_PopupReferralManager_sol_PopupReferralManager",
    signer,
    [],
  );

  const payoutDistributor = await deployContract(
    "PopupPayoutDistributor",
    "contracts_PopupPayoutDistributor_sol_PopupPayoutDistributor",
    signer,
    [usdcAddress, usdtAddress, platformFeeRecipient],
  );

  const productStore = await deployContract(
    "PopupProductStore",
    "contracts_PopupProductStore_sol_PopupProductStore",
    signer,
    [usdcAddress, usdtAddress, await payoutDistributor.getAddress(), platformFeeRecipient],
  );

  const auctionManager = await deployContract(
    "PopupAuctionManager",
    "contracts_PopupAuctionManager_sol_PopupAuctionManager",
    signer,
    [],
  );

  const royaltyManager = await deployContract(
    "PopupRoyaltyManager",
    "contracts_PopupRoyaltyManager_sol_PopupRoyaltyManager",
    signer,
    [usdcAddress, usdtAddress, platformFeeRecipient],
  );

  const artistProfileMinter = await deployContract(
    "PopupArtistProfileMinter",
    "contracts_PopupArtistProfileMinter_sol_PopupArtistProfileMinter",
    signer,
    [platformFeeRecipient],
  );

  log.info("Linking contract permissions...");
  await (await productStore.setReferralManager(await referralManager.getAddress())).wait();
  await (await payoutDistributor.setReferralManager(await referralManager.getAddress())).wait();
  await (await payoutDistributor.authorizeCaller(await productStore.getAddress())).wait();
  await (await referralManager.authorizeCaller(await productStore.getAddress())).wait();
  await (await referralManager.authorizeCaller(await payoutDistributor.getAddress())).wait();

  await fs.mkdir(DEPLOYMENTS_DIR, { recursive: true });
  const outputPath = path.join(DEPLOYMENTS_DIR, `deployment-${networkName}-${Date.now()}.json`);
  await fs.writeFile(outputPath, JSON.stringify(deploymentLog, null, 2), "utf8");

  log.success(`Deployment manifest written to ${outputPath}`);
  log.success(`PopupReferralManager: ${await referralManager.getAddress()}`);
  log.success(`PopupPayoutDistributor: ${await payoutDistributor.getAddress()}`);
  log.success(`PopupProductStore: ${await productStore.getAddress()}`);
  log.success(`PopupAuctionManager: ${await auctionManager.getAddress()}`);
  log.success(`PopupRoyaltyManager: ${await royaltyManager.getAddress()}`);
  log.success(`PopupArtistProfileMinter: ${await artistProfileMinter.getAddress()}`);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
