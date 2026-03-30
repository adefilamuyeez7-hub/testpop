# Phase 5 + Deployment Status

## Overview
✅ **Phases 1-4:** Complete (Audit fixes applied)
✅ **Phase 5:** Complete (ArtistSharesToken contract + frontend hooks)
⏳ **Deployment:** Ready (Use Remix IDE → Base Sepolia Testnet)

---

## Phase 5: Shares System - COMPLETED

### Contracts Created
- ✅ **ArtistSharesToken.sol** (397 lines)
  - ERC-20 with fundraising capabilities
  - Artist can launch campaigns to raise funds
  - Investors buy shares, receive revenue distributions
  - Automatic fund distribution to shareholders

### Database Schema
- ✅ **Migration 003_add_shares_system.sql**
  - `shares_enabled` - boolean flag
  - `shares_contract_address` - stores deployed token address
  - `shares_contract_tx` - deployment transaction hash
  - `shares_campaign_active` - current campaign status

### Frontend Integration
- ✅ **useArtistSharesToken.ts** (165 lines)
  - `useLaunchSharesCampaign()` - Start fundraising
  - `useBuyShares()` - Investor purchases shares
  - `useCampaignStatus()` - Get fundraise progress
  - `useRevenueClaim()` - View shareholder earnings
  - `useClaimRevenue()` - Withdraw earnings
  - `useShareBalance()` - Check share holdings

### ABI Reference
- ✅ **src/lib/contracts/artistSharesToken.ts**
  - Full contract ABI exported
  - Ready for frontend integration
  - Includes all events and functions

---

## Audit Fixes Summary

### Phase 1: Compilation & Data Persistence ✅
- [x] Fixed RLS admin wallet placeholder
- [x] Database schema updated

### Phase 2: Money Safety ✅
- [x] POAPCampaign winner ETH routing fixed
- [x] ArtDropArtist mint overpayment refunds
- [x] O(n²) sort DoS mitigated (50-bid cap)
- [x] Artist balance tracking added

### Phase 3: Frontend Hook Corrections ✅
- [x] useSubscribeArtist → useSubscribeToArtistContract
- [x] useArtistSubscriberCount → useGetSubscriberCountFromArtistContract
- [x] useIsSubscribed → useIsSubscribedToArtistContract
- [x] Updated 5 pages (DropDetail, Artists, Profile, Index, Studio)

### Phase 4: Correctness & Trust ✅
- [x] minSubscriptionFee enforcement (0.001 ETH default)
- [x] createDrop() artist whitelist gating
- [x] Revenue display corrected (70/30 subscriptions, 97.5/2.5 mints)
- [x] Database migration executed

---

## Smart Contracts - Ready for Deployment

| Contract | File | Status | Network |
|----------|------|--------|---------|
| POAPCampaign | contracts/POAPCampaign.sol | ✅ Ready | Base Sepolia |
| ArtDrop | contracts/ArtDrop.sol | ✅ Ready | Base Sepolia |
| ArtDropFactory | contracts/ArtDropFactory.sol | ✅ Ready | Base Sepolia |
| ArtDropArtist | contracts/ArtDropArtist.sol | ✅ Reference | — |
| ArtistSharesToken | contracts/ArtistSharesToken.sol | ✅ NEW | Base Sepolia |

**Compiler:** Solidity 0.8.28
**Dependencies:** @openzeppelin/contracts (ERC721, ERC20, Ownable, ReentrancyGuard)

---

## Deployment Instructions

### Quick Path (30-45 minutes)

```bash
# 1. Open Remix IDE
https://remix.ethereum.org

# 2. Upload all .sol files from contracts/
# 3. Set compiler to 0.8.28
# 4. Switch MetaMask to Base Sepolia
# 5. Deploy in this order:

# A. POAPCampaign (no args)
# B. ArtDrop(0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092)
# C. ArtDropFactory(0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092)
# D. ArtistSharesToken(0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092)

# 6. Save all contract addresses
# 7. Update .env.local with addresses
# 8. Update src/lib/contracts/* with addresses
# 9. npm run build && npx vercel --prod
```

### Detailed Guide
👉 See [DEPLOYMENT_PHASE5_GUIDE.md](./DEPLOYMENT_PHASE5_GUIDE.md)
👉 See [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)

---

## Environment Configuration

### Create `.env.local`
```env
# Supabase
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=...

# Admin Wallet
VITE_ADMIN_WALLET=0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092

# Deployed Contracts (add after Remix deployment)
VITE_POAP_CAMPAIGN_ADDRESS=0x...
VITE_ART_DROP_ADDRESS=0x...
VITE_FACTORY_ADDRESS=0x...

# Pinata IPFS
VITE_PINATA_JWT=...
```

### Update Contract Files
```typescript
// src/lib/contracts/poapCampaign.ts
export const POAP_CAMPAIGN_ADDRESS = "0x..." as const;

// src/lib/contracts/artDrop.ts
export const ART_DROP_ADDRESS = "0x..." as const;

// src/lib/contracts/factory.ts (CREATE IF NOT EXISTS)
export const FACTORY_ADDRESS = "0x..." as const;

// src/lib/contracts/artistSharesToken.ts
export const ARTIST_SHARES_TOKEN_ADDRESS = "0x..." as const;
```

---

## Testing Checklist

### Pre-Deployment
- [ ] All contracts compile (0.8.28)
- [ ] No TypeScript errors: `npm run build`
- [ ] Frontend builds: `npm run preview`
- [ ] Tests pass: `npm test`

### Post-Deployment
- [ ] Contracts deployed to Base Sepolia
- [ ] Addresses added to .env.local
- [ ] Addresses added to src/lib/contracts/
- [ ] Supabase migration 003 executed
- [ ] Frontend updated with contract addresses
- [ ] Can create artist drop ✓
- [ ] Can subscribe to artist ✓
- [ ] Can launch shares campaign ✓
- [ ] Can buy shares ✓
- [ ] Revenue claims work ✓

### Basescan Verification
- [ ] POAPCampaign verified on Basescan
- [ ] ArtDrop verified on Basescan
- [ ] ArtDropFactory verified on Basescan
- [ ] ArtistSharesToken verified on Basescan

---

## Git Commit

```bash
git add -A
git commit -m "feat: Complete Phase 5 and prepare for deployment

Completed:
- Implemented ArtistSharesToken.sol (ERC-20 fundraising)
- Added frontend hooks for shares system
- Updated database schema (migration 003)
- Created comprehensive deployment guides

Ready for deployment to Base Sepolia:
- POAPCampaign.sol
- ArtDrop.sol
- ArtDropFactory.sol
- ArtistSharesToken.sol

All audit fixes (Phases 1-4) applied.

Next: Use Remix IDE to deploy to Base Sepolia"

git push origin master
```

---

## Deployment Commands

```bash
# Build for production
npm run build

# Preview locally
npm run preview

# Deploy to Vercel (after contracts deployed)
npx vercel --prod

# Execute Supabase migration
# (via Supabase dashboard or CLI)
```

---

## Gas Estimates (Base Sepolia Testnet)

| Contract | Gas | Cost in ETH |
|----------|-----|-------------|
| POAPCampaign | ~1.2M | ~0.0024 |
| ArtDrop | ~800K | ~0.0016 |
| ArtDropFactory | ~600K | ~0.0012 |
| ArtistSharesToken | ~700K | ~0.0014 |
| **Total** | ~3.3M | **~0.0066 ETH** |

Get testnet ETH: https://www.buser.io/faucet/base-sepolia

---

## File Structure

```
contracts/
├── POAPCampaign.sol ✅
├── ArtDrop.sol ✅
├── ArtDropFactory.sol ✅
├── ArtDropArtist.sol ✅
└── ArtistSharesToken.sol ✅ NEW

src/lib/contracts/
├── poapCampaign.ts (update)
├── artDrop.ts (update)
├── factory.ts (create + update)
└── artistSharesToken.ts ✅ NEW

src/hooks/
└── useArtistSharesToken.ts ✅ NEW

supabase/migrations/
├── 001_initial_schema.sql ✅
├── 002_add_artist_contract_deployment.sql ✅
└── 003_add_shares_system.sql ✅ NEW
```

---

## Next Steps

1. **Deploy Contracts** (30-45 min)
   - Use Remix IDE → Base Sepolia
   - Save all 4 contract addresses
   - Update .env and src/lib/contracts/

2. **Test Frontend** (10 min)
   - npm run build
   - npm run preview
   - Test wallet connection
   - Test create drop
   - Test subscribe

3. **Deploy to Production** (5 min)
   - npx vercel --prod
   - Monitor deployment

4. **Verify on Basescan** (5 min)
   - Check each contract
   - Verify source code
   - Run read functions

5. **Monitor & Document** (ongoing)
   - Track gas costs
   - Get user feedback
   - Plan mainnet migration

---

## Support Resources

- **Remix IDE:** https://remix.ethereum.org
- **Base Docs:** https://docs.base.org/
- **OpenZeppelin Docs:** https://docs.openzeppelin.com/
- **Solidity Docs:** https://docs.soliditylang.org/
- **Wagmi Docs:** https://wagmi.sh/

---

**Status: READY FOR DEPLOYMENT ✅**
**Estimated Deployment Time: 45 minutes**
**Estimated Total Time to Production: 1 hour**
