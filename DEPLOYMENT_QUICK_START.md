# Deployment Quick Reference - Phase 5

## TL;DR - Remix Deployment Steps

### 1. Setup (5 min)
```
1. Go to remix.ethereum.org
2. Create workspace "THEPOPUP"
3. Upload all .sol files from contracts/
4. Set compiler to 0.8.28
5. Switch MetaMask to Base Sepolia
```

### 2. Deploy Contracts (15 min)
```
A. POAPCampaign
   - No constructor args
   - Deploy → Save address

B. ArtDrop(admin)
   - Args: 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092
   - Deploy → Save address

C. ArtDropFactory(admin)
   - Args: 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092
   - Deploy → Save address

D. ArtistSharesToken(artist)
   - Args: 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092
   - Deploy → Test only
```

### 3. Update Code (2 min)
```env
# .env.local
VITE_POAP_CAMPAIGN_ADDRESS=0x...
VITE_ART_DROP_ADDRESS=0x...
VITE_FACTORY_ADDRESS=0x...
```

```typescript
// src/lib/contracts/poapCampaign.ts
export const POAP_CAMPAIGN_ADDRESS = "0x..." as const;

// src/lib/contracts/artDrop.ts
export const ART_DROP_ADDRESS = "0x..." as const;

// src/lib/contracts/factory.ts (create)
export const FACTORY_ADDRESS = "0x..." as const;
```

### 4. Test & Deploy (5 min)
```bash
npm run build
npm run preview          # Test locally
npx vercel --prod       # Deploy to production
```

---

## Contract Constructor Arguments

| Contract | Arg 1 | Description |
|----------|-------|-------------|
| POAPCampaign | — | None |
| ArtDrop | `0x4B39...` | Admin wallet |
| ArtDropFactory | `0x4B39...` | Admin wallet |
| ArtistSharesToken | `0x4B39...` | Artist wallet (test only) |

---

## Verify on Basescan

After deployment, check each contract:

```bash
https://sepolia.basescan.org/address/0x...

✓ Code verified
✓ Functions visible
✓ Constructor args match
```

---

## Gas Costs (Estimate)

| Contract | Gas | Est. Cost |
|----------|-----|----------|
| POAPCampaign | ~1.2M | $0.05-0.15 |
| ArtDrop | ~800K | $0.03-0.10 |
| ArtDropFactory | ~600K | $0.02-0.08 |
| ArtistSharesToken | ~700K | $0.02-0.08 |
| **Total** | ~3.3M | **$0.12-0.41** |

---

## Remix IDE Tips

### Clear Cache
Settings → "Clear Cache" (if stuck)

### Find Deployed Contract
Bottom of left panel → "Deployed Contracts" dropdown

### Get Contract Address
Right-click deployed contract name → "Copy address"

### Test Function Calls
1. Select deployed contract
2. Expand function name
3. Enter args
4. Click call/transact
5. Approve in MetaMask

---

## Common Errors & Fixes

```
❌ "User rejected transaction"
✅ Approve in MetaMask pop-up

❌ "Insufficient gas"
✅ Get testnet ETH: https://www.buser.io/faucet/base-sepolia

❌ "Address already has code"
✅ Use different admin wallet

❌ "Provider not connected"
✅ Refresh page, switch MetaMask to Base Sepolia

❌ "Compilation failed"
✅ Check solidity version is 0.8.28
```

---

## File Locations

```
contracts/
├── POAPCampaign.sol           ✅ Deployed
├── ArtDrop.sol                 ✅ Deployed
├── ArtDropFactory.sol          ✅ Deployed
├── ArtDropArtist.sol           ✅ Reference
└── ArtistSharesToken.sol       ✅ NEW (Phase 5)

src/lib/contracts/
├── poapCampaign.ts            ← Update address
├── artDrop.ts                  ← Update address
└── factory.ts                  ← Create & add

.env.local
└── ADD all 3 addresses

supabase/migrations/
└── 003_add_shares_system.sql   ✅ Execute
```

---

## Verification Checklist

- [ ] All contracts compile (0.8.28)
- [ ] POAPCampaign deployed
- [ ] ArtDrop deployed
- [ ] ArtDropFactory deployed
- [ ] ArtistSharesToken deployed (test)
- [ ] Addresses added to .env.local
- [ ] Addresses added to src/lib/contracts/
- [ ] Supabase migration 003 executed
- [ ] Frontend builds without errors
- [ ] Test deploy to Vercel
- [ ] Contracts verified on Basescan
- [ ] Artist records updated in Supabase

---

## Next Commands

```bash
# Build
npm run build

# Local preview
npm run preview

# Deploy to Vercel
npx vercel --prod

# Git commit
git add -A
git commit -m "deploy: Phase 5 contracts to Base Sepolia"
git push origin master
```

---

**Estimated Total Time: 30-45 minutes**
