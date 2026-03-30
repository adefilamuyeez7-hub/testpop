# COMPREHENSIVE SECURITY & CODE QUALITY AUDIT
## THEPOPUP Platform - Complete Analysis

**Audit Date:** March 23, 2026  
**Auditor:** GitHub Copilot  
**Status:** ⚠️ NOT READY FOR PRODUCTION

---

## EXECUTIVE SUMMARY

This audit identifies **6 CRITICAL**, **5 HIGH PRIORITY**, **5 MEDIUM PRIORITY**, and **5 LOW PRIORITY** issues across the POPUP platform's smart contracts, database, and frontend code.

**⛔ CRITICAL:** Platform cannot launch with these issues. Several represent complete feature failures and fund loss vectors.

**Estimated Fix Time:** 20-25 hours for all critical and high-priority items.

---

# CRITICAL ISSUES (Must Fix Before Mainnet)

## 1. POAPCampaign - Denial of Service via Unsorted Bids Array

**File:** [contracts/POAPCampaign.sol](contracts/POAPCampaign.sol#L165-L210)  
**Function:** `settleAuction()`  
**Severity:** 🔴 CRITICAL

### The Problem

The contract uses an O(n²) bubble sort without any limit on the number of bids:

```solidity
// Simple sort descending by amount (fine for small arrays)
for (uint256 i = 0; i < bids.length; i++) {
    for (uint256 j = i + 1; j < bids.length; j++) {
        if (bids[j].amount > bids[i].amount) {
            Bid memory tmp = bids[i];
            bids[i] = bids[j];
            bids[j] = tmp;
        }
    }
}
```

### Attack Vector

An attacker places 10,000 tiny bids (~0.001 ETH each) before settlement. When `settleAuction()` is called:
- Comparison operations: 10,000² = **100 million** comparisons
- Each comparison: ~50 gas
- **Total gas: 5+ billion (impossible on Base chain)**
- Settlement reverts, campaign stuck permanently

### Impact

- ❌ Entire POAP auction feature becomes unusable
- ❌ Artist cannot settle campaigns
- ❌ User funds locked in contract
- ❌ No way to recover

### Recommended Fix

```solidity
function settleAuction(uint256 _campaignId) external nonReentrant {
    // Add protection against large bid arrays
    require(campaignBids[_campaignId].length <= 1000, "Too many bids for settlement");
    
    // ... rest of function
    
    // Use off-chain sorting:
    // 1. Calculate winners off-chain deterministically
    // 2. Artist provides proof (merkle tree or similar)
    // 3. Contract verifies and distributes
}
```

**Or implement cap on bids per campaign:**

```solidity
function placeBid(uint256 _campaignId) external payable nonReentrant {
    require(campaignBids[_campaignId].length < 100, "Bid limit reached");
    // ...
}
```

**Priority:** 🔴 CRITICAL - Fix immediately

---

## 2. Supabase - Completely Open RLS (Row Level Security) Policies

**File:** [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql#L178-L208)  
**Severity:** 🔴 CRITICAL - **Complete Data Breach**

### The Problem

All database tables have dangerously permissive RLS policies:

```sql
-- Artists table
CREATE POLICY "artists_read_all" ON artists FOR SELECT USING (true);
CREATE POLICY "artists_write_all" ON artists FOR INSERT WITH CHECK (true);
CREATE POLICY "artists_update_all" ON artists FOR UPDATE USING (true);

-- Drops table  
CREATE POLICY "drops_read_all" ON drops FOR SELECT USING (true);
CREATE POLICY "drops_write_all" ON drops FOR INSERT WITH CHECK (true);

-- Products, Orders, Analytics - SAME OPEN POLICY FOR ALL
```

### What This Means

- ✗ **Any authenticated user can read all data** (all artists, drops, orders)
- ✗ **Any user can modify any artist's profile** (name, wallet, contract address)
- ✗ **Any user can create/delete drops** (not just their own)
- ✗ **Any user can modify order status** (mark orders as shipped without fulfilling)
- ✗ **Any user can insert fake analytics data**
- ✗ **Entire subscription tracking exposed**

### Real-World Attack Scenario

```sql
-- Attacker modifies artist records
UPDATE artists 
SET contract_address = '0xattacker_contract'
WHERE handle = 'famous_artist';

-- All subsequent transactions go to attacker's wallet

-- OR modify products
UPDATE products
SET price_eth = 0.001  -- Massive discount
WHERE creator_wallet = 'target_artist';

-- OR create orders
INSERT INTO orders (product_id, buyer_wallet, status)
VALUES ('product_id', 'attacker', 'paid');
-- Payment never received, attacker gets product
```

### Impact

- 🔴 **COMPLETE DATABASE BREACH**
- 🔴 **Financial Loss** - Orders fraudulently marked as paid
- 🔴 **Artist Data Theft** - Wallet addresses, images, metadata stolen/modified
- 🔴 **Contract Migration** - Attacker redirects drops to their contracts
- 🔴 **Revenue Theft** - Artist drops configured to send funds to attacker

### Recommended Fix

Replace ALL policies with proper wallet-based authorization:

```sql
-- Artists can only read/update their own record
CREATE POLICY "artists_read_own" ON artists 
FOR SELECT USING (
    wallet = auth.jwt() ->> 'sub'::text
);

CREATE POLICY "artists_update_own" ON artists 
FOR UPDATE USING (
    wallet = auth.jwt() ->> 'sub'::text
);

-- Artists can only read their own drops
CREATE POLICY "drops_read_own" ON drops 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM artists 
        WHERE artists.id = drops.artist_id 
        AND artists.wallet = auth.jwt() ->> 'sub'::text
    )
);

-- Only order creator and store owner can see order
CREATE POLICY "orders_read_own" ON orders 
FOR SELECT USING (
    buyer_wallet = auth.jwt() ->> 'sub'::text
    OR EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = orders.product_id 
        AND products.creator_wallet = auth.jwt() ->> 'sub'::text
    )
);
```

**Priority:** 🔴 CRITICAL - Fix IMMEDIATELY before any deployment

---

## 3. ArtistSharesToken - Lost Investor Funds

**File:** [contracts/ArtistSharesToken.sol](contracts/ArtistSharesToken.sol#L135-L155)  
**Function:** `closeCampaign()`  
**Severity:** 🔴 CRITICAL - **Permanent Fund Loss**

### The Problem

When a fundraising campaign fails to reach its target, the code intends to refund investors but **doesn't actually track or refund anyone**:

```solidity
function closeCampaign() external {
    require(msg.sender == artist, "Only artist");
    require(campaign.active, "No active campaign");

    campaign.active = false;
    campaign.closed = true;

    bool successful = campaign.amountRaised >= campaign.targetAmount;
    emit CampaignEnded(campaign.amountRaised, successful);

    // If unsuccessful, refund all investors
    if (!successful) {
        uint256 toReturn = campaign.amountRaised;
        campaign.amountRaised = 0;

        // ❌ PROBLEM: Empty investor list!
        address[] memory shareholders = new address[](0);
        // For now, allow artist to refund manually via refundInvestors()
        // ↑ Function doesn't exist!
    }
}
```

### The Issue

1. **No investor tracking** - The contract never records who invested
2. **Empty refund array** - `shareholders` is initialized as empty `new address[](0)`
3. **No fallback mechanism** - `refundInvestors()` doesn't exist
4. **Funds locked forever** - Contract holds the ETH with no way to withdraw

### Example Scenario

1. Artist launches campaign: raise 10 ETH in 30 days
2. Only raises 8 ETH (short by 2 ETH)
3. campaign.closeCampaign() is called
4. Campaign marked as failed ✓
5. 8 ETH held in contract ready to refund
6. **But no refunds actually happen** ✗
7. Each of 10 investors tries to claim - no tracking exists
8. **8 ETH permanently lost**

### Impact

- 🔴 **Complete loss of failed campaign funds**
- 🔴 **No recovery mechanism**
- 🔴 **Investors cannot retrieve their ETH**
- 🔴 **Artist cannot access other artist's failed campaign funds**
- 🔴 **Legal liability** - Holding other people's money without return

### Recommended Fix

Implement proper investor tracking:

```solidity
contract ArtistSharesToken is ERC20, Ownable, ReentrancyGuard {
    // Track all investors and their amounts
    address[] public investors;
    mapping(address => uint256) public investmentAmount;
    mapping(address => bool) public hasInvested;

    function buyShares(uint256 _amountEth) external payable nonReentrant {
        // ... existing validation ...

        // Track investor
        if (!hasInvested[msg.sender]) {
            investors.push(msg.sender);
            hasInvested[msg.sender] = true;
        }
        investmentAmount[msg.sender] += _amountEth;

        // ... rest of function ...
    }

    function closeCampaign() external {
        require(msg.sender == artist, "Only artist");
        require(campaign.active, "No active campaign");

        campaign.active = false;
        campaign.closed = true;

        bool successful = campaign.amountRaised >= campaign.targetAmount;
        emit CampaignEnded(campaign.amountRaised, successful);

        // If unsuccessful, refund all investors
        if (!successful) {
            for (uint i = 0; i < investors.length; i++) {
                address investor = investors[i];
                uint256 amount = investmentAmount[investor];
                if (amount > 0) {
                    investmentAmount[investor] = 0;
                    (bool ok, ) = investor.call{value: amount}("");
                    if (!ok) {
                        pendingWithdrawals[investor] += amount;
                    }
                }
            }
            campaign.amountRaised = 0;
        }
    }
}
```

**Priority:** 🔴 CRITICAL - Blocks all share campaigns from launching

---

## 4. Frontend - Major Smart Contract ABI Mismatch

**File:** [src/lib/contracts/artDrop.ts](src/lib/contracts/artDrop.ts#L41-L47)  
**Severity:** 🔴 CRITICAL - **All subscription calls fail**

### The Problem

The ABI shows the `subscribe` function taking **no parameters**:

```typescript
{
  type: "function",
  name: "subscribe",
  inputs: [],  // ← EMPTY! Should contain artist address
  outputs: [],
  stateMutability: "payable",
}
```

But the actual contract requires an artist address:

```solidity
// contracts/ArtDropArtist.sol
function subscribe() external payable nonReentrant {
    // ↑ Old version took no params
    require(msg.value >= minSubscriptionFee, "Below minimum subscription fee");
    // ...
}

// contracts/ArtDrop.sol (Factory version)  
function subscribe(address artist) external payable nonReentrant {
    // ↑ New version requires artist parameter
    require(artist != address(0), "Invalid artist address");
    // ...
}
```

### Confusion in Codebase

There are **two versions of ArtDrop**:
1. **ArtDropArtist.sol** - Individual contract per artist (no artist param needed)
2. **ArtDrop.sol** - Master contract for all artists (needs artist param)

The ABI doesn't specify which one, and the frontend code inconsistently mixes them.

### Impact When Calling Subscribe

**Frontend code attempts:**
```typescript
writeContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "subscribe",
    args: [validatedArtist],  // ← Trying to pass artist
    value: weiAmount,
})
```

**If using Master contract:** Works ✓  
**If using Artist-specific contract:** Fails with "Too many arguments" ✗  
**Result:** **Subscription feature completely broken**

### Recommended Fixes

**Option A: Align to Artist-specific contracts (Recommended)**

```typescript
// src/lib/contracts/artDrop.ts - for Artist-specific contract
{
  type: "function",
  name: "subscribe",
  inputs: [],  // No artist param - already scoped to this contract
  outputs: [],
  stateMutability: "payable",
}

// In hooks - NO artist parameter needed
writeContract({
    address: artistContractAddress,  // Contract already knows the artist
    abi: ART_DROP_ABI,
    functionName: "subscribe",
    args: [],  // Empty - already scoped
    value: weiAmount,
})
```

**Option B: Use Master contract**

```typescript
// Update ABI
{
  type: "function",
  name: "subscribe",
  inputs: [{ name: "artist", type: "address" }],
  outputs: [],
  stateMutability: "payable",
}

// Contract should be global factory contract
export const ART_DROP_ADDRESS = FACTORY_ADDRESS; // Single address for all
```

**Priority:** 🔴 CRITICAL - **Breaks entire subscription feature**

---

## 5. Frontend - Missing Critical ABI Functions

**File:** [src/lib/contracts/artDrop.ts](src/lib/contracts/artDrop.ts)  
**Severity:** 🔴 CRITICAL - **Runtime errors in UI**

### The Problem

The ABI is incomplete. These functions are called from frontend code but missing from the ABI:

```typescript
// Called in useSubscriptionTimers.ts (line 45-65)
"getSubscriptionTimeRemaining"  // ← MISSING

// Called in ArtistStudioPage.tsx  
"getUniqueSubscriberCount"      // ← MISSING  

// Called in useSubscriptionTimers.ts (line 25-35)
"isSubscriptionActive"           // ← MISSING

// Called in useSubscribeArtist hook
"minSubscriptionFee"             // ← MISSING
```

### Impact

When frontend tries to call these:

```typescript
const { data } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,  // Missing function definition
    functionName: "getSubscriptionTimeRemaining",  // Not in ABI!
    args: [artist, subscriber],
});
// Result: Contract call fails, returns undefined
// UI shows broken/loading forever
```

### Functions Missing from ABI

1. **`getSubscriptionTimeRemaining(address artist, address subscriber) → uint256`**
   - Returns seconds remaining on subscription
   - Used by [useSubscriptionTimers.ts](src/hooks/useSubscriptionTimers.ts#L50)
   - Needed for countdown display

2. **`getUniqueSubscriberCount(address artist) → uint256`**
   - Returns subscriber count
   - Likely used in artist analytics
   - Needed for leaderboards

3. **`isSubscriptionActive(address artist, address subscriber) → bool`**
   - Checks if subscription hasn't expired
   - Used for access control
   - Needed for gate content

4. **`minSubscriptionFee(address artist) → uint256`**
   - Minimum fee required
   - Used for pricing display
   - Needed for checkout

5. **`subscriptionExpiry(address artist, address subscriber) → uint256`**
   - Returns expiry timestamp
   - Used for renewal reminders

### Recommended Fix

Add missing functions to ABI:

```typescript
// In src/lib/contracts/artDrop.ts, add to ABI array:

{
  type: "function",
  name: "getSubscriptionTimeRemaining",
  inputs: [
    { name: "_subscriber", type: "address" }
  ],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
},

{
  type: "function",
  name: "getSubscriberCount",
  inputs: [],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
},

{
  type: "function",
  name: "isSubscriptionActive",
  inputs: [{ name: "_subscriber", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
  stateMutability: "view",
},

{
  type: "function",
  name: "getSubscriptionAmount",
  inputs: [{ name: "_subscriber", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
},

{
  type: "function",
  name: "minSubscriptionFee",
  inputs: [],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
},
```

**Priority:** 🔴 CRITICAL - **Breaks subscription UI completely**

---

## 6. Frontend - Hardcoded Contract Address Not Per-Artist

**File:** [src/lib/contracts/artDrop.ts](src/lib/contracts/artDrop.ts#L1)  
**Severity:** 🔴 CRITICAL - **Wrong contract targets**

### The Problem

```typescript
export const ART_DROP_ADDRESS = "0xf5bedee37de384305a29d2af644d358c5958e15a" as const;
```

This is a **single, global hardcoded address**. But based on the contracts:

- **ArtDropFactory** deploys a **unique ArtDrop contract for each artist**
- Each artist should interact with their own contract
- Using the same address for all artists means:
  - All subscriptions go to wrong artist
  - All mints credited to wrong artist  
  - Revenue routing broken

### The Real Architecture

```
ArtDropFactory (deployed once)
    ├─ deploys → ArtDrop #1 (for artist A)
    ├─ deploys → ArtDrop #2 (for artist B)  
    └─ deploys → ArtDrop #3 (for artist C)

Database: artists table
    artist_a → contract: 0xaaa...
    artist_b → contract: 0xbbb...
    artist_c → contract: 0xccc...

Frontend currently uses:
    ALL ARTISTS → 0xf5bedee... (WRONG!)
```

### Problems This Causes

1. **Subscription Revenue Goes to Wrong Place**
   ```
   User subscribes to artist_a
   → Calls contract at 0xf5bedee... (artist_c's actual contract)
   → Payment goes to artist_c
   → artist_a gets nothing
   ```

2. **Drop Minting Revenue Routing**
   ```
   User buys NFT from artist_a
   → Routed to wrong contract
   → Revenue split wrong
   ```

3. **Data Inconsistency**
   ```
   Contract state on chain: artist_c has 100 subscribers
   Frontend displays: artist_a's subscriber count (actually belongs to artist_c)
   ```

### Recommended Fix

Fetch per-artist contract address from database:

```typescript
// src/lib/contracts/artDrop.ts
// Remove hardcoded address
// export const ART_DROP_ADDRESS = "0xf5bedee..."; // DELETE THIS

// In components/hooks that need the address:
import { useArtistContractAddress } from "@/hooks/useArtistContractAddress";

export function useMintDrop(artistAddress: string) {
  const contractAddress = useArtistContractAddress(artistAddress);
  const { writeContract, data: hash } = useWriteContract();

  const mint = (dropId: number, priceWei: bigint) => {
    if (!contractAddress) {
      throw new Error("Artist contract not deployed");
    }
    
    return writeContract({
      address: contractAddress,  // Dynamic per-artist
      abi: ART_DROP_ABI,
      functionName: "mint",
      args: [BigInt(dropId)],
      value: priceWei,
    });
  };

  return { mint, /* ... */ };
}

// Create new hook to fetch artist contract:
// src/hooks/useArtistContractAddress.ts
export function useArtistContractAddress(artistAddress: string) {
  const { data: artist } = useQuery({
    queryKey: ["artist", artistAddress],
    queryFn: async () => {
      const { data } = await supabase
        .from("artists")
        .select("contract_address")
        .eq("wallet", artistAddress)
        .single();
      return data;
    },
    enabled: !!artistAddress,
  });

  return artist?.contract_address;
}
```

**Priority:** 🔴 CRITICAL - **Breaks entire transaction routing**

---

---

# HIGH PRIORITY ISSUES (Should Fix Before Production)

## 1. ArtistSharesToken - Precision Loss in Revenue Distribution

**File:** [contracts/ArtistSharesToken.sol](contracts/ArtistSharesToken.sol#L235-L250)  
**Function:** `claimRevenue()`  
**Severity:** 🟠 HIGH - **Users lose ETH over time**

### The Problem

```solidity
function claimRevenue() external nonReentrant {
    uint256 holderShares = balanceOf(msg.sender);
    require(holderShares > 0, "No shares");

    // ❌ TWO divisions compound precision loss
    uint256 holderPct = (holderShares * 1e18) / totalSupply();     // First division
    uint256 claimableAmount = (totalRevenueDistributed * holderPct) / 1e18;  // Second division
    uint256 alreadyClaimed = claimedRevenue[msg.sender];
    uint256 available = claimableAmount - alreadyClaimed;

    require(available > 0, "Nothing to claim");
    claimedRevenue[msg.sender] = claimableAmount;

    (bool ok, ) = msg.sender.call{value: available}("");
    require(ok, "Transfer failed");
}
```

### The Math Problem

**Example with real numbers:**

```
Shareholders: 
- Alice: 1/3 of shares
- Bob: 1/3 of shares  
- Carol: 1/3 of shares

Revenue first distribution: 1 ETH (10^18 wei)  
Expected per person: 1/3 ETH = 333,333,333,333,333,333 wei

Alice's calculation:
holderPct = (shares * 1e18) / totalShares = (shares * 1e18) / (3 * shares)
         = 1e18 / 3 = 333,333,333,333,333,333

claimableAmount = (10^18 * 333,333,333,333,333,333) / 1e18
                = 10^18 * (1/3)
                ≈ 333,333,333,333,333,333 wei ✓ Looks good

BUT if distributing 3 ETH total over time:
Revenue 1: 1 ETH → Alice gets 333,333,333,333,333,333 (loses 1 wei)
Revenue 2: 1 ETH → Alice gets 333,333,333,333,333,333 (loses 1 wei)
Revenue 3: 1 ETH → Alice gets 333,333,333,333,333,333 (loses 1 wei)
Total lost: 3 wei (should have gotten 3 wei more)

With larger numbers this gets worse:
100 distributions → Alice loses 100 wei
1,000,000 distributions → Alice loses 1,000,000 wei (0.001 ETH)
```

### Real-World Impact

- **Low:** 1-100 wei per distribution (negligible)
- **Medium:** But 1000+ distributions accumulate to real losses
- **High:** Some shareholders get systematically cheated

### Recommended Fix

Calculate in single step to minimize division:

```solidity
function claimRevenue() external nonReentrant {
    uint256 holderShares = balanceOf(msg.sender);
    require(holderShares > 0, "No shares");

    uint256 totalSupply__ = totalSupply();
    require(totalSupply__ > 0, "No supply");

    // ✅ Single calculation - division at the end only
    uint256 claimableAmount = (totalRevenueDistributed * holderShares) / totalSupply__;
    
    uint256 alreadyClaimed = claimedRevenue[msg.sender];
    require(claimableAmount > alreadyClaimed, "Nothing to claim");
    
    uint256 available = claimableAmount - alreadyClaimed;
    claimedRevenue[msg.sender] = claimableAmount;

    (bool ok, ) = msg.sender.call{value: available}("");
    require(ok, "Transfer failed");

    emit ShareholderClaimed(msg.sender, available);
}
```

**Fix also needed in:** `launchCampaign()` price calculation

```solidity
// Before (division precision loss)
uint256 pricePerShare = (_targetAmount * 1e18) / _sharesForTarget;

// After (same, but be aware of rounding)
uint256 pricePerShare = (_targetAmount * 1e18) / _sharesForTarget;
// → This is correct, but consider: what if targetAmount is not divisible?
// Alternative: use fixed price then calculate shares
```

**Priority:** 🟠 HIGH - **Affects long-term shareholder returns**

---

## 2. ArtDrop - Race Condition in Subscriber Count

**File:** [contracts/ArtDropArtist.sol](contracts/ArtDropArtist.sol#L170-L190)  
**Function:** `subscribe()`  
**Severity:** 🟠 HIGH - **Incorrect accounting**

### The Problem

```solidity
function subscribe() external payable nonReentrant {
    require(msg.value >= minSubscriptionFee, "Below minimum subscription fee");
    
    // ❌ RACE CONDITION: Check then act (TOCTOU - Time of Check to Time of Use)
    bool isNewSubscriber = !hasSubscribed[msg.sender] || 
                           block.timestamp > subscriptionExpiry[msg.sender];
    if (isNewSubscriber) {
        subscriberCount += 1;  // ← Can be called multiple times before state updates!
    }
    hasSubscribed[msg.sender] = true;
    subscriptionAmount[msg.sender] = msg.value;
    subscriptionExpiry[msg.sender] = block.timestamp + SUBSCRIPTION_DURATION;
}
```

### Attack Scenario

In the same block (or microseconds apart):
```
Time 0: hasSubscribed[Alice] = false
Time 0.1: Alice calls subscribe() → isNewSubscriber = true
Time 0.2: Alice calls subscribe() again (same tx, MEV)
         → isNewSubscriber = true (still! hash not updated)
         → subscriberCount += 1 twice! ✗

Correct state: subscriberCount += 1
Actual state: subscriberCount += 2
```

### Why This Matters

**Subscriber count used for:**
- Artist leaderboards ("1000+ subscribers!")
- Launch bonuses ("First 100 subscribers get...")
- Analytics dashboards
- Revenue splits based on tier

### Recommended Fix

```solidity
function subscribe() external payable nonReentrant {
    require(msg.value >= minSubscriptionFee, "Below minimum subscription fee");
    
    // ✅ FIX: Check before any state changes
    // and ensure atomicity
    require(
        !hasSubscribed[msg.sender] || 
        block.timestamp > subscriptionExpiry[msg.sender],
        "Subscription still active"
    );

    // ✅ Only increment if this is truly new (no resubscription in same block)
    if (!hasSubscribed[msg.sender]) {
        subscriberCount += 1;
    }
    
    hasSubscribed[msg.sender] = true;
    subscriptionAmount[msg.sender] = msg.value;
    subscriptionExpiry[msg.sender] = block.timestamp + SUBSCRIPTION_DURATION;
    totalSubscriptionRevenue += msg.value;

    // ... distribution logic ...
}
```

**Priority:** 🟠 HIGH - **Affects analytics and payouts**

---

## 3. POAPCampaign - Bid Refund Failure Silently Loses Funds

**File:** [contracts/POAPCampaign.sol](contracts/POAPCampaign.sol#L205-L215)  
**Function:** `settleAuction()`  
**Severity:** 🟠 HIGH - **Users' bids disappear**

### The Problem

```solidity
// Refund losers
for (uint256 i = winnerSlots; i < bids.length; i++) {
    if (!bids[i].refunded) {
        bids[i].refunded = true;  // ← Mark as refunded BEFORE checking success
        (bool ok, ) = bids[i].bidder.call{value: bids[i].amount}("");
        if (ok) emit BidRefunded(_campaignId, bids[i].bidder, bids[i].amount);
        // ↑ If !ok: user doesn't get ETH but marked as refunded
        //   No retry mechanism, funds permanently lost
    }
}
```

### The Issue

1. **Mark refunded BEFORE sending** - Sets flag before verifying transfer
2. **Fail silently** - No else branch if transfer fails
3. **No fallback** - No pendingWithdrawals mechanism
4. **User can't retry** - Even if they wanted to

### Consequences

When a refund fails (eg, contract recipient can't receive ETH):
- User's bid marked as refunded ✓
- User's ETH NOT sent ✗
- User can't request refund (already marked refunded) ✗
- Funds trapped in contract forever ✗

### Real Scenario

```
1. User with smart contract wallet bids 10 ETH on POAP
2. Their contract doesn't implement receive() properly
3. Auction settles
4. Settlement tries refund, fails
5. User sees "refunded" on chain but no money received
6. User's smart contract blocked from retrying
7. 10 ETH lost
```

### Recommended Fix

```solidity
// Refund losers with fallback mechanism
for (uint256 i = winnerSlots; i < bids.length; i++) {
    if (!bids[i].refunded) {
        (bool ok, ) = bids[i].bidder.call{value: bids[i].amount}("");
        
        if (ok) {
            bids[i].refunded = true;
            emit BidRefunded(_campaignId, bids[i].bidder, bids[i].amount);
        } else {
            // ✅ Add to pending withdrawals instead of losing it
            pendingWithdrawals[bids[i].bidder] += bids[i].amount;
            bids[i].refunded = true;  // Mark so we don't retry
            emit BidRefundFailed(_campaignId, bids[i].bidder, bids[i].amount);
        }
    }
}

// Allow users to claim pending withdrawals
function claimPending() external nonReentrant {
    uint256 amount = pendingWithdrawals[msg.sender];
    require(amount > 0, "No pending withdrawals");
    
    pendingWithdrawals[msg.sender] = 0;
    
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "Withdrawal failed");
}
```

Need to add event:
```solidity
event BidRefundFailed(uint256 indexed campaignId, address indexed bidder, uint256 amount);
event PendingWithdrawalClaimed(address indexed user, uint256 amount);
```

**Priority:** 🟠 HIGH - **Users lose auction bids**

---

## 4. Database - Missing Performance Indices

**File:** supabase/migrations/ - all files

**Issue:** Critical queries lack indices causing full table scans

### Affected Queries

When checking if subscription is active:
```sql
SELECT * FROM subscriptions 
WHERE artist_wallet = 'artist_address'
AND subscriber_wallet = 'user_address'
AND expiry_time > NOW();
```

Without index: **Full table scan** (millions of rows)  
With index: **Instant lookup**

### Recommended Additions

```sql
-- Subscriptions table (if exists)
CREATE INDEX idx_subscriptions_artist_subscriber 
ON subscriptions(artist_wallet, subscriber_wallet);

CREATE INDEX idx_subscriptions_expiry 
ON subscriptions(artist_wallet, expiry_time)
WHERE expiry_time > EXTRACT(EPOCH FROM NOW());

-- Drops table for time-bound queries
CREATE INDEX idx_drops_active 
ON drops(artist_id, status, ends_at DESC)
WHERE status = 'live';

-- Products for creator queries
CREATE INDEX idx_products_creator_status 
ON products(creator_wallet, status);

-- Orders for buyer queries
CREATE INDEX idx_orders_buyer_status 
ON orders(buyer_wallet, status, created_at DESC);
```

**Priority:** 🟠 HIGH - **Will cause performance issues at scale**

---

## 5. Frontend - Incomplete Error Handling in Hooks

**File:** [src/hooks/useContracts.ts](src/hooks/useContracts.ts), [src/hooks/useSubscriptionTimers.ts](src/hooks/useSubscriptionTimers.ts)

**Issue:** Silent failures and insufficient error context

### Examples

```typescript
// useContracts.ts - useMintDrop
const mint = (dropId: number, priceWei: bigint) => {
    // ... validation ...
    writeContract({
        address: ART_DROP_ADDRESS,
        abi: ART_DROP_ABI,
        functionName: "mint",
        args: [BigInt(dropId)],
        value: priceWei,
    });
    // No error handling! If contract address is wrong, call silently fails
};

// useSubscriptionTimers.ts - fetch subscription time
const { data, isLoading, error } = useReadContract({
    address: ART_DROP_ADDRESS,  // Could be wrong address
    abi: ART_DROP_ABI,
    functionName: "getSubscriptionTimeRemaining",
    args: normalizedArtist && normalizedUser ? [normalizedArtist, normalizedUser] : undefined,
    enabled: Boolean(normalizedArtist && normalizedUser),
});
// If error occurs, no user feedback
```

### Recommended Fixes

```typescript
// With error boundary and user feedback
export function useSubscribeArtist() {
  const { address } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const subscribe = (artist: string, amountEth: string | number) => {
    try {
      // Validation
      if (!address) throw new Error("Wallet not connected");
      if (!artist) throw new Error("Invalid artist address");
      
      const weiAmount = parseEther(String(amountEth));
      if (weiAmount <= 0n) throw new Error("Amount must be greater than 0");

      // Check contract address exists
      if (!ART_DROP_ADDRESS) {
        throw new Error("Contract not configured. Contact support.");
      }

      writeContract({
        address: ART_DROP_ADDRESS,
        abi: ART_DROP_ABI,
        functionName: "subscribe",
        args: [getAddress(artist)],
        value: weiAmount,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Subscribe failed: ${message}`, err);
      // Notify user
      throw new Error(`Subscription failed: ${message}`);
    }
  };

  return {
    subscribe,
    hash,
    isPending,
    error: error?.message || null,
  };
}
```

**Priority:** 🟠 HIGH - **Poor user experience on errors**

---

---

# MEDIUM PRIORITY ISSUES (Should Fix)

## 1. POAPCampaign - Inefficient Bubble Sort Algorithm

**File:** [contracts/POAPCampaign.sol](contracts/POAPCampaign.sol#L165-L180)  
**Severity:** 🟡 MEDIUM - **High gas costs**

### The Problem

```solidity
for (uint256 i = 0; i < bids.length; i++) {
    for (uint256 j = i + 1; j < bids.length; j++) {
        if (bids[j].amount > bids[i].amount) {
            Bid memory tmp = bids[i];
            bids[i] = bids[j];
            bids[j] = tmp;
        }
    }
}
```

O(n²) complexity with 1000 bids:
- Comparisons: 1,000 × 995 / 2 = **499,500** comparisons
- Gas per comparison: ~50 gas
- **Total: ~25M gas** (out of 30M block limit)

Also: **This doesn't actually sort storage!** It sorts an in-memory copy.

### Recommended Fix

```solidity
// Option 1: Use QuickSort (requires library)
// Option 2: Keep winners on-chain as they arrive
mapping(uint256 => address[]) public winnersPerCampaign;

// As user bids, track top N dynamically
function placeBid(uint256 _campaignId) external payable {
    // ... validation ...
    
    // Add to tracking array, maintain only top winnerSlots
    // Similar to heap insertion
}

// Option 3: Full off-chain sorting with merkle proof
```

**Priority:** 🟡 MEDIUM - **Gas optimization**

---

## 2. ArtDropFactory - No Bytecode Validation

**File:** [contracts/ArtDropFactory.sol](contracts/ArtDropFactory.sol#L75)

**Issue:** Owner can set arbitrary bytecode, no validation

```solidity
function setArtDropBytecode(bytes calldata _bytecode) external onlyOwner {
    require(_bytecode.length > 0, "Empty bytecode");
    artDropBytecode = _bytecode;  // ← No checksum or validation!
}
```

**Fix:**
```solidity
// Store contract address instead; prevents bytecode tampering
address public artDropTemplate;  // Instead of raw bytecode

function setArtDropTemplate(address _template) external onlyOwner {
    require(_template.code.length > 0, "Not a contract");
    require(_template != address(0), "Invalid address");
    artDropTemplate = _template;
}

// Use template in deployArtDrop
```

**Priority:** 🟡 MEDIUM - **Security against admin mistakes**

---

## 3. Frontend - Missing Contract Address Validation

**File:** [src/hooks/useContracts.ts](src/hooks/useContracts.ts#L175)

**Issue:** Contract address could be undefined but not checked

```typescript
return writeContract({
    address: ART_DROP_ADDRESS,  // ← Could be undefined
    abi: ART_DROP_ABI,
    functionName: "subscribe",
    args: [validatedArtist],
    value: weiAmount,
});
```

**Fix:**
```typescript
if (!ART_DROP_ADDRESS || ART_DROP_ADDRESS === DEFAULT_ADDRESS) {
    throw new Error("Contract address not configured");
}
```

**Priority:** 🟡 MEDIUM - **Prevents cryptic errors**

---

## 4. Subscription Time Calculation - Edge Cases

**File:** [src/hooks/useSubscriptionTimers.ts](src/hooks/useSubscriptionTimers.ts#L50-L70)

**Issue:** Floor vs ceil differences in time display

```typescript
const secondsRemaining = data ? Number(data) : 0;
const daysRemaining = Math.floor(secondsRemaining / (24 * 60 * 60));
const hoursRemaining = Math.floor((secondsRemaining % (24 * 60 * 60)) / (60 * 60));
```

**Problem:** Display "0 days, 23 hours" when actually has < 1 day left but is valid

**Fix:**
```typescript
const daysRemaining = Math.ceil(secondsRemaining / (24 * 60 * 60));
// Or: use single value like "23 hours 45 minutes remaining"
```

**Priority:** 🟡 MEDIUM - **Minor UX improvement**

---

## 5. Database - No Audit Trail for Changes

**File:** All migration files

**Issue:** No logging of who changed artist data, drops, orders

**Fix:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(10),  -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Add trigger to artists table
CREATE TRIGGER audit_artists_changes
AFTER INSERT OR UPDATE OR DELETE ON artists
FOR EACH ROW
EXECUTE FUNCTION record_audit_log();
```

**Priority:** 🟡 MEDIUM - **Compliance & debugging**

---

---

# LOW PRIORITY ISSUES (Code Quality/Optimization)

## 1. Missing Event Logging

Add events for all state changes in contracts:

```solidity
// ArtDrop.sol
event MinSubscriptionFeeUpdated(address indexed artist, uint256 newFee);
event MintFeeUpdated(uint256 newFee);
event SubscriptionCancelledByArtist(address indexed artist, address indexed subscriber);
```

---

## 2. Frontend - No Rate Limiting

Add debounce to prevent transaction spam:

```typescript
const [lastCall, setLastCall] = useState(0);

const mint = (dropId: number, priceWei: bigint) => {
    const now = Date.now();
    if (now - lastCall < 1000) {
        throw new Error("Please wait before submitting again");
    }
    setLastCall(now);
    // ... rest of function
};
```

---

## 3. Generic Error Messages

Replace generic errors with specific context:

```typescript
// Before:
catch (err) { console.error("Error:", err); }

// After:
catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("value mismatch")) {
        throw new Error("Sent amount doesn't match. Try again with correct amount.");
    }
    throw new Error(`Subscription failed: ${message}`);
}
```

---

## 4. Type Safety - Use typechain

Auto-generate TypeScript types from contracts:

```bash
npm install --save-dev typechain @typechain/ethers-v6

# Generate types
typechain --target ethers-v6 --out-dir src/types artifacts/contracts/*.json
```

---

## 5. Missing Documentation

Add NatSpec comments to all contract functions:

```solidity
/// @notice Allows subscriber to renew subscription after expiry
/// @param _artist The artist's wallet address
/// @param _amountEth Amount in ETH to pay
/// @return subscriptionExpiry New expiry timestamp
function subscribe(address _artist, uint256 _amountEth) 
    external 
    payable 
    returns (uint256) 
{
    // ...
}
```

---

---

# DEPLOYMENT REALITY CHECK

## 📋 Pre-Mainnet Checklist

### Smart Contracts
- [ ] All CRITICAL issues fixed and tested
- [ ] External security audit completed
- [ ] Test coverage > 80%
- [ ] Gas optimization review done
- [ ] All events properly emitted

### Database  
- [ ] RLS policies properly configured
- [ ] All indices in place
- [ ] Backup and recovery plan tested
- [ ] Migration scripts tested on staging

### Frontend
- [ ] ABI matches deployed contracts
- [ ] Contract addresses fetched from database
- [ ] Error handling comprehensive
- [ ] All hooks tested with real contracts

### Operations
- [ ] Monitoring/alerting configured
- [ ] Emergency pause procedures documented
- [ ] Incident response plan ready
- [ ] Team training completed

---

## 🔴 Current Status: NOT READY

**Blockers to mainnet deployment:**
1. Supabase RLS policies completely open
2. ABI/contract address mismatches
3. Investor refunds not implemented
4. Bid DoS vulnerability
5. Precision loss in revenue distribution

**Estimated time to fix:** 20-25 hours

---

##  NEXT STEPS

### Immediate (Next 2 hours)
1. [ ] Fix Supabase RLS policies  
2. [ ] Update and validate all ABIs
3. [ ] Implement investor refunds
4. [ ] Add bid count limits

### This Week (20 hours)
1. [ ] Complete all CRITICAL fixes
2. [ ] Comprehensive testing
3. [ ] Fix all HIGH priority issues
4. [ ] Update documentation

### Before Production (1-2 weeks)
1. [ ] External security audit
2. [ ] Load testing
3. [ ] Staged rollout plan
4. [ ] Full documentation

---

## Questions to Address

1. **Which contract version is active?** ArtDrop or ArtDropArtist?
   - Factory deployment needs clarification
   
2. **Is Supabase RLS enabled?** If so, policies need urgent fix
   - Check project settings
   
3. **Who is the legitimate fee recipient/founder?**
   - Used in all contract deployments
   
4. **What's the mainnet deployment chain?**
   - Base? Ethereum? Polygon? Affects gas costs

5. **Are there existing live users/transactions?**
   - Changes affect migration strategy

---

**Report Generated:** March 23, 2026
**Status:** Awaiting fixes and retesting
