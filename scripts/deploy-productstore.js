const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ProductStore to Base Sepolia...\n");

  try {
    // Get signer
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    if (balance === 0n) {
      console.error("❌ Account has no balance. Fund it from https://faucet.base.org/");
      process.exit(1);
    }

    // Compile contract
    console.log("📦 Compiling ProductStore.sol...");
    await hre.run("compile");

    // Get contract factory
    const ProductStore = await hre.ethers.getContractFactory("ProductStore");
    console.log("✅ Contract factory loaded\n");

    // Deploy
    console.log("⏳ Deploying contract (this may take a minute)...");
    const productStore = await ProductStore.deploy();
    await productStore.deploymentTransaction().wait(1);

    console.log("✅ Contract deployed!\n");
    console.log("📍 Contract Address:", productStore.target);
    console.log("🔗 Block Explorer: https://sepolia.basescan.org/address/" + productStore.target);

    // Save address to file
    const fs = require("fs");
    const addressFile = "deployed-productstore.json";
    fs.writeFileSync(
      addressFile,
      JSON.stringify(
        {
          network: "baseSepolia",
          address: productStore.target,
          deployer: deployer.address,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    console.log("\n📄 Address saved to:", addressFile);
    console.log("\n✨ Next steps:");
    console.log("1. Update src/lib/contracts/productStore.ts:");
    console.log(`   export const PRODUCT_STORE_ADDRESS = "${productStore.target}" as const;`);
    console.log("2. Run: npm run build");
    console.log("3. Deploy to production");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

main();
