require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

for (const envPath of [
  path.resolve(__dirname, ".env.local"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "server", ".env.local"),
  path.resolve(__dirname, "server", ".env"),
]) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath, override: false });
  }
}

function normalizePrivateKey(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

const privateKey = normalizePrivateKey(
  process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
);

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: privateKey ? [privateKey] : [],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: privateKey ? [privateKey] : [],
      chainId: 84532,
    },
  },
};
