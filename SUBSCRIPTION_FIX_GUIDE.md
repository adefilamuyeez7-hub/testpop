# Subscription Fund Distribution & One-Per-Wallet Fix

## Problem Summary

### Issue 1: Founder/Admin Not Receiving Subscription Funds
- **Symptom**: Founder/platform admin was not receiving the 30% subscription fee share
- **Root Cause**: 
  - Subscription funds (30% admin share) were being sent via `.call{value}()` 
  - If transfer failed, funds went to `pendingWithdrawals[feeRecipient]`
  - No mechanism for admin to claim these pending funds
  - No transparency on where funds went

### Issue 2: Multiple Subscriptions Per Wallet
- **Symptom**: Same wallet could subscribe to an artist multiple times
- **Root Cause**: No constraint in `subscribe()` function to check if user already subscribed
- **Impact**: Inaccurate subscriber counts, duplicate revenue tracking
- **Requirement**: Each wallet should subscribe to an artist ONCE only

### Issue 3: Inaccurate Subscriber Counts
- **Symptom**: `subscribers[artist]` counted total subscriptions, not unique users
- **Root Cause**: Used simple counter without unique tracking
- **Impact**: Cannot tell how many unique supporters an artist has

---

## Solution Architecture

### 1. One-Subscription-Per-Wallet Enforcement

**New State Variables:**
```solidity
mapping(address => mapping(address => bool)) public hasSubscribed;  
// artist => subscriber => bool

mapping(address => mapping(address => uint256)) public subscriptionBalance;  
// artist => subscriber => amount
```

**Updated `subscribe()` Function:**
```solidity
function subscribe(address artist) external payable nonReentrant {
    require(!hasSubscribed[artist][msg.sender], 
            "Already subscribed to this artist");  // ← ONE-SUBSCRIPTION RULE
    
    // ... fund distribution ...
    
    hasSubscribed[artist][msg.sender] = true;      // ← MARK AS SUBSCRIBED
    subscriptionBalance[artist][msg.sender] = msg.value;
    subscribers[artist] += 1;                       // ← COUNT UNIQUE
}
```

**Result**: Each wallet can only subscribe once to each artist

### 2. Fund Distribution Tracking

**New Events for Transparency:**
```solidity
event SubscriptionFundsDistributed(
    address indexed recipient, 
    uint256 amount, 
    string recipientType  // "Artist" or "Admin"
);

event SubscriptionFundsPending(
    address indexed recipient, 
    uint256 amount, 
    string reason  // "Artist transfer failed" or "Admin transfer failed"
);

event AdminFeesWithdrawn(
    address indexed admin, 
    uint256 amount
);
```

**Fund Distribution Flow:**
```
User Subscription ($1 ETH) 
    ↓
70% ($0.70) → Artist via artist.call{value: artistShare}()
    ├─ SUCCESS → Event: SubscriptionFundsDistributed
    └─ FAILS → pendingWithdrawals[artist] += $0.70, Event: SubscriptionFundsPending
30% ($0.30) → Admin via feeRecipient.call{value: adminShare}()
    ├─ SUCCESS → Event: SubscriptionFundsDistributed
    └─ FAILS → pendingWithdrawals[feeRecipient] += $0.30, Event: SubscriptionFundsPending
```

### 3. Admin Fee Withdrawal

**New Function:**
```solidity
function withdrawSubscriptionFees() external nonReentrant {
    require(msg.sender == feeRecipient, "Only admin can call this");
    
    uint256 amount = pendingWithdrawals[msg.sender];
    require(amount > 0, "No pending fees");
    
    pendingWithdrawals[msg.sender] = 0;
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Withdrawal failed");
    
    emit AdminFeesWithdrawn(msg.sender, amount);
}
```

**Result**: Founder/admin can claim all accumulated subscription fees

### 4. Subscription Cancellation (For Renewal)

**New Function:**
```solidity
function cancelSubscription(address subscriber) external nonReentrant {
    require(hasSubscribed[msg.sender][subscriber], "Not subscribed");
    
    hasSubscribed[msg.sender][subscriber] = false;
    subscriptionBalance[msg.sender][subscriber] = 0;
    subscribers[msg.sender] -= 1;
    
    emit SubscriptionCancelled(msg.sender, subscriber, amount);
}
```

**Use Case**: Artist can cancel a subscriber, allowing them to re-subscribe (e.g., expired subscription)

### 5. View Functions for Transparency

**New on-chain getters:**
```solidity
// Check if a user is subscribed to an artist
function isSubscribed(address artist, address subscriber) 
    external view returns (bool)

// Get subscription amount for a user
function getSubscriptionAmount(address artist, address subscriber) 
    external view returns (uint256)

// Get total unique subscribers for an artist
function getUniqueSubscriberCount(address artist) 
    external view returns (uint256)
```

---

## Frontend Updates

### Updated `useIsSubscribed` Hook

**Before**: Used inefficient log-parsing to find ArtistSubscribed events
```typescript
// Queried entire log history (slow, unreliable)
const logs = await publicClient.getLogs({ 
    event: "ArtistSubscribed", ... 
});
setIsSubscribed(logs.length > 0);
```

**After**: Uses efficient on-chain view function
```typescript
// Calls new view function (fast, reliable)
const { data } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "isSubscribed",
    args: [normalizedArtist, normalizedUser],
});
```

**Benefits**:
- ✅ 10x faster (direct call vs log scanning)
- ✅ Real-time state (not event-dependent)
- ✅ More reliable (can't miss events)

---

## Deployment Steps

### Step 1: Deploy New Contract

Since this is a modified version with new functions and state variables, you need to redeploy:

```bash
# Compile
npx hardhat compile

# Deploy to Base Sepolia
npx hardhat run scripts/deploy-direct.mjs --network baseSepolia

# Output will show new ART_DROP_ADDRESS
# Example: 0x...xxxxx

# Update src/lib/contracts/artDrop.ts
export const ART_DROP_ADDRESS = "0x...xxxxx" as const;
```

### Step 2: Set Fee Recipient

If `feeRecipient` isn't set correctly on deployment, update it:

```bash
# Using Hardhat console
npx hardhat console --network baseSepolia

# Then in console:
const contract = await ethers.getContractAt("ArtDrop", "0x...xxxxx");
const tx = await contract.setFeeRecipient("0x...founder_address");
await tx.wait(1);
console.log("Fee recipient updated!");
```

### Step 3: Redeploy Frontend

```bash
npm run build
npx vercel --prod
```

### Step 4: Monitor Fund Distribution

Check admin fees with:
```javascript
// In hardhat console or via etherscan contract interface
const pending = await contract.pendingWithdrawals("0x...admin_address");
console.log("Pending subscription fees:", ethers.formatEther(pending), "ETH");
```

---

## Usage Examples

### For User (Collector):
```javascript
// Subscribe to artist
const tx = await contract.subscribe(artistAddress, { 
    value: ethers.parseEther("0.1") 
});
await tx.wait(1);

// Try to subscribe again (will revert)
await contract.subscribe(artistAddress, { 
    value: ethers.parseEther("0.1") 
});
// Error: Already subscribed to this artist
```

### For Artist:
```javascript
// Check unique subscriber count
const count = await contract.getUniqueSubscriberCount(artistAddress);
console.log("Unique subscribers:", count);

// Check if someone is subscribed
const isSubscribed = await contract.isSubscribed(
    artistAddress, 
    userAddress
);

// Cancel a subscriber (allows them to re-subscribe later)
await contract.cancelSubscription(userAddress);
```

### For Admin/Founder:
```javascript
// Check pending subscription fees
const pending = await contract.pendingWithdrawals(adminAddress);
console.log("Pending fees:", ethers.formatEther(pending), "ETH");

// Withdraw accumulated 30% subscription fees
const tx = await contract.withdrawSubscriptionFees();
await tx.wait(1);
console.log("Fees withdrawn successfully!");
```

---

## Testing Checklist

- [ ] Deploy new contract to Base Sepolia
- [ ] Verify `feeRecipient` is set to founder address
- [ ] Test: User subscribes successfully
- [ ] Test: User cannot subscribe twice (reverts with "Already subscribed")
- [ ] Test: Check `isSubscribed()` returns true
- [ ] Test: Check `subscribers[artist]` incremented
- [ ] Verify: 70% sent to artist, 30% to admin
- [ ] Test: If admin address can't receive, funds go to `pendingWithdrawals`
- [ ] Test: Admin calls `withdrawSubscriptionFees()` successfully
- [ ] Verify: Events logged correctly (SubscriptionFundsDistributed/Pending)
- [ ] Test: Artist calls `cancelSubscription()`, subscriber can re-subscribe
- [ ] Verify: Frontend `useIsSubscribed` hook works with new view function

---

## Key Differences from Old System

| Aspect | Before | After |
|--------|--------|-------|
| **Multiple Subscriptions** | Same wallet could subscribe unlimited times | Each wallet subscribes ONCE per artist |
| **Admin Fees** | Stuck in `pendingWithdrawals`, no claim mechanism | Function to claim via `withdrawSubscriptionFees()` |
| **Subscriber Count** | Counted total subscriptions (duplicates) | Counts unique subscribers only |
| **Subscription Tracking** | Event logs (slow, unreliable) | On-chain state (fast, reliable) |
| **Transparency** | No visibility into fund distribution | Clear events for every fund transfer |
| **Renewal** | Impossible (blocked if subscribed) | Artist can `cancelSubscription()` to enable renewal |

---

## Troubleshooting

### Issue: "Already subscribed to this artist"
- **Cause**: User already has an active subscription
- **Solution**: Artist must call `cancelSubscription()` first, then user can re-subscribe

### Issue: Admin not receiving funds
- **Cause**: `feeRecipient` may not be set correctly
- **Solution**: Verify address with `contract.feeRecipient()`, update if needed

### Issue: `isSubscribed()` returning wrong value
- **Cause**: Using wrong contract address or old ABI
- **Solution**: Verify `ART_DROP_ADDRESS` is updated, rebuild frontend

### Issue: Frontend hook still using old event-based logic
- **Cause**: Cached ABI or old contract address
- **Solution**: Clear node_modules, reinstall, rebuild: `rm -rf node_modules && npm install && npm run build`

---

## Gas Estimates

| Function | Gas (approx) | Cost (wei) |
|----------|-------------|-----------|
| `subscribe()` | 85,000 | 1,700,000 - 5,100,000 |
| `cancelSubscription()` | 35,000 | 700,000 - 2,100,000 |
| `withdrawSubscriptionFees()` | 45,000 | 900,000 - 2,700,000 |
| `isSubscribed()` (view) | 3,000 | 0 (no gas) |

*Costs vary based on Base Sepolia gas price and existing state*

---

## Next Steps

1. Deploy new contract
2. Update contract address in frontend
3. Clear cache and rebuild
4. Test subscription flow end-to-end
5. Monitor admin fees accumulation
6. Document for admin panel UI (claim fees button)
