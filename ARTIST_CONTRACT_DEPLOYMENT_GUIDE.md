# Artist-Specific Contract Deployment Guide

## Overview

This guide covers the new architecture where each artist gets their own individual ArtDrop contract instance. This enables:

- ✅ Artist-specific fund distribution (70% artist, 30% founder)
- ✅ One-subscription-per-wallet enforcement at contract level
- ✅ Transparent on-chain artist profiles
- ✅ Direct subscription interactions with artist contract
- ✅ Independent subscriptions per artist (no conflicts)

## Architecture

```
ArtDropFactory (singleton)
    ↓
    ├─→ Artist A Contract (0x1234...)
    │   ├─ artist = 0xAAA...
    │   ├─ founderWallet = 0xFOO...
    │   ├─ Drops
    │   └─ Subscriptions
    │
    ├─→ Artist B Contract (0x5678...)
    │   ├─ artist = 0xBBB...
    │   ├─ founderWallet = 0xFOO...
    │   ├─ Drops
    │   └─ Subscriptions
    │
    └─→ Artist C Contract (0x9ABC...)
        ├─ artist = 0xCCC...
        ├─ founderWallet = 0xFOO...
        ├─ Drops
        └─ Subscriptions
```

## Deployment Steps

### Phase 1: Compile Contracts

```bash
# Compile ArtDropFactory and ArtDropArtist
npx hardhat compile

# Check artifacts were created
ls -la artifacts/contracts/
# Should see: ArtDropFactory.json, ArtDropArtist.json
```

### Phase 2: Deploy Factory

The factory contract needs to be deployed once and holds the ArtDrop bytecode.

```bash
# Deploy factory (requires PRIVATE_KEY env var - should be founder/admin wallet)
export PRIVATE_KEY=0x...
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your_anon_key

npx node scripts/deploy-factory.mjs

# Output will show:
# ✅ DEPLOYMENT COMPLETE!
# Factory Address:      0x...
# Founder Wallet:       0x...
# Network:              Base Sepolia
# Deployment Time:      2024-03-23T...
```

**Save the Factory Address** - you'll need it for next steps.

### Phase 3: Update Frontend with Factory Address

Update `src/lib/contracts/artDropFactory.ts`:

```typescript
export const FACTORY_ADDRESS = "0x..." as const;  // ← Your factory address from Phase 2
```

### Phase 4: Deploy Individual Artist Contracts

For each artist profile created in your system, deploy their contract:

```bash
# Deploy contract for a specific artist wallet
npx node scripts/deploy-artist-contract.mjs 0xArtistWalletAddress

# Example:
npx node scripts/deploy-artist-contract.mjs 0x1234567890123456789012345678901234567890

# Output will show:
# ✅ ARTIST CONTRACT DEPLOYED!
# Artist Wallet:       0x1234...
# Contract Address:    0xDeployed...
# Deployment TX:       0xTxHash...
```

This automatically updates Supabase with:
- `artists.contract_address` = deployed contract address
- `artists.contract_deployment_tx` = transaction hash
- `artists.contract_deployed_at` = deployment timestamp

### Phase 5: Update Subscription Pages to Use Artist Contracts

In any component that calls subscribe, mint, or create drops:

```typescript
// BEFORE (using shared contract):
const { subscribe } = useSubscribeArtist();
await subscribe(artistWallet, "0.1"); // passes artist to contract

// AFTER (using artist-specific contract):
import { useSubscribeToArtistContract } from "@/hooks/useContracts";

const { subscribe } = useSubscribeToArtistContract(artist.contract_address);
await subscribe("0.1"); // artist is implicit in contract
```

## New Frontend Hooks

All hooks are in `src/hooks/useContracts.ts`:

### For Subscriptions

```typescript
// Subscribe to an artist's contract
const { subscribe, subscriptionConfirmed, isPending, isSuccess } = 
  useSubscribeToArtistContract(artistContractAddress);

await subscribe("1.5"); // amount in ETH

// Check if user is subscribed
const { isSubscribed } = useIsSubscribedToArtistContract(
  artistContractAddress,
  userWalletAddress
);

// Get subscriber count
const { count } = useGetSubscriberCountFromArtistContract(artistContractAddress);
```

### For Drops

```typescript
// Create a drop in artist contract
const { createDrop, createdDropId, isSuccess } = 
  useCreateDropInArtistContract(artistContractAddress);

await createDrop(
  "ipfs://QmXXXX...",
  "0.05",  // price
  100,     // supply
  Math.floor(Date.now() / 1000),  // start time
  0        // end time (0 = no deadline)
);

// Mint from a drop
const { mint, mintedTokenId, isSuccess } = 
  useMintFromArtistContract(artistContractAddress);

await mint(dropId, priceInWei);

// Get drop details
const { data: drop } = useGetDropFromArtistContract(
  artistContractAddress,
  dropId
);
```

## Database Schema Updates

Run the migration to add artist contract tracking:

```sql
-- File: supabase/migrations/002_add_artist_contract_deployment.sql
-- Adds:
-- - artists.contract_address (deployed contract address)
-- - artists.contract_deployment_tx (deployment transaction hash)
-- - artists.contract_deployed_at (deployment timestamp)
-- - drops.artist_contract_address (contract where drop was created)
```

## Testing Checklist

### 1. Factory Deployment
- [ ] Factory deploys successfully
- [ ] Bytecode is set correctly
- [ ] Owner and founder wallet are correct

### 2. Artist Contract Deployment
- [ ] Artist contract deploys via factory
- [ ] Contract address stored in Supabase
- [ ] Artist address matches
- [ ] Founder wallet matches

### 3. Subscription Flow
- [ ] User can subscribe to artist contract
- [ ] Funds split correctly (70% artist, 30% founder)
- [ ] One-subscription-per-wallet enforced
- [ ] Second subscription attempt fails with "Already subscribed"
- [ ] Subscriber count increments

### 4. Drop Management
- [ ] Artist can create drop in their contract
- [ ] Drop ID stored in Supabase
- [ ] Drop is readable from contract
- [ ] Only artist can pause their drops

### 5. Minting
- [ ] Collector can mint from artist drop
- [ ] NFT minted with correct metadata
- [ ] Funds split correctly (2.5% fee to founder, remainder to artist)
- [ ] Supply limits enforced

### 6. Fund Withdrawal
- [ ] Founder can withdraw pending fees from multiple artists
- [ ] Artist receives correct share via direct transfer
- [ ] Failed transfers go to pendingWithdrawals
- [ ] Failed transfers can be claimed later

## Contract Functions Reference

### ArtDropArtist (Individual Artist Contract)

**State Variables:**
- `artist` - Immutable artist wallet
- `founderWallet` - Immutable founder/admin wallet
- `nextDropId` - Auto-incrementing drop counter
- `subscriberCount` - Total unique subscribers
- `totalSubscriptionRevenue` - Total ETH received

**Artist-Only Functions:**
```solidity
createDrop(metadataURI, priceWei, maxSupply, startTime, endTime) → dropId
togglePause(dropId)
cancelSubscription(subscriber)  // Allows renewal after cancellation
```

**Public Payable Functions:**
```solidity
subscribe()  // msg.value must be > 0
mint(dropId)  // msg.value must be >= drop price
```

**Anyone Can Call:**
```solidity
withdrawFounderFees()  // Founder only
withdraw()  // Claim pending funds
```

**View Functions:**
```solidity
isSubscribed(subscriber) → bool
getSubscriptionAmount(subscriber) → uint256
getSubscriberCount() → uint256
getDrop(dropId) → Drop struct
getDropMinted(dropId) → uint256
```

### ArtDropFactory (Deployment Factory)

**Owner-Only Functions:**
```solidity
deployArtDrop(artistWallet) → contractAddress
setArtDropBytecode(bytecode)
transferOwnership(newOwner)
updateFounderWallet(newFounder)
```

**View Functions:**
```solidity
getArtistContract(artist) → contractAddress
getContractArtist(contractAddress) → artist
getAllDeployedContracts() → address[]
getDeploymentCount() → uint256
isDeployedContract(contractAddress) → bool
```

## Environment Variables

Create `.env.local`:

```bash
# Wallet private key (should be founder/admin)
PRIVATE_KEY=0x...

# Supabase configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: For deployment scripts
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

## Troubleshooting

### "Artist already has contract"
- Artist wallet already deployed a contract
- Check `artists.contract_address` in Supabase
- Use existing contract address instead of redeploying

### "Bytecode not set"
- Factory was deployed but `setArtDropBytecode` wasn't called
- Run `deploy-factory.mjs` again, it does both
- Or manually call: `factory.setArtDropBytecode(bytecodeHex)`

### "Already subscribed to this artist"
- User's wallet already subscribed to this artist
- Artist must call `cancelSubscription(userWallet)` to allow renewal
- Or user waits for subscription to expire (if implemented)

### "Only artist can call this"
- Trying to create drop/pause from non-artist wallet
- Use the wallet stored in `artists.wallet` on the UI

### Pending Withdrawals Not Transferring
- Direct transfer to wallet failed (e.g., contract can't receive ETH)
- Funds go to `pendingWithdrawals` mapping
- Recipient can call `withdraw()` to claim later
- Or update wallet to EOA instead of contract

## Gas Estimates

On Base Sepolia (current prices ~0.0001-0.001 gwei):

- Deploy Factory: ~2.5M gas
- Deploy Artist Contract: ~1.8M gas per artist
- Create Drop: ~80K gas
- Subscribe: ~80K gas (direct transfer) - ~150K gas (if pending)
- Mint NFT: ~120K gas
- Withdraw Fees: ~50K gas

## Migration from Shared Contract

If migrating from old shared ArtDrop.sol:

1. Keep old contract around for historical drops
2. Deploy new factory and artist contracts
3. Update Supabase to store both `old_contract_address` and `contract_address`
4. Update UI hooks to use new artist-specific contracts
5. Old drops can still be minted via old contract
6. New drops only via artist-specific contracts

## Support & Recovery

### Get Artist Contract Address
```bash
# From Supabase
SELECT wallet, contract_address FROM artists WHERE wallet = '0x...'

# From Factory
npx hardhat console --network baseSepolia
> const factory = await ethers.getContractAt("ArtDropFactory", "0x...");
> await factory.getArtistContract("0xArtistWallet")
```

### Verify Contract Deployment
```bash
# Check contract exists and is callable
npx hardhat console --network baseSepolia
> const artist = await ethers.getContractAt("ArtDrop", "0xContractAddress");
> await artist.artist()  // Should return artist wallet
> await artist.founderWallet()  // Should return founder
```

### Manual Contract SETUPs (if needed)
```bash
npx hardhat console --network baseSepolia
> const factory = await ethers.getContractAt("ArtDropFactory", "0x...");

# If founder wallet needs updating
> await factory.updateFounderWallet("0xNewFounderWallet")

# Read current founder
> await factory.founderWallet()
```

---

**Last Updated:** March 23, 2026  
**Status:** Ready for deployment  
**Network:** Base Sepolia (testnet)
