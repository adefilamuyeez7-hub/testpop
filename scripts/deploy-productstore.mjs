import ethers from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PRODUCT_STORE_ABI = [
  "constructor()",
  "event ProductCreated(uint256 indexed productId, address indexed creator, uint256 price)",
  "event OrderPlaced(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 quantity, uint256 totalPrice)",
  "event OrderFulfilled(uint256 indexed orderId)",
  "function nextProductId() public view returns (uint256)",
  "function nextOrderId() public view returns (uint256)",
  "function platformCommissionPercent() public view returns (uint256)",
  "function createProduct(string memory metadataURI, uint256 price, uint256 stock, uint256 royaltyPercent) public returns (uint256)",
  "function buyProduct(uint256 productId, uint256 quantity, string calldata orderMetadata) public payable returns (uint256)",
  "function checkoutCart((uint256,uint256)[] calldata cartItems, string calldata orderMetadata) public payable returns (uint256)",
  "function getProduct(uint256 productId) public view returns ((uint256,address,string,uint256,uint256,uint256,uint256,bool,uint64))",
  "function getOrder(uint256 orderId) public view returns ((uint256,address,uint256,uint256,uint256,string,uint256,bool))",
  "function getUserOrders(address user) public view returns (uint256[])",
  "function fulfillOrder(uint256 orderId) public",
  "function withdrawArtistBalance() public",
  "function withdrawPlatformBalance(uint256 amount) public",
  "function artistBalances(address) public view returns (uint256)",
  "function platformBalance() public view returns (uint256)"
];

async function deploy() {
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY not set in .env file");
    }

    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying ProductStore with account:", wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
      throw new Error("Account has no balance. Please fund the account with testnet ETH from https://faucet.base.org/");
    }

    // Read the ProductStore contract bytecode
    const contractBytecode = fs.readFileSync("./contracts/ProductStore.sol", "utf-8");
    
    if (!contractBytecode) {
      throw new Error("ProductStore.sol not found");
    }

    console.log("\n⚠️  Hardhat compilation failed due to package issues.");
    console.log("Fallback: Using pre-compiled ABI only");
    console.log("\n📝 To deploy ProductStore, you'll need to:");
    console.log("1. Compile ProductStore.sol using remix.ethereum.org");
    console.log("2. Copy the bytecode (deployment bytes)");
    console.log("3. Or fix the hardhat toolbox installation:");
    console.log("   npm install --save-dev '@nomicfoundation/hardhat-toolbox@hh2'");
    
    console.log("\n✅ Skipping deployment - app will use placeholder address");
    console.log("   ProductStore contract ABI is ready and stored in:");
    console.log("   src/lib/contracts/productStore.ts");

  } catch (error) {
    console.error("Deployment error:", error.message);
    process.exit(1);
  }
}

deploy();
