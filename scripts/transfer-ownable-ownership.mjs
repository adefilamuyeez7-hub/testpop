#!/usr/bin/env node

import { ethers } from "ethers";

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const DEFAULT_NEW_OWNER = "0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C";

const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
];

function getEnv(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

function requirePrivateKey() {
  const raw =
    getEnv("CONTRACT_OWNER_PRIVATE_KEY") ||
    getEnv("PRIVATE_KEY") ||
    getEnv("DEPLOYER_PRIVATE_KEY");

  if (!raw) {
    throw new Error(
      "Missing contract owner private key. Set CONTRACT_OWNER_PRIVATE_KEY to the current owner's key."
    );
  }

  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Private key must be 0x followed by 64 hex characters.");
  }

  return normalized;
}

async function main() {
  const contractAddressArg = process.argv[2];
  if (!contractAddressArg) {
    throw new Error("Usage: node scripts/transfer-ownable-ownership.mjs <contractAddress> [newOwner]");
  }

  const rpcUrl = getEnv("BASE_SEPOLIA_RPC_URL", DEFAULT_RPC_URL);
  const contractAddress = ethers.getAddress(contractAddressArg);
  const requestedOwner = ethers.getAddress(process.argv[3] || getEnv("NEW_CONTRACT_OWNER", DEFAULT_NEW_OWNER));
  const privateKey = requirePrivateKey();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, OWNABLE_ABI, signer);

  const currentOwner = ethers.getAddress(await contract.owner());

  console.log(`Contract:          ${contractAddress}`);
  console.log(`Signer:            ${signer.address}`);
  console.log(`Current owner:     ${currentOwner}`);
  console.log(`Requested owner:   ${requestedOwner}`);

  if (ethers.getAddress(signer.address) !== currentOwner) {
    throw new Error("Signer is not the current contract owner.");
  }

  if (currentOwner === requestedOwner) {
    console.log("Contract owner already matches requested address. Nothing to do.");
    return;
  }

  const tx = await contract.transferOwnership(requestedOwner);
  console.log(`Transfer tx:       ${tx.hash}`);
  const receipt = await tx.wait();
  const confirmedOwner = ethers.getAddress(await contract.owner());

  console.log(`Confirmed block:   ${receipt.blockNumber}`);
  console.log(`New owner:         ${confirmedOwner}`);

  if (confirmedOwner !== requestedOwner) {
    throw new Error(
      `Ownership transfer confirmed but contract reports ${confirmedOwner}.`
    );
  }
}

main().catch((error) => {
  console.error(`Ownership transfer failed: ${error.message}`);
  process.exit(1);
});
