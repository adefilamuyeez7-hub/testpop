const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Starting ProductStore deployment to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();

  console.log(`📍 Deploying from: ${deployer.address}`);
  console.log(`💰 Account balance: ${(await deployer.provider.getBalance(deployer.address)).toString()} wei`);

  const ProductStore = await ethers.getContractFactory("ProductStore");
  console.log("\n⏳ Deploying ProductStore contract...");
  const productStore = await ProductStore.deploy();
  await productStore.waitForDeployment();
  const productStoreAddress = await productStore.getAddress();

  console.log(`✅ ProductStore deployed to: ${productStoreAddress}`);

  // Get current network info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();

  const deploymentInfo = {
    contract: "ProductStore",
    address: productStoreAddress,
    deployer: deployer.address,
    network: "baseSepolia",
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    blockNumber: blockNumber,
  };

  console.log("\n📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const deploymentDir = "./deployments";
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }
  fs.writeFileSync(
    `${deploymentDir}/baseSepolia_ProductStore.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Also save to addresses file for easy access
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify({ ProductStore: productStoreAddress }, null, 2)
  );

  console.log(
    `\n✨ Deployment info saved to: ${deploymentDir}/baseSepolia_ProductStore.json`
  );

  // Verify contract is callable
  console.log("\n🔍 Verifying contract...");
  const owner = await productStore.owner();
  const nextProductId = await productStore.nextProductId();
  console.log(`✅ Owner: ${owner}`);
  console.log(`✅ Next Product ID: ${nextProductId}`);

  console.log("\n🎉 Deployment complete!");
  console.log(`\n📖 Contract Address: ${productStoreAddress}`);
  console.log(`🔗 Verify on BaseScan: https://sepolia.basescan.org/address/${productStoreAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
