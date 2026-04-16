# POPUP Smart Contracts - Deployment Guide
**Date:** April 15, 2026  
**Status:** READY FOR DEPLOYMENT  
**Version:** 1.0 Production Ready

---

## 📋 Quick Start Checklist

Before deploying, ensure you have:

- [ ] Node.js 18+ installed
- [ ] Hardhat installed globally
- [ ] Smart contracts compiled without errors
- [ ] `.env` file configured with proper RPC URLs
- [ ] Private key with sufficient balance
- [ ] Etherscan API key (for verification)
- [ ] A clear understanding of your deployment network

---

## 🚀 Deployment Steps

### Step 1: Prerequisites & Setup

#### 1.1 Install Dependencies
```bash
# Install Hardhat and plugins
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install --save-dev @openzeppelin/hardhat-upgrades
npm install --save-dev hardhat-gas-reporter
npm install --save-dev dotenv

# Install ethers and other runtime dependencies
npm install ethers
```

#### 1.2 Configure Environment Variables
```bash
# Copy example and fill in your values
cp .env.example .env

# Edit .env with your configuration
# Required fields:
#   - SEPOLIA_RPC_URL or MAINNET_RPC_URL
#   - PRIVATE_KEY (deployer account)
#   - ETHERSCAN_API_KEY (for verification)
```

#### 1.3 Compile Contracts
```bash
# Compile Solidity contracts
npx hardhat compile

# Expected output:
# ✓ Compiled successfully
# 4 contracts compiled
```

---

### Step 2: Test Deployment on Local Network

#### 2.1 Start Local Hardhat Network
```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Output will show:
# Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
# Account #0: 0x... (with 1000 ETH)
```

#### 2.2 Deploy to Hardhat Network
```bash
# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network hardhat

# Expected output:
# ✅ PopupProductStore deployed at 0x...
# ✅ PopupAuctionManager deployed at 0x...
# ✅ PopupPayoutDistributor deployed at 0x...
# ✅ PopupRoyaltyManager deployed at 0x...
```

#### 2.3 Verify Local Deployment
```bash
# Run tests to verify functionality
npx hardhat test

# Expected: All tests pass with no errors
```

---

### Step 3: Deploy to Sepolia Testnet

#### 3.1 Get Test ETH
```bash
# Fund your deployer wallet with Sepolia ETH:
# 1. Visit: https://sepoliafaucet.com
# 2. Enter your deployer address from PRIVATE_KEY
# 3. Wait 1-2 minutes for confirmation
# 4. Check balance:
npx hardhat run scripts/setup-testnet.js --network sepolia
```

#### 3.2 Deploy to Sepolia
```bash
# Deploy contracts to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Expected output:
# 🚀 POPUP Smart Contract Deployment
# Network: sepolia (Chain ID: 11155111)
# ✅ PopupProductStore deployed at 0x...
# ✅ PopupAuctionManager deployed at 0x...
# ✅ PopupPayoutDistributor deployed at 0x...
# ✅ PopupRoyaltyManager deployed at 0x...
```

#### 3.3 Verify Contracts on Etherscan
```bash
# Verify each contract on Etherscan
npx hardhat run scripts/verify.js --network sepolia

# Or manually verify:
npx hardhat verify --network sepolia 0xCONTRACT_ADDRESS

# Once verified, contract source code will be visible on Etherscan
# Link: https://sepolia.etherscan.io/address/0xCONTRACT_ADDRESS
```

#### 3.4 Update Frontend Configuration
```bash
# Edit .env.example with Sepolia contract addresses:
VITE_PRODUCT_STORE_ADDRESS=0x...
VITE_AUCTION_MANAGER_ADDRESS=0x...
VITE_PAYOUT_DISTRIBUTOR_ADDRESS=0x...
VITE_ROYALTY_MANAGER_ADDRESS=0x...

# Copy to .env
cp .env.example .env
```

---

### Step 4: Comprehensive Testing on Testnet

#### 4.1 Test Basic Operations
```bash
# Create a test product
curl -X POST http://localhost:3001/api/products/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test NFT",
    "supply": 10,
    "price": "0.1",
    "royaltyBps": 500,
    "metadataUri": "ipfs://QmTest..."
  }'

# Expected: Returns productId and transaction hash
```

#### 4.2 Test Purchase Flow
```bash
# Purchase the product
curl -X POST http://localhost:3001/api/products/1/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1,
    "paymentMethod": "ETH"
  }'

# Expected: Returns NFT token ID and transaction hash
```

#### 4.3 Test Auction Flow
```bash
# Create an auction
curl -X POST http://localhost:3001/api/products/1/auctions/create \
  -H "Content-Type: application/json" \
  -d '{
    "startPrice": "1",
    "duration": 86400,
    "minBidIncrement": "0.1"
  }'

# Expected: Returns auctionId
```

#### 4.4 Monitor Transactions
```bash
# View transactions on Sepolia Etherscan:
# https://sepolia.etherscan.io/tx/0xTRANSACTION_HASH

# View contract on Etherscan:
# https://sepolia.etherscan.io/address/0xCONTRACT_ADDRESS

# Verify contract state, events, and holder information
```

---

### Step 5: Prepare for Mainnet Deployment

#### 5.1 Security Audit Review
```bash
# Conduct security audit (2-4 weeks)
# Recommended: OpenZeppelin, Trail of Bits, or Certora

# Expected output:
# ✅ No critical issues found
# ✅ Gas optimizations verified
# ✅ Best practices confirmed
```

#### 5.2 Setup Multi-Signature Wallet
```bash
# Create multi-signature wallet for admin functions
# Recommended: Gnosis Safe (https://app.safe.global)

# Configure with 2-3 signers:
# - Team member 1
# - Team member 2
# - (Optional) Legal/Governance member

# Update .env:
MULTISIG_ADDRESS=0x...
MULTISIG_THRESHOLD=2
```

#### 5.3 Prepare Mainnet Credentials
```bash
# Ensure you have:
# - Mainnet RPC URL (Alchemy, Infura, etc)
# - Deployer wallet with sufficient ETH
# - Etherscan API key configured

# Update .env with mainnet values:
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
PRIVATE_KEY=0x... (mainnet deployer)
```

#### 5.4 Verify Contract Compilation
```bash
# Ensure contracts compile with no warnings
npx hardhat compile --force

# Check gas estimates for mainnet
npx hardhat run scripts/deploy.js --dry-run --network mainnet
```

---

### Step 6: Deploy to Mainnet

#### 6.1 Execute Mainnet Deployment
```bash
# ⚠️ CRITICAL: This step is irreversible and will cost ETH

# Deploy with extra caution:
npx hardhat run scripts/deploy.js --network mainnet

# Expected output:
# 🚀 POPUP Smart Contract Deployment
# Network: mainnet (Chain ID: 1)
# Deployer: 0x...
# ✅ PopupProductStore deployed at 0x...
# ✅ PopupAuctionManager deployed at 0x...
# ✅ PopupPayoutDistributor deployed at 0x...
# ✅ PopupRoyaltyManager deployed at 0x...
```

#### 6.2 Verify Mainnet Contracts
```bash
# Verify on Etherscan mainnet (may take 10-30 minutes)
npx hardhat run scripts/verify.js --network mainnet

# Mainnet Etherscan:
# https://etherscan.io/address/0xCONTRACT_ADDRESS
```

#### 6.3 Update Production Configuration
```bash
# Update all production environment variables:
MAINNET_PRODUCT_STORE_ADDRESS=0x...
MAINNET_AUCTION_MANAGER_ADDRESS=0x...
MAINNET_PAYOUT_DISTRIBUTOR_ADDRESS=0x...
MAINNET_ROYALTY_MANAGER_ADDRESS=0x...

# Update frontend .env:
VITE_PRODUCT_STORE_ADDRESS=0x...
VITE_CHAIN_ID=1
VITE_NETWORK_NAME=mainnet
```

---

### Step 7: Post-Deployment Verification

#### 7.1 Contract Verification Checklist
```bash
# ✓ Contracts appear on Etherscan
# ✓ Source code is verified and readable
# ✓ Constructor arguments match
# ✓ Contract creation transaction confirmed
# ✓ All events logged correctly
```

#### 7.2 Functional Testing
```bash
# Test core functions on mainnet:
# 1. Create product via backend API
# 2. Purchase product (test with small amount)
# 3. Create auction
# 4. Place bid
# 5. Create gift
# 6. Claim payout
# 7. Record royalty
```

#### 7.3 Monitor Initial Activity
```bash
# Set up alerts for:
# - Failed transactions
# - Unusual gas prices
# - Contract state changes
# - Error events

# Use: Alchemy Dashboard, Tenderly, or Etherscan Notifications
```

---

## 🔧 Troubleshooting

### Issue: "Insufficient balance for deployment"
```bash
# Solution: Fund deployer wallet with ETH
# Check balance:
npx hardhat run scripts/setup-testnet.js --network sepolia

# For mainnet, send ETH to your deployer address
```

### Issue: "Contract verification failed"
```bash
# Solution: Ensure correct constructor arguments
# Retry after 30 seconds delay

npx hardhat verify --network sepolia 0xADDRESS \
  --constructor-args scripts/args.js

# If still fails, verify on Etherscan website manually
```

### Issue: "RPC request failed"
```bash
# Solution: Check RPC URL and API keys
# Verify:
# - SEPOLIA_RPC_URL or MAINNET_RPC_URL is correct
# - API key is valid and has sufficient quota
# - Network is currently stable

# Test RPC connection:
curl -X POST YOUR_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

### Issue: "Transaction reverted"
```bash
# Solution: Check transaction details
# View on Etherscan: https://etherscan.io/tx/0xTX_HASH

# Common causes:
# - Insufficient gas
# - Insufficient balance
# - Contract error
# - Invalid parameters
```

---

## 📊 Deployment Checklist

### Pre-Deployment
- [ ] All dependencies installed
- [ ] `.env` file configured with correct values
- [ ] Contracts compile without errors
- [ ] Private key has sufficient balance
- [ ] Etherscan API key configured
- [ ] Team reviewed deployment plan
- [ ] Backup of private key secured

### Local Testing
- [ ] Deploy to hardhat network successfully
- [ ] All tests pass (100% coverage)
- [ ] Gas estimates reasonable
- [ ] Contract interactions verified

### Testnet Deployment
- [ ] Deployer wallet funded with test ETH
- [ ] Deploy to Sepolia successful
- [ ] Contracts verified on Etherscan
- [ ] Frontend updated with contract addresses
- [ ] All core functions tested
- [ ] Integration tests pass
- [ ] Frontend and backend communicate correctly

### Pre-Mainnet
- [ ] Security audit complete with no critical issues
- [ ] Multi-signature wallet set up and tested
- [ ] Mainnet credentials verified
- [ ] Dry-run deployment successful
- [ ] Team sign-off obtained
- [ ] Deployment window scheduled
- [ ] Rollback plan documented

### Mainnet Deployment
- [ ] Execute deployment
- [ ] Verify contracts on Etherscan
- [ ] Update production environment variables
- [ ] Deploy updated frontend
- [ ] Monitor for errors
- [ ] Test production functions

### Post-Deployment
- [ ] Creator onboarding materials prepared
- [ ] Support team trained
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Announce to users
- [ ] Monitor performance 24/7

---

## 🎯 Success Criteria

After deployment, verify:

| Item | Testnet | Mainnet |
|------|---------|---------|
| Contracts deployed | ✅ | ✅ |
| Source code verified | ✅ | ✅ |
| Basic functions work | ✅ | ✅ |
| Purchase flow succeeds | ✅ | ✅ |
| Auction system works | ✅ | ✅ |
| Payouts distribute | ✅ | ✅ |
| Royalties record | ✅ | ✅ |
| Frontend integrates | ✅ | ✅ |
| No critical errors | ✅ | ✅ |
| Monitoring active | ✅ | ✅ |

---

## 📝 Deployment Record

### Sepolia Testnet
```
Deployment Date: ___________
Deployer: ___________
Network: 11155111 (Sepolia)

Contract Addresses:
  ProductStore: ___________
  AuctionManager: ___________
  PayoutDistributor: ___________
  RoyaltyManager: ___________

Verified on Etherscan: □

Block Number: ___________
Transaction Hash: ___________
Total Gas Used: ___________
```

### Mainnet
```
Deployment Date: ___________
Deployer: ___________
Network: 1 (Ethereum Mainnet)

Contract Addresses:
  ProductStore: ___________
  AuctionManager: ___________
  PayoutDistributor: ___________
  RoyaltyManager: ___________

Verified on Etherscan: □

Block Number: ___________
Transaction Hash: ___________
Total Gas Used: ___________
Total Cost (ETH): ___________
```

---

## 🚨 Emergency Procedures

### If Deployment Fails
1. Don't retry immediately
2. Review error message
3. Check RPC connection
4. Check account balance
5. Wait 30 seconds and retry
6. If still failing, check contract compilation

### If Contract Verification Fails
1. Wait 30 seconds for Etherscan indexing
2. Try verification again
3. Ensure constructor args match
4. Verify on Etherscan website manually

### If Contract Has Issues
1. Don't accept user funds
2. Pause contract immediately
3. Investigate in staging
4. Plan fix and redeploy if needed

---

## 📞 Support

For deployment issues:
1. Check troubleshooting section above
2. Review Hardhat documentation: https://hardhat.org
3. Check Etherscan: https://etherscan.io
4. Contact DevOps team

---

**Deployment Guide Created:** April 15, 2026  
**Version:** 1.0 Production Ready  
**Status:** READY FOR DEPLOYMENT

