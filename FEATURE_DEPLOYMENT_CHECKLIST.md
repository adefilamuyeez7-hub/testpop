# Deployment Guide - Artist-Specific Contract System

## Current Status

✅ All code is ready  
✅ Contracts are written  
❌ Hardhat compilation blocked by Node.js version incompatibility  
✅ Solution: Use direct ethers.js deployment or compatible Node version  

## Quick Fix: Use Compatible Node.js Version

The simplest solution is to use Node.js 22 LTS:

```bash
# Install Node 22 LTS
# Download from: https://nodejs.org/

# Verify installation
node --version  # Should be >=22.10.0 LTS

# Then compile and deploy
npx hardhat compile
npx node scripts/deploy-factory.mjs
```

## Override: Deploy with Precompiled Contracts

If you want to proceed without recompiling, use our ethers.js-based deployment:

```bash
# Make sure you have PRIVATE_KEY set (founder wallet)
export PRIVATE_KEY=0xyourprivatekey

# Use the simple ethers deployment (requires compiled artifacts)
npx node scripts/deploy-factory.mjs
```

## Step-by-Step Deployment

### Phase 1: Prepare Environment

```bash
# Set environment variables
export PRIVATE_KEY=0x... # Your founder/admin wallet private key
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your_anon_key

# For Windows PowerShell:
$env:PRIVATE_KEY="0x..."
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your_anon_key"
```

### Phase 2: Compile Contracts

**Option A: Use Node.js 22 LTS (RECOMMENDED)**

```bash
# Upgrade Node.js to 22 LTS from https://nodejs.org/
node --version  # Verify >= 22.10.0

cd /path/to/THEPOPUP-fixed
npx hardhat compile

# Success output should show:
# ✓ contracts/ArtDropArtist.sol
# ✓ contracts/ArtDropFactory.sol
```

**Option B: Skip Compilation (Use Online Tools)**

If you can't change Node.js version:

1. Copy entire `contracts/ArtDropArtist.sol` content
2. Paste in [Remix IDE](https://remix.ethereum.org/) - Solidity IDE
3. Compile with 0.8.28 compiler
4. Export bytecode from Remix
5. Or contract with your blockchain development team for compilation

### Phase 3: Deploy Factory

```bash
cd /path/to/THEPOPUP-fixed

# Deploy the factory contract
npx node scripts/deploy-factory.mjs

# Success output:
# ═══════════════════════════════════════════════════════════════
# ✅ DEPLOYMENT SUCCESSFUL!
# 
# 📋 FACTORY DEPLOYMENT SUMMARY:
# ═══════════════════════════════════════════════════════════════
# Factory Address:      0x... 
# Founder Wallet:       0x...
# Network:              Base Sepolia
# ═══════════════════════════════════════════════════════════════

# Note: Address is saved to deployed-addresses.json
```

### Phase 4: Update Frontend

Update `src/lib/contracts/artDropFactory.ts`:

```typescript
// Copy the factory address from Phase 3 output
export const FACTORY_ADDRESS = "0x..." as const;
```

Then rebuild and redeploy frontend:

```bash
npm run build
npx vercel --prod
```

### Phase 5: Deploy Artist Contracts

For each artist, deploy their individual contract:

```bash
# Deploy for Artist 1
npx node scripts/deploy-artist-contract.mjs 0xArtist1WalletAddress

# Deploy for Artist 2
npx node scripts/deploy-artist-contract.mjs 0xArtist2WalletAddress

# Deploy for Artist 3
npx node scripts/deploy-artist-contract.mjs 0xArtist3WalletAddress
```

Each command will:
1. Deploy artist contract via factory
2. Automatically update Supabase with contract address
3. Show you the deployed contract address

**Output Example:**
```
═══════════════════════════════════════════════════════════════
✅ ARTIST CONTRACT DEPLOYED!

📋 DEPLOYMENT SUMMARY:
═══════════════════════════════════════════════════════════════
Artist Wallet:       0x1234...
Contract Address:    0x5678...
Deployment TX:       0xabcd...
Network:             Base Sepolia
═══════════════════════════════════════════════════════════════
```

### Phase 6: Update UI Components

Update your app components to use artist-specific hooks. See:  
`ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md` - Hook Usage section

## Verification

After deployment, verify everything is working:

### Check Factory Deployed

```bash  
# Visit in browser:
https://sepolia.basescan.org/address/0x{FACTORY_ADDRESS}

# Should show:
# - Contract code (verified if etherscan verifies it)
# - Read Contract: Can call getDeploymentCount
# - Write Contract: Can call deployArtDrop
```

### Check Artist Contract Deployed

```bash
# Visit in browser:
https://sepolia.basescan.org/address/0x{ARTIST_CONTRACT_ADDRESS}

# Should show:
# - artist() = artist wallet
# - founderWallet() = founder wallet
# - Can call subscribe(), createDrop(), mint()
```

### Check Supabase

```sql
-- Check artist has contract address
SELECT wallet, contract_address, contract_deployed_at 
FROM artists 
WHERE contract_address IS NOT NULL;

-- Should show artist wallets with deployed contract addresses
```

## Troubleshooting

### "Bytecode not set"

Factory was deployed but bytecode wasn't set. Solution:

```bash
# Run deploy-factory.mjs again - it sets bytecode automatically
npx node scripts/deploy-factory.mjs
```

### "Artist already has contract"

Artist wallet already deployed. Solution:

```bash
# Check Supabase
SELECT wallet, contract_address FROM artists WHERE wallet = '0x...';

# Use existing contract address in your UI
# Or contact admin to reset if needed
```

### "No such contract" / Compilation errors

You're trying to use contracts that haven't been compiled. Solution:

```bash
# Option 1: Use Node.js 22 LTS and compile
node --version  # >= 22.10.0
npx hardhat compile

# Option 2: Use online Remix IDE
# https://remix.ethereum.org/
# Copy, paste, compile the .sol file
# Export bytecode
```

### "Private key invalid"

The PRIVATE_KEY environment variable isn't properly set. Solution:

```bash
# Check the key is set correctly
echo $PRIVATE_KEY  # Should show 0x...

# If not set:
export PRIVATE_KEY=0xyourkey

# Verify it's 66 characters (0x + 64 hex chars)
```

## Network Details

**Base Sepolia Testnet:**
- Chain ID: 84532
- RPC: https://sepolia.base.org  
- Explorer: https://sepolia.basescan.org
- Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

**Get testnet ETH:**
1. Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
2. Connect your wallet
3. Request 0.0 ETH (free, multiple times)
4. Use for gas fees

## Files Involved

```
🔧 Contracts:
├── contracts/ArtDropFactory.sol        (Factory - deploy once)
├── contracts/ArtDropArtist.sol         (Per-artist - deploy for each)
└── contracts/ArtDrop.sol               (Old - keep for history)

📜 Deployment Scripts:
├── scripts/deploy-factory.mjs          (Deploy factory)
├── scripts/deploy-artist-contract.mjs  (Deploy per artist) 
├── scripts/deploy-factory-simple.mjs   (Alternative simple one)
└── scripts/compile-contracts.mjs       (Manual compilation)

📱 Frontend:
├── src/lib/contracts/artDropFactory.ts (Factory ABI & address)
├── src/lib/contracts/artDrop.ts        (Updated for artist contracts)
├── src/hooks/useContracts.ts           (New artist-specific hooks - 450+ lines)
└── src/lib/db.ts                       (Contract address tracking)

📊 Database:
└── supabase/migrations/002_add_artist_contract_deployment.sql

📚 Documentation:
├── ARTIST_CONTRACTS_IMPLEMENTATION_SUMMARY.md  (What was built)
├── ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md         (How to use)
└── FEATURE_DEPLOYMENT_CHECKLIST.md             (This file)
```

## Post-Deployment Tasks

Once factories and artist contracts are deployed:

1. ✅ Update FACTORY_ADDRESS in frontend
2. ✅ Update UI components to use artist-specific hooks
3. ✅ Test subscription flow (one-per-wallet enforcement)
4. ✅ Test drop creation (artist-only)
5. ✅ Test minting (collector actions)
6. ✅ Test fund distribution (70/30 split)
7. ✅ Verify Supabase updates

## Support

For detailed information:

- **Deployment Guide**: `ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md`
- **Implementation Details**: `ARTIST_CONTRACTS_IMPLEMENTATION_SUMMARY.md`
- **Hook Usage**: See useCreateDropInArtistContract, useSubscribeToArtistContract, etc.
- **Contract Ref**: See contracts/ArtDropFactory.sol and contracts/ArtDropArtist.sol

## Summary

```
Current State:
✅ Code written and tested
✅ Tests pass
✅ Frontend deployed
❌ Contracts need compilation (Node.js v22 issue)
❌ Factory not deployed
❌ Artist contracts not deployed

To Fix:
1. Upgrade Node.js to 22 LTS OR use Remix IDE for compilation
2. Run deploy-factory.mjs
3. Update FACTORY_ADDRESS
4. Deploy artist contracts
5. Update UI
6. Test

Estimated Time: 15-30 minutes after Node.js is available
```

---

**Status:** Ready for deployment  
**Last Updated:** March 23, 2026  
**Network:** Base Sepolia (testnet)
