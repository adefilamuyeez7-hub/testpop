#!/usr/bin/env node

import { ethers } from "ethers";

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const DEFAULT_FACTORY_ADDRESS = "0xFd58d0f5F0423201Edb756d0f44D667106fc5705";
const DEFAULT_NEW_OWNER = "0x3d9A4F8E9bE795c7e82Da4FEd21cDD0D5234513E";

const FACTORY_ABI = [
  "function owner() view returns (address)",
  "function founderWallet() view returns (address)",
  "function transferOwnership(address _newOwner)",
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
  const requestedNewOwner = ethers.getAddress(
    process.argv[2] || getEnv("NEW_FACTORY_OWNER", DEFAULT_NEW_OWNER)
  );
  const privateKey = requirePrivateKey();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

  console.log(`Network RPC:       ${rpcUrl}`);
  console.log(`Factory:           ${factoryAddress}`);
  console.log(`Requested owner:   ${requestedNewOwner}`);
  console.log(`Signer:            ${signer.address}`);

  const [currentOwner, founderWallet] = await Promise.all([
    factory.owner(),
    factory.founderWallet(),
  ]);

  const normalizedCurrentOwner = ethers.getAddress(currentOwner);
  const normalizedFounderWallet = ethers.getAddress(founderWallet);

  console.log(`Current owner:     ${normalizedCurrentOwner}`);
  console.log(`Founder wallet:    ${normalizedFounderWallet}`);

  if (ethers.getAddress(signer.address) !== normalizedCurrentOwner) {
    throw new Error(
      `Signer is not the current factory owner. Current owner is ${normalizedCurrentOwner}.`
    );
  }

  if (requestedNewOwner === normalizedCurrentOwner) {
    console.log("Factory owner already matches requested owner. Nothing to do.");
    return;
  }

  const tx = await factory.transferOwnership(requestedNewOwner);
  console.log(`Transfer tx:       ${tx.hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  const confirmedOwner = ethers.getAddress(await factory.owner());

  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log(`New owner:         ${confirmedOwner}`);

  if (confirmedOwner !== requestedNewOwner) {
    throw new Error(
      `Transfer transaction confirmed but owner is ${confirmedOwner}, expected ${requestedNewOwner}.`
    );
  }

  console.log("Factory ownership transfer complete.");
}

main().catch((error) => {
  console.error(`Ownership transfer failed: ${error.message}`);
  process.exit(1);
});
