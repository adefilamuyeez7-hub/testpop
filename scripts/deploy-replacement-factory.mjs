#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const solcImport = await import("solc");
const solc = solcImport.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "deployments", "factory_basesepolia_replacement.json");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

[
  path.join(ROOT, ".env.local"),
  path.join(ROOT, ".env"),
  path.join(ROOT, "server", ".env.local"),
  path.join(ROOT, "server", ".env"),
].forEach(loadEnvFile);

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY?.trim() ||
  process.env.PRIVATE_KEY?.trim();
const FOUNDER_WALLET = process.env.FOUNDER_WALLET?.trim();

function normalizePrivateKey(value = "") {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY or PRIVATE_KEY.");
  }

  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Private key must be 0x followed by 64 hex characters.");
  }

  return normalized;
}

function findImports(importPath) {
  const candidates = [
    path.join(ROOT, "contracts", importPath),
    path.join(ROOT, "node_modules", importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileContracts() {
  const sources = {
    "ArtDropFactory.sol": {
      content: fs.readFileSync(path.join(ROOT, "contracts", "ArtDropFactory.sol"), "utf8"),
    },
    "ArtDropArtist.sol": {
      content: fs.readFileSync(path.join(ROOT, "contracts", "ArtDropArtist.sol"), "utf8"),
    },
  };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];

  if (errors.length > 0) {
    throw new Error(`Solidity compilation failed:\n${errors.map((entry) => entry.formattedMessage).join("\n")}`);
  }

  const factory = output.contracts["ArtDropFactory.sol"]?.ArtDropFactory;
  const artist = output.contracts["ArtDropArtist.sol"]?.ArtDrop;

  if (!factory?.abi || !factory?.evm?.bytecode?.object) {
    throw new Error("Failed to compile ArtDropFactory.");
  }

  if (!artist?.evm?.bytecode?.object) {
    throw new Error("Failed to compile ArtDrop artist template.");
  }

  return {
    factoryAbi: factory.abi,
    factoryBytecode: `0x${factory.evm.bytecode.object}`,
    artistBytecode: `0x${artist.evm.bytecode.object}`,
  };
}

async function main() {
  const signer = new ethers.Wallet(normalizePrivateKey(PRIVATE_KEY), new ethers.JsonRpcProvider(RPC_URL));
  const founderWallet = ethers.getAddress(FOUNDER_WALLET || signer.address);

  console.log("Deploying replacement ArtDropFactory");
  console.log(`RPC:              ${RPC_URL}`);
  console.log(`Signer:           ${signer.address}`);
  console.log(`Founder wallet:   ${founderWallet}`);

  const balance = await signer.provider.getBalance(signer.address);
  console.log(`Balance:          ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Signer has no Base Sepolia ETH for deployment gas.");
  }

  const { factoryAbi, factoryBytecode, artistBytecode } = compileContracts();
  const factoryFactory = new ethers.ContractFactory(factoryAbi, factoryBytecode, signer);

  console.log("Sending factory deployment transaction...");
  const factory = await factoryFactory.deploy(founderWallet);
  const deployTx = factory.deploymentTransaction();
  console.log(`Deployment tx:    ${deployTx?.hash}`);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`Factory address:  ${factoryAddress}`);

  console.log("Setting artist template bytecode...");
  const setTx = await factory.setArtDropBytecode(artistBytecode);
  console.log(`Bytecode tx:      ${setTx.hash}`);
  await setTx.wait();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const payload = {
    network: "baseSepolia",
    chainId: 84532,
    deployer: signer.address,
    founderWallet,
    factory: {
      address: factoryAddress,
      deploymentTx: deployTx?.hash ?? null,
      bytecodeTx: setTx.hash,
    },
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  console.log(`Saved deployment metadata to ${OUTPUT_PATH}`);
  console.log("Replacement factory deployment complete.");
}

main().catch((error) => {
  console.error(`Replacement factory deployment failed: ${error.message}`);
  process.exit(1);
});
