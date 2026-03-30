# THEPOPUP - Mint & Drop Fetch Analysis

**Status**: Critical issues found in post-mint data refresh flow  
**Date**: March 22, 2026  
**Severity**: High - User-facing stale data issues

---

## Executive Summary

The minting flow completes successfully on-chain, but **the UI displays stale drop data after a successful mint**. The root cause is the **absence of a refetch mechanism** after mint transactions complete. Components show a success toast but never re-query drops from Supabase, leaving users with outdated inventory counts and status.

---

## 1. MINT TRANSACTION FLOW ✅

### 1.1 Where Minting is Initiated

**File**: [src/pages/Index.tsx](src/pages/Index.tsx#L199)  
**Lines**: 195-211

```typescript
const handleBuyDrop = async (drop: any) => {
  // Line 199: MINT IS CALLED HERE
  mint(drop.contractDropId, priceWei);
  toast({
    title: "Purchase Submitted",
    description: `Buying "${drop.title}" for ${drop.priceEth} ETH...`,
  });
};
```

**Also triggered in**: [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx#L137)  
**Lines**: 137-139

```typescript
const handleBuyDrop = () => {
  mint(drop.contractDropId, parseEther(priceEth.toString()));
};
```

### 1.2 The Mint Hook Implementation

**File**: [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L188-L225)  
**Function**: `useMintDrop()`

```typescript
export function useMintDrop() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (dropId: number, priceWei: bigint) => {
    console.log("🎨 Minting NFT:", { dropId, priceWei:... });
    
    writeContract({
      address: ART_DROP_ADDRESS,
      abi: ART_DROP_ABI,
      functionName: "mint",  // Calls contract.mint(dropId)
      args: [BigInt(dropId)],
      value: priceWei,  // ETH payment
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { mint, isPending, isConfirming, isSuccess, error, hash };
}
```

**What this does**:
- ✅ Validates wallet connection and drop ID
- ✅ Calls `writeContract()` with proper transaction params
- ✅ Returns `isSuccess` when transaction is confirmed on-chain
- ❓ **No event parsing** (unlike `useCreateDrop`)
- ❓ **No database update** mechanism
- ❓ **No refetch trigger** for drop data

### 1.3 Smart Contract Mint Function

**File**: [contracts/ArtDrop.sol](contracts/ArtDrop.sol#L122-L151)

```solidity
function mint(uint256 _dropId) external payable nonReentrant returns (uint256 tokenId) {
    Drop storage d = drops[_dropId];
    require(!d.paused, "Paused");
    require(block.timestamp >= d.startTime, "Not started");
    require(d.endTime == 0 || block.timestamp <= d.endTime, "Ended");
    require(d.maxSupply == 0 || d.minted < d.maxSupply, "Sold out");
    require(msg.value >= d.priceWei, "Insufficient ETH");

    tokenId = nextTokenId++;
    d.minted++;  // ← Updates on-chain counter
    tokenDrop[tokenId] = _dropId;
    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, d.metadataURI);

    // Split payment: platform fee → feeRecipient, remainder → artist
    uint256 fee = (msg.value * platformFeeBps) / 10_000;
    // ... fee distribution ...

    emit ArtMinted(_dropId, tokenId, msg.sender);  // ← Event emitted
}
```

**Contract behavior**:
- ✅ Increments `d.minted` counter on-chain
- ✅ Mints NFT to buyer
- ✅ Splits ETH payment
- ✅ Emits `ArtMinted` event
- ⚠️ **Does NOT update Supabase database**

---

## 2. THE CRITICAL GAP: Post-Mint Data Refresh ❌

### 2.1 Success Handler in Index.tsx

**File**: [src/pages/Index.tsx](src/pages/Index.tsx#L17-19)

```typescript
const { mint, isPending: isMinting, error: mintError } = useMintDrop();
```

**Problem**: No `useEffect` that depends on  `isMintSuccess` to refetch drops!

### 2.2 Success Handler in DropDetailPage.tsx

**File**: [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx#L95-96)

```typescript
useEffect(() => {
  if (isMintSuccess) toast.success("Drop purchased successfully!");
}, [isMintSuccess]);
```

**Problem**: Shows toast but does NOT refetch drops! 

### 2.3 Drop Fetching Hook Architecture

**File**: [src/hooks/useSupabase.ts](src/hooks/useSupabase.ts#L179-L202)

```typescript
export function useSupabaseLiveDrops() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const drops = await fetchLiveDropsFromSupabase();
      setData(drops);
    } catch (err) {
      // error handling...
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();  // ← Only runs ONCE on mount
  }, []);  // ← Empty dependency array!

  return { data, loading, error, refetch: fetchData };  // ← refetch available but NEVER CALLED
}
```

**Problems**:
- Fetches only ONCE on component mount (empty dependency array)
- Returns `refetch` function but no component calls it after mint
- Component state becomes stale immediately after transaction completes

### 2.4 How Index.tsx Uses the Hook

**File**: [src/pages/Index.tsx](src/pages/Index.tsx#L13-14)

```typescript
const { data: supabaseLiveDrops, loading: dropsLoading, error: dropsError } = useSupabaseLiveDrops();
```

**Missing code**:
```typescript
// THIS DOESN'T EXIST - causing the bug:
useEffect(() => {
  if (isMintSuccess) {
    refetch();  // Re-fetch drops after mint
  }
}, [isMintSuccess, refetch]);
```

### 2.5 Same Issue in DropDetailPage.tsx

**File**: [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx#L32-75)

```typescript
// Fetch drops ONCE on mount
useEffect(() => {
  if (!id) return;
  const cachedDrop = getDropById(id);
  if (cachedDrop && cachedDrop.sold !== undefined) {
    setDrop(cachedDrop);
    setIsLoading(false);
    return;
  }
  
  (async () => {
    const allDrops = await fetchAllDropsFromSupabase();
    const foundDrop = allDrops.find((d: any) => d.id === id);
    setDrop(foundDrop);
  })();
}, [id]);  // ← Only re-fetches if ID changes, not after mint

// Success handler - JUST SHOWS TOAST, NO REFETCH:
useEffect(() => {
  if (isMintSuccess) toast.success("Drop purchased successfully!");
}, [isMintSuccess]);
```

---

## 3. DROP FETCHING POINTS

### 3.1 All Drop Fetching Functions

| Function | File | Purpose | Updated After Mint? |
|----------|------|---------|-------------------|
| `fetchAllDropsFromSupabase()` | [src/lib/supabaseStore.ts#L152](src/lib/supabaseStore.ts#L152) | Fetch ALL drops | ❌ No |
| `fetchLiveDropsFromSupabase()` | [src/lib/supabaseStore.ts#L173](src/lib/supabaseStore.ts#L173) | Fetch drops where status='live' | ❌ No |
| `fetchDropsByArtistFromSupabase()` | [src/lib/supabaseStore.ts#L195](src/lib/supabaseStore.ts#L195) | Fetch drops by artist_id | ❌ No |

### 3.2 Implementation of fetchLiveDropsFromSupabase

**File**: [src/lib/supabaseStore.ts](src/lib/supabaseStore.ts#L173-L192)

```typescript
export async function fetchLiveDropsFromSupabase() {
  try {
    console.log("📖 Fetching live drops from Supabase...");
    const { data, error } = await supabase
      .from("drops")
      .select("`*, artists:artist_id(id, name, avatar_url)`")
      .eq("status", "live")  // ← Only live drops
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} live drops from Supabase`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchLiveDropsFromSupabase failed:", error.message);
    throw error;
  }
}
```

**Problems**:
- ✅ Query works fine
- ❌ But NEVER called again after mint completes
- ❌ No listener mechanism for contract events
- ❌ No polling/subscription to DB changes

---

## 4. TIMING & RACE CONDITION ISSUES ⚠️

### 4.1 Transaction Confirmation vs DB Update

**Timeline**:

```
1. User clicks "Buy Now" in Index.tsx (line 195)
   ↓
2. mint() called with contractDropId
   ↓
3. Transaction submitted to blockchain (isPending = true)
   ↓
4. ⏱️ ~15-30 seconds later: Transaction confirmed on-chain
   ↓
5. isConfirming = false, isSuccess = true
   ↓
6. Toast shows: "Drop purchased successfully!" ✅
   ↓
7. ❌ BUT: supabase drops data is NOT refreshed
   ↓
8. User still sees OLD drop.bought count (not incremented)
   ↓
9. User may think purchase failed and try again
   ↓
10. OR user refreshes page manually to see updated data
```

### 4.2 Blockchain vs Supabase Update

```
ArtDrop Contract (on-chain)
├─ d.minted counter incremented IMMEDIATELY when tx confirmed
├─ Event emitted: ArtMinted(dropId, tokenId, collector)
└─ ✅ Data is LIVE

Supabase drops table
├─ solved/bought field is NOT updated by contract
├─ Would need external indexer (Graph Protocol) or webhook
├─ ❌ Data stays STALE until someone calls updateDrop()
└─ Manual refresh required
```

### 4.3 No Database Update Mechanism

The contract mint function does NOT:
- Write to Supabase
- Trigger a webhook
- Emit a cross-chain event
- Call an oracle

The app does NOT:
- Listen to ArtMinted event
- Decode and parse the event
- Update Supabase drop.sold count
- Trigger refetch on UI

---

## 5. ERROR HANDLING & FALLBACKS

### 5.1 What Happens on Mint Failure

**File**: [src/pages/Index.tsx](src/pages/Index.tsx#L218-237)

```typescript
// Listen for mint errors and clear state
useEffect(() => {
  if (mintError && mintingDropId) {
    console.error("❌ Transaction error:", mintError);
    toast({
      title: "Transaction Failed",
      description: mintError.message || "Transaction was rejected",
      variant: "destructive",
    });
    setMintingDropId(null);
  }
}, [mintError, mintingDropId, toast]);
```

✅ **Error handling is GOOD** - users see error toast if tx fails

### 5.2 What Happens on Mint Success

**File**: [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx#L95-96)

```typescript
useEffect(() => {
  if (isMintSuccess) toast.success("Drop purchased successfully!");
}, [isMintSuccess]);
```

❌ **Success handling is INCOMPLETE** - shows toast but doesn't verify drop was actually added to user's collection or update UI

### 5.3 No Verification of Purchase

After mint succeeds, there's NO:
- Check that user's NFT balance increased
- Check that drop.minted counter increased
- Check that drop appears in user's collection
- Check that drop inventory updated
- Query to verify transaction on-chain

---

## 6. ROOT CAUSE ANALYSIS

### 6.1 Primary Issues

1. **No Post-Mint Refetch**
   - File: [src/pages/Index.tsx](src/pages/Index.tsx#L17-19) - missing useEffect with isMintSuccess dependency
   - File: [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx#L95-96) - shows toast but no refetch
   - Impact: Drop data becomes stale immediately after successful mint

2. **No Event Listeners**
   - File: [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L188-225) - useMintDrop has no event parsing
   - Compare to: [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L96-187) - useCreateDrop DOES parse DropCreated event (lines 170-180)
   - Impact: Cannot detect when ArtMinted event fires to trigger data updates

3. **No Database Update Trigger**
   - File: [contracts/ArtDrop.sol](contracts/ArtDrop.sol#L122-151) - mint() doesn't update Supabase
   - File: [src/lib/supabaseStore.ts](src/lib/supabaseStore.ts#L1-300) - no webhook listener for contract events
   - Impact: Supabase drop.sold field never incremented after on-chain mint

4. **Stale Component State**
   - File: [src/hooks/useSupabase.ts](src/hooks/useSupabase.ts#L179) - useSupabaseLiveDrops fetches once on mount
   - File: [src/hooks/useSupabase.ts](src/hooks/useSupabase.ts#L200) - empty dependency array prevents refetch
   - Impact: Component continues showing initial data even after DB changes

### 6.2 Secondary Issues

- No polling mechanism to periodically refresh drops
- No real-time subscriptions to Supabase changes
- No Graph Protocol integration to index contract state
- No manual refresh button visible to users
- No indication that data might be stale

---

## 7. USER-FACING SYMPTOMS

### 7.1 What Users Experience

1. **During Purchase**:
   - ✅ User clicks "Buy Now"
   - ✅ Wallet confirms transaction
   - ✅ Toast appears: "Drop purchased successfully!"

2. **After Purchase** (The Problem):
   - ❌ Drop still shows same `remaining` count (not decremented)
   - ❌ Drop still shows same `bought` count (not incremented)
   - ❌ Drop status unchanged (should it be "sold out" if fully minted?)
   - ❌ Inventory bar doesn't reflect new purchase
   - ❌ No indication in UI that NFT was actually minted
   - ❌ User doesn't see NFT in "My Collection" page

3. **If User Doesn't Refresh**:
   - Stale data persists indefinitely
   - User may attempt second purchase thinking first failed
   - Could duplicate mint attempts

4. **After Manual Refresh** (F5):
   - Component remounts
   - useSupabaseLiveDrops() runs again
   - Fresh data fetched from Supabase
   - UI updates with correct counts

---

## 8. WHY useCreateDrop WORKS BUT useMintDrop DOESN'T

### 8.1 useCreateDrop (WORKING) ✅

**File**: [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L96-187)

```typescript
export function useCreateDrop() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createDrop = (...) => { writeContract(...); };

  // ✅ PARSES CONTRACT EVENT:
  const createdDropId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "DropCreated") return null;
          console.log("✅ Drop created with ID:", decoded.args.dropId);  // ← Event data extracted!
          return Number(decoded.args.dropId);
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { createDrop, createdDropId, isPending, isConfirming, isSuccess, error, hash };
}
```

**Why it works**:
- Decodes transaction receipt logs
- Extracts `DropCreated` event data
- Returns `createdDropId` for caller to use
- Caller can then update database or UI immediately
- ArtistStudioPage uses this to save drop to Supabase

**File**: [src/pages/ArtistStudioPage.tsx](src/pages/ArtistStudioPage.tsx#L222-269)

```typescript
useEffect(() => {
  if (!isSuccess || createdDropId === null || !pendingResult?.metadataUri) return;
  
  // Save to database IMMEDIATELY after contract confirmation:
  const saveDropToDatabase = async () => {
    try {
      const result = await createDrop({
        // ← Takes createdDropId from contract event
        contract_drop_id: createdDropId,
        // ... other fields ...
      });
      toast.success("Drop created and saved!");
    } catch (error) {
      toast.error("Drop created but failed to save to database.");
    }
  };

  saveDropToDatabase();
}, [createdDropId, form, isSuccess, pendingResult]);
```

### 8.2 useMintDrop (BROKEN) ❌

**File**: [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L188-225)

```typescript
export function useMintDrop() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (dropId: number, priceWei: bigint) => {
    // ... validation ...
    writeContract({...});
  };

  // ❌ NO EVENT PARSING!
  // ❌ NO return of decoded data!
  return { mint, isPending, isConfirming, isSuccess, error, hash };
}
```

**Why it doesn't work**:
- No event decoding from receipt
- No `createdTokenId` or `mintConfirmed` data returned
- Caller gets `isSuccess` but doesn't know WHAT succeeded
- No mechanism to update database after success
- No data passed back to trigger refetch

---

## 9. DETAILED FINDINGS TABLE

| Aspect | Status | Details |
|--------|--------|---------|
| **Mint Transaction Execution** | ✅ Works | Contract.mint() executes successfully, increments on-chain counter |
| **Transaction Confirmation** | ✅ Works | wagmi hook detects tx confirmation and sets isSuccess=true |
| **Success Toast** | ✅ Works | User sees "Drop purchased successfully!" message |
| **Event Emission** | ✅ Works | Contract emits ArtMinted(dropId, tokenId, collector) event |
| **Event Parsing** | ❌ Broken | useMintDrop doesn't decode ArtMinted event from receipt |
| **Database Update** | ❌ Broken | Supabase drop.sold field not updated after mint |
| **UI Data Refresh** | ❌ Broken | Index.tsx & DropDetailPage.tsx don't refetch drops after mint |
| **Inventory Display** | ❌ Broken | Drop.remaining shows stale value, not decremented |
| **User Notification** | ⚠️ Misleading | Toast says "purchased" but UI shows old data |
| **Manual Refresh** | ✅ Works | Page F5 reload fetches fresh data and shows correct state |
| **Auto-Refetch** | ❌ Missing | No automatic refresh, user must refresh manually |
| **Polling** | ❌ Missing | No mechanism to check contract state periodically |
| **Real-time Updates** | ❌ Missing | No websocket subscriptions to Supabase changes |
| **Collection Update** | ❌ Broken | MyCollectionPage doesn't show newly minted NFT without refresh |

---

## 10. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "BUY NOW" (Index.tsx line 195 / DropDetailPage)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │ handleBuyDrop() is called         │
        │ - Validates drop has contractDropId
        │ - Calls mint(contractDropId, priceWei)
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────────┐
        │ useMintDrop() - useContracts.ts              │
        │ - writeContract() to blockchain              │
        │ - Awaits transaction confirmation            │
        │ - Returns: isPending, isConfirming, isSuccess│
        │ ❌ BUT: Does NOT decode ArtMinted event     │
        │ ❌ Does NOT trigger database update          │
        └──────────────┬───────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
 ┌─────────┐    ┌──────────┐      ┌─────────────┐
 │ Pending │    │Confirming│      │ Success ✓   │
 │ ~5-10s  │───▶│ ~10-20s  │─────▶│ isSuccess=1 │
 └─────────┘    └──────────┘      └─────────────┘
                                         │
                                         ▼
        ┌────────────────────────────────────┐
        │ useEffect triggers (Index.tsx L23) │
        │ if (isMintSuccess) {               │
        │   toast.success("Purchased!")      │  ✅ Shows toast
        │   // ❌ MISSING: refetch drops!   │
        │ }                                   │
        └────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────┐
    │ PROBLEM: Component state unchanged    │
    │ - setLiveDrops still has old data     │
    │ - drop.bought NOT incremented         │
    │ - drop.remaining NOT decremented      │
    │ - UI shows stale information          │
    └───────────────────────────────────────┘


MEANWHILE IN THE BLOCKCHAIN & DATABASE:
├─ Contract: drop.minted ++ (updated LIVE)
├─ Supabase: drop.sold still = old value ❌
│  (Would need external indexer or webhook)
└─ Graph Protocol: Could mirror state but not integrated


WHAT SHOULD HAPPEN:
┌────────────────────────────────────────┐
│ if (isMintSuccess) {                    │
│   // Show success message               │
│   toast.success("Purchased!");          │
│                                         │
│   // RE-FETCH drop data from Supabase  │
│   refetch();  // ← MISSING!             │
│ }                                       │
│                                         │
│ OR Parse event and update directly:     │
│ const decoded = decodeEventLog(         │
│   receipt.logs,                         │
│   ART_DROP_ABI                          │
│ );                                      │
│ setDrop(prev => ({                      │
│   ...prev,                              │
│   bought: prev.bought + 1,  // ← Update│
│   minted: decoded.args.tokenId,  ← New │
│ }));                                    │
└────────────────────────────────────────┘
```

---

## 11. DETAILED CODE LOCATIONS

### 11.1 Files That NEED Changes

| File | Issue | Line(s) | Solution |
|------|-------|---------|----------|
| [src/pages/Index.tsx](src/pages/Index.tsx) | No refetch after mint | ~17-19, ~95-96 | Add useEffect with isMintSuccess dependency to call refetch() |
| [src/pages/DropDetailPage.tsx](src/pages/DropDetailPage.tsx) | No refetch after mint | ~19, ~95-96 | Add refetch() call after mint succeeds |
| [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L188-225) | No event parsing in useMintDrop | ~170-220 | Add event decoding like useCreateDrop does (lines 170-180) |
| [src/hooks/useSupabase.ts](src/hooks/useSupabase.ts#L179) | Hook not exported with refetch | ~201 | Ensure hook returns refetch function |

### 11.2 Files That Are WORKING Correctly

| File | Function | Line(s) |
|------|----------|---------|
| [contracts/ArtDrop.sol](contracts/ArtDrop.sol#L122-151) | mint() function | ~122-151 |
| [src/lib/contracts/artDrop.ts](src/lib/contracts/artDrop.ts#L79) | ArtMinted event definition | ~79-83 |
| [src/lib/supabaseStore.ts](src/lib/supabaseStore.ts#L173-192) | fetchLiveDropsFromSupabase() | ~173-192 |
| [src/hooks/useSupabase.ts](src/hooks/useSupabase.ts#L179-202) | useSupabaseLiveDrops() | ~179-202 |
| [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L96-187) | useCreateDrop() (reference) | ~96-187 |

---

## 12. RECOMMENDED FIXES

### Fix 1: Add Refetch After Mint in Index.tsx

```typescript
// Add this after the mint error handler
useEffect(() => {
  if (isMintSuccess) {
    toast.success("Drop purchased successfully!");
    
    // Re-fetch drops to show updated inventory
    const refreshDrops = async () => {
      const freshDrops = await fetchLiveDropsFromSupabase();
      setLiveDrops(freshDrops.map(drop => {
        // ... transform data ...
      }));
    };
    
    refreshDrops().catch(err => {
      console.error("Failed to refresh drops:", err);
      // Still show success even if refresh fails
    });
  }
}, [isMintSuccess]);
```

### Fix 2: Add Event Parsing to useMintDrop

```typescript
export function useMintDrop() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { 
    data: receipt,
    isLoading: isConfirming, 
    isSuccess 
  } = useWaitForTransactionReceipt({ hash });

  const mint = (dropId: number, priceWei: bigint) => {
    // ... existing code ...
  };

  // ✅ NEW: Decode ArtMinted event
  const mintedTokenId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "ArtMinted") return null;
          return Number(decoded.args.tokenId);
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { mint, isPending, isConfirming, isSuccess, error, hash, mintedTokenId };
}
```

### Fix 3: Add Manual Refetch in DropDetailPage

```typescript
useEffect(() => {
  if (isMintSuccess) {
    toast.success("Drop purchased successfully!");
    
    // Refetch the specific drop to show updated counts
    (async () => {
      try {
        const allDrops = await fetchAllDropsFromSupabase();
        const updated = allDrops.find((d: any) => d.id === id);
        if (updated) {
          setDrop({
            // ... transform ...
          });
        }
      } catch (err) {
        console.warn("Failed to refresh drop:", err);
      }
    })();
  }
}, [isMintSuccess, id]);
```

---

## 13. TESTING RECOMMENDATIONS

### Test Case 1: Verify Mint Success Toast
```
1. Open Index.tsx or DropDetailPage
2. Click "Buy Now" on a drop
3. Approve wallet transaction
4. Wait for confirmation
5. ✅ Check: "Drop purchased successfully!" toast appears
6. ❌ FAILS: Toast shows but inventory doesn't update
```

### Test Case 2: Check Inventory Update
```
1. Open Index.tsx, note current drop "remaining" value (e.g., 5)
2. Click "Buy Now"
3. Complete transaction  
4. ❌ FAILS: "remaining" still shows 5 (stale data)
5. ✅ PASS: After F5 refresh, shows 4
```

### Test Case 3: Verify On-Chain State
```
1. Use Etherscan/BaseScan to check contract
2. Verify drop.minted counter increased
3. ✅ PASS: Contract shows new minted count
4. But UI shows old count (stale Supabase data)
```

### Test Case 4: Check Collection Page
```
1. Mint NFT from drop
2. Go to "My Collection" page
3. ❌ FAILS: New NFT not visible until page refresh
```

---

## 14. SUMMARY OF FINDINGS

### Critical Issues (Must Fix Before Production)

1. **No Post-Mint Refetch** ⚠️ CRITICAL
   - After mint succeeds, drops data not refreshed
   - Users see stale inventory counts
   - Misleading "Purchased successfully" with no UI update

2. **No Event Decoding** ⚠️ HIGH
   - useMintDrop doesn't parse ArtMinted event
   - No way to know which tokenId was minted
   - Can't update database with transaction results

3. **No Database Update Trigger** ⚠️ HIGH
   - Supabase drop.sold never incremented
   - Contract state != Database state
   - Would need webhook/indexer integration

### Secondary Issues (Should Address)

4. No user feedback that NFT was minted (doesn't appear in collection)
5. No verification that purchase actually completed
6. No polling mechanism for stale data
7. No error recovery if refetch fails
8. No indication to user that data might be stale

### What's Working

✅ Mint transaction executed successfully  
✅ Transaction confirmed on blockchain  
✅ NFT minted and owned by user  
✅ ETH payment splitting works  
✅ Success toast displays  

---

## 15. FILES TO MODIFY

Priority order:

1. **src/pages/Index.tsx** - Add refetch on isMintSuccess
2. **src/pages/DropDetailPage.tsx** - Add refetch on isMintSuccess
3. **src/hooks/useContracts.ts** - Add event decoding to useMintDrop
4. Optional: Add Graph Protocol indexer for real-time state
5. Optional: Add Supabase webhook for contract events

---

## References

- **Mint Flow**: [useContracts.ts](src/hooks/useContracts.ts#L188-225)
- **Success Handler**: [Index.tsx](src/pages/Index.tsx#L95-96)
- **Drop Fetching**: [useSupabase.ts](src/hooks/useSupabase.ts#L179-202)
- **Supabase Queries**: [supabaseStore.ts](src/lib/supabaseStore.ts#L150-212)
- **Contract**: [ArtDrop.sol](contracts/ArtDrop.sol#L122-151)
- **Event Definition**: [artDrop.ts ABI](src/lib/contracts/artDrop.ts#L79-83)

