#!/usr/bin/env node

import { ethers } from "ethers";

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const DEFAULT_FACTORY_ADDRESS = "0x2d044a0AFAbE0C07Ee12b8f4c18691b82fb6cF01";
const DEFAULT_NEW_FOUNDER = "0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C";

const FACTORY_ABI = [
  "function owner() view returns (address)",
  "function founderWallet() view returns (address)",
  "function updateFounderWallet(address _newFounder)",
];

function getEnv(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

function requirePrivateKey() {
  const raw =
    getEnv("FACTORY_OWNER_PRIVATE_KEY") ||
    getEnv("PRIVATE_KEY") ||
    getEnv("DEPLOYER_PRIVATE_KEY");

  if (!raw) {
    throw new Error(
      "Missing factory owner private key. Set FACTORY_OWNER_PRIVATE_KEY to the current factory owner's key."
    );
  }

  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Private key must be 0x followed by 64 hex characters.");
  }

  return normalized;
}

async function main() {
  const rpcUrl = getEnv("BASE_SEPOLIA_RPC_URL", DEFAULT_RPC_URL);
  const factoryAddress = ethers.getAddress(
    getEnv("ART_DROP_FACTORY_ADDRESS", DEFAULT_FACTORY_ADDRESS)
  );
  const requestedFounder = ethers.getAddress(
    process.argv[2] ||
      getEnv("NEW_FOUNDER_WALLET") ||
      getEnv("FOUNDER_WALLET") ||
      getEnv("VITE_FOUNDER_WALLET") ||
      getEnv("VITE_ADMIN_WALLET", DEFAULT_NEW_FOUNDER)
  );
  const privateKey = requirePrivateKey();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

  const [currentOwner, currentFounder] = await Promise.all([
    factory.owner(),
    factory.founderWallet(),
  ]);

  console.log(`Factory:           ${factoryAddress}`);
  console.log(`Signer:            ${signer.address}`);
  console.log(`Current owner:     ${ethers.getAddress(currentOwner)}`);
  console.log(`Current founder:   ${ethers.getAddress(currentFounder)}`);
  console.log(`Requested founder: ${requestedFounder}`);

  if (ethers.getAddress(signer.address) !== ethers.getAddress(currentOwner)) {
    throw new Error("Signer is not the current factory owner.");
  }

  if (ethers.getAddress(currentFounder) === requestedFounder) {
    console.log("Founder wallet already matches requested address. Nothing to do.");
    return;
  }

  const tx = await factory.updateFounderWallet(requestedFounder);
  console.log(`Update tx:         ${tx.hash}`);
  const receipt = await tx.wait();
  const confirmedFounder = ethers.getAddress(await factory.founderWallet());

  console.log(`Confirmed block:   ${receipt.blockNumber}`);
  console.log(`New founder:       ${confirmedFounder}`);

  if (confirmedFounder !== requestedFounder) {
    throw new Error(
      `Founder wallet update confirmed but contract reports ${confirmedFounder}.`
    );
  }
}

main().catch((error) => {
  console.error(`Founder wallet update failed: ${error.message}`);
  process.exit(1);
});
