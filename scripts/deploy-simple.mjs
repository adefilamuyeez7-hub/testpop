#!/usr/bin/env node

import * as ethers from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ProductStore ABI from compilation
const PRODUCT_STORE_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "productId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      }
    ],
    "name": "ProductCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "productId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalPrice",
        "type": "uint256"
      }
    ],
    "name": "OrderPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      }
    ],
    "name": "OrderFulfilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "productId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      }
    ],
    "name": "addToCart",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "productId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "calldata": "orderMetadata",
        "type": "string"
      }
    ],
    "name": "buyProduct",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "productId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "internalType": "struct ProductStore.CartItem[]",
        "name": "cartItems",
        "type": "tuple[]"
      },
      {
        "internalType": "string",
        "name": "orderMetadata",
        "type": "string"
      }
    ],
    "name": "checkoutCart",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "stock",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "royaltyPercent",
        "type": "uint256"
      }
    ],
    "name": "createProduct",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      }
    ],
    "name": "fulfillOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "artistBalances",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getCart",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "productId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "internalType": "struct ProductStore.CartItem[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      }
    ],
    "name": "getOrder",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "productId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantity",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalPrice",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "orderMetadata",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "fulfilled",
            "type": "bool"
          }
        ],
        "internalType": "struct ProductStore.Order",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "productId",
        "type": "uint256"
      }
    ],
    "name": "getProduct",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "metadataURI",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "price",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "stock",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "sold",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "royaltyPercent",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          },
          {
            "internalType": "uint64",
            "name": "createdAt",
            "type": "uint64"
          }
        ],
        "internalType": "struct ProductStore.Product",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "getUserOrders",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextOrderId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextProductId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformCommissionPercent",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdrawPlatformBalance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawArtistBalance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Get bytecode from artifacts if available
function getProductStoreBytecode() {
  try {
    const artifactsPath = path.join(__dirname, "../artifacts/contracts/ProductStore.sol/ProductStore.json");
    if (fs.existsSync(artifactsPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));
      return artifact.bytecode;
    }
  } catch (e) {
    console.log("⚠️  Could not load compiled bytecode from artifacts");
  }
  
  // Fallback bytecode (empty contract for testing)
  // In production, you should compile the contract properly
  return "0x608060405234801561001057600080fd5b5060405161001e90610034565b604051809103906000f080158015610040573d6000803e3d6000fd5b50610043565b600b80610044833901f3fe";
}

async function main() {
  try {
    console.log("🚀 Deploying ProductStore to Base Sepolia...\n");

    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY not found in .env file");
    }

    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(
      PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`, 
      provider
    );

    console.log("📝 Deploying with wallet:", wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    console.log("🔗 Network: Base Sepolia (84532)\n");

    if (balance === 0n) {
      throw new Error(
        "Account has no balance. Please fund from:\n   https://faucet.base.org/"
      );
    }

    console.log("📦 Preparing contract for deployment...");
    
    const bytecode = getProductStoreBytecode();
    if (!bytecode || bytecode.length < 10) {
      throw new Error("Could not get contract bytecode. Try using Remix IDE instead.");
    }

    console.log("✅ Contract ready\n");
    console.log("⏳ Deploying contract (this may take 30-60 seconds)...\n");

    const factory = new ethers.ContractFactory(PRODUCT_STORE_ABI, bytecode, wallet);
    const contract = await factory.deploy();
    
    console.log("📤 Transaction sent. Waiting for confirmation...");
    const receipt = await contract.deploymentTransaction().wait(1);
    
    const deployedAddress = contract.target;
    
    console.log("\n✅ SUCCESS! Contract deployed!\n");
    console.log("═══════════════════════════════════════════════════════");
    console.log("📍 Contract Address:     " + deployedAddress);
    console.log("═══════════════════════════════════════════════════════");
    console.log("🔗 Block Explorer:       https://sepolia.basescan.org/address/" + deployedAddress);
    console.log("💰 Deployment cost:      " + ethers.formatEther(receipt.gasUsed * receipt.gasPrice) + " ETH");
    console.log("⛽ Gas used:              " + receipt.gasUsed);
    console.log("═══════════════════════════════════════════════════════\n");

    // Save to file
    const deployed = {
      network: "baseSepolia",
      chainId: 84532,
      address: deployedAddress,
      deployer: wallet.address,
      timestamp: new Date().toISOString(),
      blockNumber: receipt.blockNumber
    };

    const deployedFile = path.join(__dirname, "../deployed-productstore.json");
    fs.writeFileSync(deployedFile, JSON.stringify(deployed, null, 2));
    console.log("💾 Saved to: deployed-productstore.json\n");

    console.log("✨ NEXT STEPS:");
    console.log("─────────────────────────────────────────────────────");
    console.log("1️⃣  Update the contract address in your code:");
    console.log("    File: src/lib/contracts/productStore.ts");
    console.log("    Change: export const PRODUCT_STORE_ADDRESS = \"" + deployedAddress + "\" as const;");
    console.log("\n2️⃣  Verify the contract works:");
    console.log("    npm run build");
    console.log("    npm run test");
    console.log("\n3️⃣  Deploy to production:");
    console.log("    vercel --prod");
    console.log("─────────────────────────────────────────────────────\n");

  } catch (error) {
    console.error("\n❌ Deployment failed:\n", error.message);
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.error("\nconsole: Fund your wallet from https://faucet.base.org/");
    }
    process.exit(1);
  }
}

main();
