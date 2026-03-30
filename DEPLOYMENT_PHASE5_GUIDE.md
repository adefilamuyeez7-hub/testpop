# Complete Deployment Guide - Base Sepolia Testnet

## Overview
Deploy all contracts to Base Sepolia testnet using Remix IDE (Hardhat incompatible with Node.js 25).

**Contracts to Deploy:**
1. ✅ POAPCampaign.sol
2. ✅ ArtDrop.sol (original, multi-artist singleton)
3. ✅ ArtDropFactory.sol
4. ✅ ArtDropArtist.sol (reference implementation)
5. ✅ ArtistSharesToken.sol (Phase 5 - new)

**Network:** Base Sepolia (Chain ID: 84532)
**RPC:** https://sepolia.base.org

---

## Step 1: Prepare Remix IDE

### Access Remix
1. Go to https://remix.ethereum.org
2. Create new workspace: **"THEPOPUP-Deployment"**

### Upload Contracts
1. In File Explorer, create folder: `contracts/`
2. Copy all `.sol` files from your project:
   - `contracts/POAPCampaign.sol`
   - `contracts/ArtDrop.sol`
   - `contracts/ArtDropFactory.sol`
   - `contracts/ArtDropArtist.sol`
   - `contracts/ArtistSharesToken.sol`

3. Paste into Remix (one by one)

---

## Step 2: Configure Compiler

1. Left sidebar → **Solidity Compiler**
2. Set version to **0.8.28**
3. Click **Compile**
4. Verify no errors (warnings are OK)

---

## Step 3: Deploy in Order

### Phase A: POAPCampaign (Independent)

**Steps:**
1. Left sidebar → **Deploy & Run Transactions**
2. Network: Select **"Injected Provider - MetaMask"**
3. Switch MetaMask to **Base Sepolia**
4. Contract: Select **POAPCampaign**
5. Click **Deploy**
6. Approve in MetaMask
7. **Save address**: `POAP_CAMPAIGN_ADDRESS`

✅ **Example Address:** `0x...` (will vary)

---

### Phase B: ArtDrop (Original Singleton)

**Requires:** Admin wallet address

**Steps:**
1. Contract: Select **ArtDrop**
2. Constructor args: `0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092` (admin wallet)
3. Click **Deploy**
4. Approve in MetaMask
5. **Save address**: `ART_DROP_ADDRESS`

✅ **Example Address:** `0x...`

---

### Phase C: ArtDropFactory

**Requires:** ArtDrop address from Phase B

**Steps:**
1. Contract: Select **ArtDropFactory**
2. Constructor args: `0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092` (admin wallet)
3. Click **Deploy**
4. Approve in MetaMask
5. **Save address**: `FACTORY_ADDRESS`

✅ **Example Address:** `0x...`

---

### Phase D: ArtisSharesToken (Test Deploy)

**Note:** This is a reference contract. Each artist gets their own instance.

**Steps:**
1. Contract: Select **ArtistSharesToken**
2. Constructor args: `0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092` (artist wallet)
3. Click **Deploy**
4. Approve in MetaMask
5. Verify token appears on Basescan

✅ **Example Address:** `0x...` (reference only)

---

## Step 4: Update Configuration Files

### Update `.env.local`

```env
VITE_POAP_CAMPAIGN_ADDRESS=0x...
VITE_ART_DROP_ADDRESS=0x...
VITE_FACTORY_ADDRESS=0x...
```

### Update `src/lib/contracts/`

**File: `src/lib/contracts/poapCampaign.ts`**
```typescript
export const POAP_CAMPAIGN_ADDRESS = "0x..." as const;
```

**File: `src/lib/contracts/artDrop.ts`**
```typescript
export const ART_DROP_ADDRESS = "0x..." as const;
```

**File: `src/lib/contracts/factory.ts`** (create if doesn't exist)
```typescript
export const FACTORY_ADDRESS = "0x..." as const;
```

---

## Step 5: Verify Deployments

### On Basescan
1. Go to https://sepolia.basescan.org
2. Paste each contract address
3. Verify:
   - Contract is verified ✓
   - Functions visible ✓
   - Constructor args match ✓

### Test Read Functions
In Remix, for each contract:
1. Select deployed contract (dropdown at bottom)
2. Click contract name
3. Call a read function:
   - POAPCampaign: `nextCampaignId()` → should return 1
   - ArtDrop: `nextDropId()` → should return 0
   - ArtDropFactory: `owner()` → admin address

---

## Step 6: Update Frontend

### Update Supabase
Edit artist records to include contract addresses:

```sql
-- For testing, update one artist:
UPDATE artists
SET contract_address = '0x...',
    shares_enabled = true
WHERE id = 'artist-id';
```

### Rebuild Frontend
```bash
npm run build
npm run preview
```

Test on http://localhost:5173:
- ✅ Connect wallet
- ✅ Can create drop (artist-specific)
- ✅ Can subscribe to artist
- ✅ Subscriber count updates

---

## Step 7: Deploy to Production

### Commit to Git
```bash
git add -A
git commit -m "feat: deploy Phase 1-5 contracts to Base Sepolia

- POAPCampaign: $POAP_ADDRESS
- ArtDrop (singleton): $ART_DROP_ADDRESS
- ArtDropFactory: $FACTORY_ADDRESS
- ArtistSharesToken: reference implementation
- Updated .env with contract addresses"

git push origin master
```

### Deploy Frontend
```bash
npm run build
npx vercel --prod
```

---

## Troubleshooting

### MetaMask Connection Issues
```
❌ "Could not connect to injected provider"
✅ Fix: 
   1. Open MetaMask
   2. Switch to Base Sepolia
   3. Refresh Remix
   4. Try again
```

### Insufficient Gas
```
❌ "Revert: out of gas"
✅ Fix:
   1. Get testnet ETH from: https://www.buser.io/faucet/base-sepolia
   2. Wait 5 minutes
   3. Try deployment again
```

### Contract Already Exists
```
❌ "Address already has code"
✅ Fix: Use new admin wallet or delete old contracts
```

### Compilation Errors
```
❌ "TypeError: TypeError: Cannot read property 'version' of undefined"
✅ Fix:
   1. Clear browser cache Ctrl+Shift+Del
   2. Clear Remix cache: Settings → Clear Cache
   3. Reload https://remix.ethereum.org
```

---

## Contract Interaction Examples

### Create Drop (ArtDrop)
```javascript
// In Remix Console
const artDrop = await ArtDrop.at("0x...");
await artDrop.createDrop(
  "ipfs://QmXxxx",  // metadata URI
  "100000000000000000",  // 0.1 ETH in wei
  10,  // max supply
  0,   // start now
  0    // no deadline
);
```

### Subscribe to Artist (ArtDropArtist)
```javascript
const artistContract = await ArtDropArtist.at("0x...");
await artistContract.subscribe({
  value: "10000000000000000"  // 0.01 ETH
});
```

### Launch Fundraising (ArtistSharesToken)
```javascript
const sharesToken = await ArtistSharesToken.at("0x...");
await sharesToken.launchCampaign(
  "1000000000000000000",  // 1 ETH target
  1000000,  // 1M shares
  30  // 30 day campaign
);
```

---

## Deployment Addresses (Base Sepolia)

| Contract | Address | Tx Hash |
|----------|---------|---------|
| POAPCampaign | `0x...` | `0x...` |
| ArtDrop | `0x...` | `0x...` |
| ArtDropFactory | `0x...` | `0x...` |
| ArtistSharesToken (ref) | `0x...` | `0x...` |

---

## Next Steps

1. ✅ Deploy all contracts (this guide)
2. ✅ Update .env with addresses
3. ✅ Test on Base Sepolia
4. ✅ Update Supabase artist records
5. ✅ Deploy frontend to Vercel
6. ⏳ Monitor gas costs on mainnet
7. ⏳ Plan mainnet migration

---

## Support

For issues:
1. Check [Remix Docs](https://remix-ide.readthedocs.io/)
2. See [Base Docs](https://docs.base.org/)
3. Check contract ABIs in `src/lib/contracts/`
