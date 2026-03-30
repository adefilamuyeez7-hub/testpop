# 🚀 Artist-Specific Contract Deployment - Implementation Complete

## Summary

Successfully implemented a factory-based architecture where:
- ✅ Each artist gets their own ArtDrop contract instance
- ✅ Founder wallet and artist wallet are configured at deployment
- ✅ One-subscription-per-wallet enforced at contract level
- ✅ 70% artist / 30% founder fund split
- ✅ Subscription payment goes directly to artist contract
- ✅ All functions scoped to individual artist

## What's Been Created

### Smart Contracts (Solidity)

#### 1. **ArtDropFactory.sol** (`contracts/ArtDropFactory.sol`)
- Singleton factory that deploys ArtDrop contracts for each artist
- Stores ArtDropArtist bytecode
- Owner-only deployment: `deployArtDrop(artistWallet)`
- Tracks: artist → contract address mapping
- Events: `ArtDropDeployed`, `ArtDropBytecodeSet`, `FounderWalletUpdated`

#### 2. **ArtDropArtist.sol** (`contracts/ArtDropArtist.sol`)
- Individual ERC-721 contract deployed per artist
- Immutable properties:
  - `artist` - The artist's wallet
  - `founderWallet` - Founder/admin wallet (30% recipient)
- Artists can:
  - `createDrop()` - Create NFT drops with metadata, price, supply, time window
  - `togglePause()` - Pause/unpause their drops
  - `cancelSubscription()` - Cancel subscriber to allow renewal
- Collectors can:
  - `subscribe()` - Subscribe with automatic 70/30 fund split
  - `mint()` - Mint NFT from a drop
  - `withdraw()` - Claim pending funds from failed transfers
- Founder can:
  - `withdrawFounderFees()` - Claim pending subscription fees
- View functions (for subscriptions):
  - `isSubscribed(subscriber) → bool`
  - `getSubscriptionAmount(subscriber) → uint256`
  - `getSubscriberCount() → uint256`

### Deployment Scripts

#### 1. **deploy-factory.mjs** (`scripts/deploy-factory.mjs`)
```bash
npx node scripts/deploy-factory.mjs
```
- Deploys ArtDropFactory contract
- Sets ArtDropArtist bytecode in factory
- Outputs: Factory address, deployment timestamp
- Environment: Requires `PRIVATE_KEY` (founder wallet)

#### 2. **deploy-artist-contract.mjs** (`scripts/deploy-artist-contract.mjs`)
```bash
npx node scripts/deploy-artist-contract.mjs 0xArtistWalletAddress
```
- Deploys ArtDrop contract for specific artist via factory
- Automatically updates Supabase with contract address
- Outputs: Artist contract address, deployment transaction
- Environment: Requires `PRIVATE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Database Schema

#### Supabase Migration (`supabase/migrations/002_add_artist_contract_deployment.sql`)

New columns in `artists` table:
- `contract_address` (VARCHAR) - Deployed contract address
- `contract_deployment_tx` (VARCHAR) - Deployment transaction hash
- `contract_deployed_at` (TIMESTAMP) - Deployment timestamp

New column in `drops` table (optional):
- `artist_contract_address` (VARCHAR) - Contract where drop was created

### Frontend Hooks (`src/hooks/useContracts.ts`)

#### Subscription Hooks
```typescript
// Subscribe to artist's contract
useSubscribeToArtistContract(artistContractAddress)
  → { subscribe, subscriptionConfirmed, isPending, isSuccess, error, hash }

// Check subscription status
useIsSubscribedToArtistContract(artistContractAddress, userAddress)
  → { isSubscribed, isLoading, error, refetch }

// Get subscriber count
useGetSubscriberCountFromArtistContract(artistContractAddress)
  → { count, isLoading, error, refetch }
```

#### Drop Management Hooks
```typescript
// Create drop in artist contract
useCreateDropInArtistContract(artistContractAddress)
  → { createDrop, createdDropId, isPending, isSuccess, error, hash }

// Mint from artist contract
useMintFromArtistContract(artistContractAddress)
  → { mint, mintedTokenId, isPending, isSuccess, error, hash }

// Get drop details from artist contract
useGetDropFromArtistContract(artistContractAddress, dropId)
  → { data, isLoading, error, refetch }
```

### Contract References (`src/lib/contracts/artDropFactory.ts`)

- `FACTORY_ADDRESS` - Will be updated after deployment
- `FACTORY_ABI` - Complete factory contract ABI with all functions and events

### Updated Contract References (`src/lib/contracts/artDrop.ts`)

- Completely refactored ABI for ArtDropArtist.sol
- Updated function signatures (no artist parameter - it's implicit)
- Added all new events: `NewSubscription`, `SubscriptionFundsDistributed`, `FounderFeesWithdrawn`
- Removed old subscription events, replaced with new ones

### Database Layer (`src/lib/db.ts`)

#### Updated Artist Type
```typescript
interface Artist {
  // ... existing fields ...
  contract_address?: string;
  contract_deployment_tx?: string;
  contract_deployed_at?: string;
}
```

#### New Function
```typescript
updateArtistContractAddress(wallet, contractAddress, deploymentTx)
  → Updates Supabase with contract info after deployment
```

### Documentation

#### ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md (450+ lines)
Complete guide covering:
- Architecture overview with diagrams
- Step-by-step deployment process (5 phases)
- Frontend hook usage examples
- Contract functions reference
- Database schema changes
- Testing checklist (25+ test items)
- Troubleshooting guide
- Gas estimates
- Migration from old shared contract
- Recovery procedures

## Deployment Instructions

### Phase 1: Deploy Factory
```bash
export PRIVATE_KEY=0x... # Founder wallet
npx node scripts/deploy-factory.mjs
# Output: Saves FACTORY_ADDRESS to deployed-addresses.json
```

### Phase 2: Update Frontend
```typescript
// src/lib/contracts/artDropFactory.ts
export const FACTORY_ADDRESS = "0x..." // From Phase 1 output
```

### Phase 3: Deploy Artist Contracts
```bash
# For each artist:
npx node scripts/deploy-artist-contract.mjs 0xArtistWalletAddress
# Automatically updates Supabase
```

### Phase 4: Update UI Components
Use new artist-specific hooks in:
- ArtistStudioPage (drop creation)
- ArtistProfilePage (subscriptions)
- DropDetailPage (minting)
- ProfilePage (subscription status)

## Key Features

### ✅ One-Subscription-Per-Wallet
```solidity
require(!hasSubscribed[msg.sender], "Already subscribed");
hasSubscribed[msg.sender] = true;
```

### ✅ Fund Distribution
```solidity
uint256 artistShare = (msg.value * 70) / 100;
uint256 founderShare = msg.value - artistShare;
// Sent directly to respective wallets
```

### ✅ Failed Transfer Handling
```solidity
(bool success, ) = wallet.call{value: amount}("");
if (!success) {
    pendingWithdrawals[wallet] += amount;  // Fallback
}
```

### ✅ Artist-Only Functions
```solidity
modifier onlyArtist() {
    require(msg.sender == artist, "Only artist");
    _;
}

function createDrop(...) external onlyArtist { ... }
```

## File Changes Summary

| File | Changes | Lines |
|------|---------|-------|
| contracts/ArtDropFactory.sol | NEW | 220 |
| contracts/ArtDropArtist.sol | NEW | 420 |
| supabase/migrations/002_add_artist_contract_deployment.sql | NEW | 20 |
| scripts/deploy-factory.mjs | NEW | 180 |
| scripts/deploy-artist-contract.mjs | NEW | 200 |
| src/lib/contracts/artDropFactory.ts | NEW | 130 |
| src/lib/contracts/artDrop.ts | UPDATED | ±250 |
| src/hooks/useContracts.ts | UPDATED | +450 |
| src/lib/db.ts | UPDATED | +80 |
| ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md | NEW | 450 |
| **Total** | | **+1800 lines** |

## Git Commits

```
Commit: 7a7713e
Message: 🚀 FEAT: Add artist-specific contract deployment system

Changed files:
- contracts/ArtDropArtist.sol (NEW)
- contracts/ArtDropFactory.sol (NEW)
- scripts/deploy-artist-contract.mjs (NEW)
- scripts/deploy-factory.mjs (NEW)
- src/lib/contracts/artDropFactory.ts (NEW)
- supabase/migrations/002_add_artist_contract_deployment.sql (NEW)
- src/hooks/useContracts.ts (MODIFIED: +430 lines)
- src/lib/contracts/artDrop.ts (MODIFIED: ±250 lines)
- src/lib/db.ts (MODIFIED: +80 lines)
- ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md (NEW: 450 lines)
```

## Build Status

✅ **Production Build Successful**
- Bundle: 176 KB (54.48 KB gzipped)
- No TypeScript errors
- No compilation warnings
- Deployed to: https://thepopup-fixed.vercel.app

## Network

- **Testnet:** Base Sepolia
- **Chain ID:** 84532
- **RPC:** https://sepolia.base.org

## Next Steps

1. **Deploy Factory**
   ```bash
   npx node scripts/deploy-factory.mjs
   ```

2. **Update FACTORY_ADDRESS** in `src/lib/contracts/artDropFactory.ts`

3. **Deploy Artist Contracts**
   - For each artist, run: `npx node scripts/deploy-artist-contract.mjs 0x...`
   - Automatically updates Supabase

4. **Update UI Components**
   - Reference: `ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md` for hook usage

5. **Run Tests**
   - Subscribe flow
   - Drop creation
   - Minting
   - Fund distribution
   - One-per-wallet enforcement

## Testing Checklist

- [ ] Factory deploys successfully
- [ ] Bytecode sets correctly in factory
- [ ] Artist contract deploys via factory
- [ ] Contract address saved to Supabase
- [ ] User can subscribe to artist contract
- [ ] Subscription funds split correctly (70/30)
- [ ] One-subscription-per-wallet enforced
- [ ] Second subscription fails with "Already subscribed"
- [ ] Artist can create drops
- [ ] Drops are readable from contract
- [ ] Collector can mint NFTs
- [ ] Mint funds split correctly (2.5% to founder, rest to artist)
- [ ] Supply limits enforced
- [ ] Failed transfers go to pendingWithdrawals
- [ ] Founder can withdraw pending fees

## Support

For detailed information, see: `ARTIST_CONTRACT_DEPLOYMENT_GUIDE.md`

Key sections:
- Architecture overview
- Deployment instructions (5 phases)
- Frontend hook usage
- Troubleshooting guide
- Contract reference
- Gas estimates
- Recovery procedures

---

**Status:** ✅ READY FOR DEPLOYMENT  
**Date:** March 23, 2026  
**Network:** Base Sepolia (testnet)  
**Deployment Scripts:** Ready to execute
