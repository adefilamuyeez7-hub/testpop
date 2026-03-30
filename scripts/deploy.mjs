import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const ArtDrop = await ethers.getContractFactory("ArtDrop");
  const feeRecipient = deployer.address;
  const artDrop = await ArtDrop.deploy(feeRecipient);
  await artDrop.waitForDeployment();
  const artDropAddress = await artDrop.getAddress();

  console.log("ArtDrop deployed to:", artDropAddress);

  const POAPCampaign = await ethers.getContractFactory("POAPCampaign");
  const poapCampaign = await POAPCampaign.deploy();
  await poapCampaign.waitForDeployment();
  const poapCampaignAddress = await poapCampaign.getAddress();

  console.log("POAPCampaign deployed to:", poapCampaignAddress);

  const ProductStore = await ethers.getContractFactory("ProductStore");
  const productStore = await ProductStore.deploy();
  await productStore.waitForDeployment();
  const productStoreAddress = await productStore.getAddress();

  console.log("ProductStore deployed to:", productStoreAddress);

  const addresses = {
    ArtDrop: artDropAddress,
    POAPCampaign: poapCampaignAddress,
    ProductStore: productStoreAddress,
  };

  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
