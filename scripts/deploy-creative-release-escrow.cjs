const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeWallet(value) {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    return ethers.getAddress(value.trim());
  } catch {
    throw new Error(`Invalid wallet address: ${value}`);
  }
}

function resolveEscrowOwner(fallback) {
  const candidates = [
    process.env.CREATIVE_RELEASE_ESCROW_OWNER,
    process.env.ESCROW_OWNER_WALLET,
    process.env.VITE_ADMIN_WALLET,
    process.env.VITE_FOUNDER_WALLET,
    process.env.FOUNDER_WALLET,
    process.env.ADMIN_WALLETS?.split(",")[0],
    fallback,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeWallet(candidate || "");
    if (normalized && normalized !== ZERO_ADDRESS) {
      return normalized;
    }
  }

  throw new Error("Unable to resolve CreativeReleaseEscrow owner wallet");
}

async function main() {
  console.log("Starting CreativeReleaseEscrow deployment...\n");

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await deployer.provider.getBalance(deployer.address);
  const ownerWallet = resolveEscrowOwner(deployer.address);

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Escrow owner:   ${ownerWallet}`);
  console.log(`Balance:        ${ethers.formatEther(deployerBalance)} ETH`);

  const CreativeReleaseEscrow = await ethers.getContractFactory("CreativeReleaseEscrow");
  const escrow = await CreativeReleaseEscrow.deploy(ownerWallet);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  const onchainOwner = await escrow.owner();
  const blockNumber = await ethers.provider.getBlockNumber();

  const deploymentInfo = {
    contract: "CreativeReleaseEscrow",
    address: escrowAddress,
    owner: onchainOwner,
    deployer: deployer.address,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    timestamp: new Date().toISOString(),
    blockNumber,
  };

  const deploymentDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentDir, `${network.name}_CreativeReleaseEscrow.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  const addressesPath = path.join(process.cwd(), "deployed-addresses.json");
  const existingAddresses = fs.existsSync(addressesPath)
    ? JSON.parse(fs.readFileSync(addressesPath, "utf8"))
    : {};

  existingAddresses.CreativeReleaseEscrow = escrowAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(existingAddresses, null, 2));

  console.log(`\nCreativeReleaseEscrow deployed to: ${escrowAddress}`);
  console.log(`Owner verified as: ${onchainOwner}`);
  console.log(`Saved deployment metadata to deployments\\${network.name}_CreativeReleaseEscrow.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
