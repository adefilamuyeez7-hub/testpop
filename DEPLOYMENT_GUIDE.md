# ProductStore Deployment Guide - Base Sepolia Testnet

## 📋 Prerequisites

1. **Hardhat & Dependencies**: Already installed in this project
2. **Test ETH on Base Sepolia**: Get from [Base Sepolia Faucet](https://www.basescan.org/address/0x4200000000000000000000000000000000000006#code)
3. **Private Key**: Your wallet's private key (test wallet recommended)

## 🔧 Setup

### Step 1: Create Environment File

Create a `.env` file in the project root:

```bash
PRIVATE_KEY=your_private_key_here_without_0x_prefix
```

⚠️ **SECURITY WARNING**: 
- Never commit this file to version control
- Use a test wallet with minimal funds for development
- Never share your private key

### Step 2: Get Test ETH

1. Go to [Base Sepolia Faucet](https://www.basescan.org/address/0x4200000000000000000000000000000000000006#code)
2. Request test ETH to your wallet address

## 🚀 Deployment

Run the deployment script:

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Expected Output:
```
🚀 Starting ProductStore deployment to Base Sepolia...

📍 Deploying from: 0x... (your address)
⏳ Deploying ProductStore contract...

✅ ProductStore deployed to: 0x... (contract address)
📝 Network: baseSepolia
👤 Owner: 0x... (your address)

🔍 Verifying contract...
✅ Owner: 0x...
✅ Next Product ID: 1

🎉 Deployment complete!
```

## 📝 Verify Deployment

After deployment:

1. **Check on Block Explorer**: 
   - Go to [BaseScan Sepolia](https://sepolia.basescan.org/)
   - Search for your contract address

2. **View Deployment Info**:
   - File saved to: `deployments/baseSepolia_ProductStore.json`
   - Contains: contract address, deployer, block number

## 🔗 Frontend Integration

1. Use the contract address from deployment output
2. Update [src/lib/contracts/productStore.ts](../src/lib/contracts/productStore.ts) with:
   ```typescript
   export const PRODUCT_STORE_ADDRESS = "0x..."; // Your deployed address
   export const PRODUCT_STORE_CHAIN_ID = 84532; // Base Sepolia chain ID
   ```

3. Ensure wagmi config includes Base Sepolia network

## 🧪 Contract Features

The deployed ProductStore contract includes:

- ✅ Create products with metadata & royalties
- ✅ Shopping cart functionality
- ✅ Purchase orders with fulfillment tracking
- ✅ Artist royalty payments
- ✅ Platform commission (5% default)
- ✅ Re-entrancy protection

## 📊 Base Sepolia Network Info

- **ChainID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org
- **Currency**: ETH (test)

## ⚠️ Important Notes

- This is a **testnet deployment** - for testing only
- The contract is **not verified** on block explorer yet
- For production, use **Base Mainnet** (change network to `base`)
- **Owner privileges**: As deployer, you can:
  - Update platform commission
  - Withdraw platform balance
  - Transfer ownership

## 🐛 Troubleshooting

### Error: "insufficient funds"
→ Get more test ETH from the faucet

### Error: "invalid private key"
→ Remove '0x' prefix from your private key

### Error: "gas estimation failed"
→ Check gas limits and try deploying to a public testnet

## 📞 Next Steps

1. Deploy ProductStore contract ✅
2. Verify contract on BaseScan (paid service)
3. Integrate with frontend
4. Test product creation & purchases
5. Deploy other contracts (ArtDrop, POAPCampaign)
