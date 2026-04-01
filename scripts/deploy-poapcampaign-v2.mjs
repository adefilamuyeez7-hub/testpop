import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);

  console.log(`Deploying POAPCampaignV2 on ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${balance.toString()}`);

  const POAPCampaignV2 = await ethers.getContractFactory("POAPCampaignV2");
  const poapCampaignV2 = await POAPCampaignV2.deploy();
  await poapCampaignV2.waitForDeployment();

  const deployedAddress = await poapCampaignV2.getAddress();
  console.log(`POAPCampaignV2 deployed to: ${deployedAddress}`);

  const outputPath = path.resolve("deployed-addresses.json");
  let addresses = {};

  if (fs.existsSync(outputPath)) {
    addresses = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  }

  addresses.POAPCampaignV2 = deployedAddress;
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));

  console.log("Updated deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
