const fs = require("fs");
const path = require("path");

// Import ethers directly
const ethers = require("ethers");
require("dotenv").config();

async function main() {
  console.log("🚀 Starting ProductStore deployment to Base Sepolia...\n");

  // Setup provider and signer
  const RPC_URL = "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable not set");
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📍 Deployer address: ${wallet.address}`);

  // Read compiled artifacts (should already exist from npm run build)
  const artifactPath = path.join(__dirname, "../artifacts/contracts/ProductStore.sol/ProductStore.json");
  if (!fs.existsSync(artifactPath)) {
    console.log("⏳ Compiling contracts...");
    try {
      execSync("npx hardhat compile", { stdio: "inherit", cwd: path.join(__dirname, "..") });
    } catch (e) {
      console.error("Compilation failed:", e.message);
      throw e;
    }
  } else {
    console.log("📦 Using pre-compiled artifacts...");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log(`\n💼 Deploying ProductStore...`);

  // Create contract factory
  const ContractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Deploy
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`✅ ProductStore deployed to: ${address}`);

  // Get block details
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  const deploymentInfo = {
    contract: "ProductStore",
    address: address,
    deployer: wallet.address,
    network: "baseSepolia",
    chainId: 84532,
    rpcUrl: RPC_URL,
    timestamp: new Date().toISOString(),
    blockNumber: blockNumber,
    blockHash: block?.hash || "",
  };

  console.log("\n📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentDir, "baseSepolia_ProductStore.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Also save to addresses file
  fs.writeFileSync(
    path.join(__dirname, "../deployed-addresses.json"),
    JSON.stringify({ ProductStore: address }, null, 2)
  );

  console.log(`\n✨ Deployment info saved to deployments/baseSepolia_ProductStore.json`);

  // Verify contract
  console.log("\n🔍 Verifying contract...");
  const owner = await contract.owner();
  const nextProductId = await contract.nextProductId();
  console.log(`✅ Owner: ${owner}`);
  console.log(`✅ Next Product ID: ${nextProductId.toString()}`);

  console.log("\n🎉 Deployment complete!");
  console.log(`\n📖 Contract Address: ${address}`);
  console.log(`🔗 Verify on BaseScan: https://sepolia.basescan.org/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
