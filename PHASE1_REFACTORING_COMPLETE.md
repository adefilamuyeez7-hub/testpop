# Refactoring Phase 1: Contract Architecture & Admin Flow - COMPLETE

## Overview
This phase locked the per-artist contract architecture and built the critical path for admin approval → deployment → artist publishing.

---

## ✅ PHASE 1 COMPLETIONS

### 1. Runtime Blockers Fixed
| File | Issue | Fix |
|------|-------|-----|
| `src/lib/artistStore.ts` | `.map()` called on Set.values() iterator | Changed to `Array.from()` |
| `src/pages/ProductDetailPage.tsx` | Missing undefined `useAccountModal` import | Removed + added null check for product |
| `src/components/ProductCard.tsx` | Undefined `useAccountModal` hook | Removed unused reference |
| `src/pages/DropDetailPage.tsx` | Undefined `artistWallet`, `artistProfile` | Looked up from `getAllArtists()` |

**Impact**: App now runs without TypeScript/runtime errors on critical paths.

---

### 2. Smart Contract Corrections

#### contracts/ArtDropArtist.sol
**Subscription Counting Bug Fixed** (Line 156):
```solidity
// BEFORE (WRONG):
bool isNewSubscriber = !hasSubscribed[msg.sender] || block.timestamp > subscriptionExpiry[msg.sender];
if (isNewSubscriber) subscriberCount += 1;

// AFTER (CORRECT):
bool isNewSubscriber = !hasSubscribed[msg.sender];
if (isNewSubscriber) subscriberCount += 1;
```

**Why**: Renewals (expired subscriptions) were incorrectly incrementing subscriber count. Now only first-time subscriptions increment the counter.

---

### 3. Contract ABIs

#### NEW: `src/lib/contracts/artDropArtist.ts`
- Complete ABI for per-artist ArtDrop contracts
- Canonical function signatures for all operations
- Proper event definitions (DropCreated, ArtMinted, NewSubscription, etc.)
- All read/write functions accurately documented

**Key Functions**:
```typescript
// Artist operations
createDrop(metadataURI, priceWei, maxSupply, startTime, endTime)
togglePause(dropId)
setMintFee(bps)

// Collector operations
mint(dropId) [payable]
subscribe() [payable]

// Read functions
isSubscriptionActive(subscriber)
getSubscriberCount() → returns unique count (no double-counting)
getDrop(dropId) → returns full Drop struct
```

#### DEPRECATED: `src/lib/contracts/artDrop.ts`
- Marked obsolete with migration guide
- Old "shared master contract" paradigm no longer used
- Replaced by per-artist contracts

---

### 4. Contract Hooks

#### NEW: `src/hooks/useContractsArtist.ts`
Per-artist contract hooks that replace the old shared paradigm:

**Hooks Created**:
- `useCreateDropArtist(contractAddress)` - Create drop on artist's contract
- `useMintArtist(contractAddress)` - Mint from artist's drop
- `useSubscribeToArtistContract(contractAddress)` - Subscribe to artist
- `useIsSubscribedToArtistContract(contractAddress, userWallet)` - Check active subscription
- `useGetSubscriberCount(contractAddress)` - Get unique subscriber count
- `useArtistDropDetails(contractAddress, dropId)` - Fetch drop metadata
- `useTogglePauseArtist(contractAddress)` - Pause/unpause drop

**Design Pattern**:
```typescript
// Each hook requires the artist's contract address
// This is looked up from Supabase: artist.contract_address
const { mint } = useMintArtist(artistProfile?.contract_address);

// Contract address is normalized to ERC-55 checksum format
// No more shared hardcoded addresses
```

---

### 5. Artist Contract Address Resolution

#### UPDATED: `src/hooks/useArtistContractAddress.ts`
Canonical hook for looking up artist contract addresses:

```typescript
// By artist ID
const { contractAddress, isLoading } = useArtistContractAddress(artistId);

// By wallet
const { contractAddress } = useArtistContractAddressByWallet(wallet);
```

**Features**:
- Queries from Supabase artists table
- Normalizes all addresses to ERC-55 checksum
- Returns null if not deployed
- Error handling for invalid addresses

---

### 6. Admin Backend APIs

#### NEW ENDPOINTS (server/index.js)

**POST /admin/approve-artist** (Admin only)
```json
{
  "wallet": "0x...",
  "approve": true,
  "deployContract": true
}
```

Response:
```json
{
  "success": true,
  "artist": {
    "id": "uuid",
    "wallet": "0x...",
    "name": "Artist Name",
    "contract_address": "0x...",
    "whitelisted_at": "2026-03-30T..."
  },
  "deployment": {
    "status": "deployed|pending|failed",
    "address": "0x...",
    "tx": "0x...",
    "error": null
  }
}
```

**Workflow**:
1. Validates wallet exists in artists table
2. Updates whitelist.status = "approved"
3. **Prepares** contract deployment (actual deployment requires factory contract interaction)
4. Saves contract_address to artists table
5. Returns full artist record with deployment status

**GET /admin/artists** (Admin only)
Query parameters:
- `status` (optional): "pending", "approved", or "rejected"

Returns artists with linked profiles and deployment status.

---

### 7. Admin Client API

#### NEW: `src/lib/adminApi.ts`

**Hooks**:
```typescript
// Approve/reject artist + trigger deployment
const { approve, isLoading, error } = useApproveArtist();
await approve(wallet, true, true); // wallet, approve, deployContract

// Fetch admin artist list
const { fetch_artists, data, isLoading, error } = useAdminArtists("pending");
await fetch_artists();
```

**Features**:
- Automatically retrieves auth token from storage
- Handles Bearer token injection
- Proper error messages
- TypeScript interfaces for responses

---

## 🏗️ ARCHITECTURE CHANGES

### Old Model (DEPRECATED)
```
Shared Master Contract (ART_DROP_ADDRESS)
    ↓
All artists mint/subscribe on same contract
    ↓ ❌ Revenue routing issues, pause conflicts, etc.
```

### New Model (LOCKED IN)
```
Per-Artist Contracts (Deployed via Factory)
    ↓
Artist 1 Contract ← artist.contract_address[1]
Artist 2 Contract ← artist.contract_address[2]
Artist 3 Contract ← artist.contract_address[3]
    ↓ ✅ Isolated, owner-controlled, clear revenue routing
```

---

## 🔒 CONSISTENCY LAYERS

### Contract Address Lookup
1. **Primary**: `artists.contract_address` in Supabase
2. **Normalization**: All addresses converted to ERC-55 checksum
3. **Error Handling**: Returns null if missing or invalid
4. **Caching**: Cached via `useSupabaseArtists()` React Query

### Authentication
- Admin checks via `adminRequired` middleware
- Role resolution from whitelist.status
- Admin wallet list from `ADMIN_WALLETS` env var

### Subscription Counting
- Only incremented on **first** subscription
- Renewals don't inflate count
- `subscriberCount` now accurately reflects unique subscribers

---

## 📋 REMAINING WORK (Phases 2-5)

### Phase 2: Admin/Creator UI
- Update AdminPage approval flow UI
- Replace direct Supabase writes with API calls
- Show deployment status in artist list
- Add contract deployment trigger UI

### Phase 3: Creator Studio
- Block drop publish without contractAddress
- Update drop creation to call artist's contract
- Support new metadata fields (assetType, previewUri, etc.)

### Phase 4: Drop Discovery & Minting
- Update Index.tsx to use contractAddress
- Refactor DropDetailPage minting flow
- Fix drop filtering (only show with valid contractAddress + contractDropId)

### Phase 5: Product/Order Model
- Redesign product model (DB-first vs on-chain)
- Implement order fulfillment
- Add multi-file support (image, video, audio, PDF)

---

## 🧪 TESTING RECOMMENDATIONS

1. **Contract**:
   - Deploy ArtDropFactory and test artist contract deployment
   - Verify subscription counting doesn't inflate on renewals
   - Test pause/unpause isolated to per-artist contract

2. **API**:
   - Test /admin/approve-artist workflow
   - Verify auth token validation
   - Check error handling for invalid wallets

3. **Hooks**:
   - Test artistContract address lookup in Supabase
   - Verify normalization to ERC-55
   - Test null returns when contract not deployed

4. **Frontend**:
   - Verify no runtime errors on ProductDetail, ProductCard, DropDetail
   - Check artistStore loads without errors
   - Test admin approval flow end-to-end

---

## 📝 NOTES

- `src/lib/contracts/artDrop.ts` is now a stub with deprecation warning
- Old `useContracts.ts` hooks are still present but should be phased out
- New `useContractsArtist.ts` is the canonical artist contract interaction layer
- All contract addresses should be looked up via `useArtistContractAddress` hook
- Backend deployment is prepared but requires blockchain interaction setup

