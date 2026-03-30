import hre from "hardhat";
import fs from "fs";

async function main() {
  const { ethers, network } = hre;

  console.log("\n=== DEPLOYMENT START ===\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}\n`);

  const deployments = {};

  // 🔹 1. ArtDrop - TOO LARGE, Deploy via Remix instead
  // See DEPLOYMENT_QUICK_START.md for Remix deployment instructions
  console.log("Note: ArtDrop too large for local deployment. Use Remix instead.\n");

  // 🔹 2. POAPCampaign
  console.log("Deploying POAPCampaign...");
  const POAPCampaign = await ethers.getContractFactory("POAPCampaign");
  const poapCampaign = await POAPCampaign.deploy();
  await poapCampaign.waitForDeployment();
  deployments.POAPCampaign = await poapCampaign.getAddress();
  console.log(`POAPCampaign: ${deployments.POAPCampaign}\n`);

  // 🔹 3. ProductStore
  console.log("Deploying ProductStore...");
  const ProductStore = await ethers.getContractFactory("ProductStore");
  const productStore = await ProductStore.deploy();
  await productStore.waitForDeployment();
  deployments.ProductStore = await productStore.getAddress();
  console.log(`ProductStore: ${deployments.ProductStore}\n`);

  // 📁 Save all deployments
  const deploymentDir = "./deployments";
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir);

  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    contracts: deployments,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    `${deploymentDir}/${network.name}_contracts.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("=== DEPLOYMENT COMPLETE ===\n");
  console.log(deployments);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});