# IMPLEMENTATION GUIDE: Critical Features for POPUP v1

## PRIORITY 1: Homepage Card Stack UI (Swipe Gestures)

### Current State
- `RebootHomePage.tsx` - Basic carousel that auto-rotates every 5 seconds
- Shows: image, title, price, creator
- Interactions: None (static display)

### Target State
```
User sees 1 card at a time
┌─────────────────┐
│                 │
│   Featured      │
│   Product       │
│    Image        │
│                 │
├─────────────────┤
│ $25 ETH         │
│ Creator Name    │
│ "Like" Btn ← Interact
│ "Skip" Btn ← Interact
└─────────────────┘

Swipe RIGHT → Like (add to cart / follow creator)
Swipe LEFT  → Skip (show next card)
```

### Implementation Steps

#### 1. Install gesture library
```bash
npm install framer-motion
# or
npm install react-spring
```

#### 2. Create CardStack component

```typescript
// src/components/CardStack.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, X } from 'lucide-react';

interface Card {
  id: string;
  image: string;
  title: string;
  price: number;
  creator: string;
}

export function CardStack({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [exitX, setExitX] = useState(0);

  const handleLike = () => {
    setExitX(300);
    setTimeout(() => {
      setIndex(prev => (prev + 1) % cards.length);
      setExitX(0);
    }, 500);
  };

  const handleSkip = () => {
    setExitX(-300);
    setTimeout(() => {
      setIndex(prev => (prev + 1) % cards.length);
      setExitX(0);
    }, 500);
  };

  const card = cards[index];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        key={card.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: exitX }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="w-80 h-full bg-white rounded-lg shadow-lg overflow-hidden"
        drag="x"
        dragConstraints={{ left: -300, right: 300 }}
        onDragEnd={(event, info) => {
          if (info.offset.x > 100) handleLike();
          else if (info.offset.x < -100) handleSkip();
        }}
      >
        {/* Card Image */}
        <img src={card.image} alt={card.title} className="w-full h-2/3 object-cover" />

        {/* Card Info */}
        <div className="p-4 h-1/3 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg">{card.title}</h3>
            <p className="text-sm text-gray-600">{card.creator}</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-200 rounded"
            >
              <X size={20} /> Skip
            </button>
            <button
              onClick={handleLike}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-red-500 text-white rounded"
            >
              <Heart size={20} /> Like
            </button>
          </div>
        </div>

        {/* Price Badge */}
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
          {card.price.toFixed(2)} ETH
        </div>
      </motion.div>

      {/* Stack Depth Indicator */}
      <div className="absolute bottom-4 text-sm text-gray-600">
        {index + 1} / {cards.length}
      </div>
    </div>
  );
}
```

#### 3. Update RebootHomePage.tsx

```typescript
// src/pages/RebootHomePage.tsx (replace current carousel logic)
import { CardStack } from '@/components/CardStack';

export default function RebootHomePage() {
  const [featured, setFeatured] = useState<FreshFeedItem[]>([]);
  
  // ... existing useEffect to load featured ...

  const cards = featured.map(item => ({
    id: item.id,
    image: item.image_url || '',
    title: item.title || 'Untitled',
    price: item.price_eth || 0,
    creator: item.creator_name || 'Unknown'
  }));

  return (
    <div className="h-full bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-md mx-auto h-full py-8">
        <h1 className="text-2xl font-bold mb-4">Featured Today</h1>
        {featured.length > 0 ? (
          <CardStack cards={cards} />
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </div>
  );
}
```

#### 4. Test the flow
```bash
npm run dev
# Navigate to home page
# Try swiping cards left/right
# Try clicking Skip/Like buttons
```

**Effort: 2 days | Complexity: Medium | Impact: HIGH (UX critical)**

---

## PRIORITY 2: USDC/USDT Multi-Chain Payments

### Current State
- Only accepts ETH
- Only works on Base Sepolia
- CheckoutPage.tsx has payment method selector (non-functional)

### Target State
```
User sees:
  "How do you want to pay?"
  ○ USDC (Base)
  ○ USDT (Polygon)
  ○ USDC (Optimism)
  ○ Eth (Base)

System flow:
  1. User selects payment method
  2. User approves token spend
  3. System transfers tokens
  4. Order confirmed
```

### Implementation Steps

#### 1. Deploy new contract (ProductStoreUSDC.sol)

```solidity
// contracts/ProductStoreUSDC.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ProductStoreUSDC is Ownable, ReentrancyGuard {
  IERC20 public usdc;
  uint256 public platformFeePercent = 250; // 2.5%
  
  mapping(uint256 => Product) public products;
  mapping(address => uint256) public creatorBalance;
  uint256 public nextProductId = 1;

  struct Product {
    uint256 id;
    address creator;
    string title;
    uint256 priceUsdc; // in USDC units (6 decimals)
    uint256 stock;
    uint256 sold;
  }

  event ProductCreated(uint256 id, address creator, string title, uint256 price);
  event ProductPurchased(uint256 id, address buyer, uint256 price, address creator);

  constructor(address _usdc) {
    usdc = IERC20(_usdc);
  }

  function createProduct(
    string memory _title,
    uint256 _priceUsdc,
    uint256 _stock
  ) public {
    products[nextProductId] = Product({
      id: nextProductId,
      creator: msg.sender,
      title: _title,
      priceUsdc: _priceUsdc,
      stock: _stock,
      sold: 0
    });
    emit ProductCreated(nextProductId, msg.sender, _title, _priceUsdc);
    nextProductId++;
  }

  function buyProduct(uint256 _productId, uint256 _quantity) public nonReentrant {
    Product storage product = products[_productId];
    require(product.sold + _quantity <= product.stock, "Insufficient stock");

    uint256 totalPrice = product.priceUsdc * _quantity;
    uint256 platformFee = (totalPrice * platformFeePercent) / 10000;
    uint256 creatorPayment = totalPrice - platformFee;

    // Transfer from buyer to contract
    require(
      usdc.transferFrom(msg.sender, address(this), totalPrice),
      "Transfer failed"
    );

    // Credit creator balance
    creatorBalance[product.creator] += creatorPayment;

    product.sold += _quantity;
    emit ProductPurchased(_productId, msg.sender, totalPrice, product.creator);
  }

  function withdrawCreatorBalance() public nonReentrant {
    uint256 amount = creatorBalance[msg.sender];
    require(amount > 0, "No balance");
    creatorBalance[msg.sender] = 0;
    require(usdc.transfer(msg.sender, amount), "Withdrawal failed");
  }
}
```

#### 2. Deploy contract to each chain
```bash
# Set env vars
export PRIVATE_KEY="..."
export USDC_BASE="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export USDC_POLYGON="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
export USDC_OPTIMISM="0x0b2C639c533813f4Aa9D7837CAf62653d53F0658"

# Deploy to Base
npx hardhat run scripts/deployProductStoreUSDC.js --network base --USDC_ADDRESS $USDC_BASE

# Deploy to Polygon
npx hardhat run scripts/deployProductStoreUSDC.js --network polygon --USDC_ADDRESS $USDC_POLYGON

# Store addresses in env
# VITE_PRODUCTSTORE_USDC_BASE=0x...
# VITE_PRODUCTSTORE_USDC_POLYGON=0x...
# VITE_PRODUCTSTORE_USDC_OPTIMISM=0x...
```

#### 3. Update CheckoutPage.tsx

```typescript
// src/pages/CheckoutPage.tsx (excerpt)
import { usewrite Contract } from 'wagmi';
import { erc20ABI } from 'viem';

const PAYMENT_OPTIONS = [
  { id: 'usdc_base', name: 'USDC (Base)', contract: import.meta.env.VITE_PRODUCTSTORE_USDC_BASE },
  { id: 'usdt_polygon', name: 'USDT (Polygon)', contract: import.meta.env.VITE_PRODUCTSTORE_USDT_POLYGON },
  { id: 'usdc_optimism', name: 'USDC (Optimism)', contract: import.meta.env.VITE_PRODUCTSTORE_USDC_OPTIMISM },
  { id: 'eth_base', name: 'ETH (Base)', contract: import.meta.env.VITE_PRODUCTSTORE_ETH_BASE },
];

export function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState('usdc_base');
  const { address } = useAccount();
  const { chain } = useNetwork();

  const selectedPayment = PAYMENT_OPTIONS.find(p => p.id === paymentMethod);

  // Step 1: Approve token spending
  const { write: approve } = useWriteContract({
    address: selectedPayment?.tokenAddress, // USDC contract
    abi: erc20ABI,
    functionName: 'approve',
    args: [
      selectedPayment?.contract, // ProductStoreUSDC contract
      totalPrice // amount in USDC (with 6 decimals)
    ]
  });

  // Step 2: Buy product
  const { write: buyProduct } = useWriteContract({
    address: selectedPayment?.contract,
    abi: PRODUCTSTORE_USDC_ABI,
    functionName: 'buyProduct',
    args: [productId, quantity]
  });

  const handleCheckout = async () => {
    // If USDC/USDT, need approval first
    if (paymentMethod.includes('usdc') || paymentMethod.includes('usdt')) {
      await approve();
      // Wait for approval confirmation
      setTimeout(() => buyProduct(), 2000);
    } else {
      // ETH payment (no approval needed)
      buyProduct();
    }
  };

  return (
    <div>
      {/* Payment Method Selector */}
      <div className="mb-4">
        <label className="block font-bold mb-2">Payment Method</label>
        {PAYMENT_OPTIONS.map(option => (
          <label key={option.id} className="flex items-center p-2 border rounded mb-2">
            <input
              type="radio"
              value={option.id}
              checked={paymentMethod === option.id}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <span className="ml-2">{option.name}</span>
          </label>
        ))}
      </div>

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        className="w-full bg-blue-600 text-white p-3 rounded font-bold"
      >
        Pay with {selectedPayment?.name}
      </button>
    </div>
  );
}
```

**Effort: 3 days | Complexity: High | Impact: CRITICAL (revenue enablement)**

---

## PRIORITY 3: OnRamp Integration (Coinbase Pay)

### Current State
- No onramp integration
- Users must already have crypto

### Target State
```
"Don't have crypto?"
[Pay with Credit Card ↗️] 
  ↓ (clicks)
Coinbase Pay modal opens
  ↓ (User enters credit card)
$100 USDC purchased
  ↓ (Auto-added to wallet)
Automatic redirect back to checkout
```

### Implementation Steps

#### 1. Register at Coinbase Cloud

Go to: https://coinbase.com/cloud/products/pay

Register app, get:
- `APP_ID`
- `APP_SECRET`

Store in `.env.local`:
```
VITE_COINBASE_PAY_APP_ID=your_app_id
VITE_COINBASE_PAY_NONCE=your_nonce
```

#### 2. Add Coinbase Pay SDK

```bash
npm install @coinbase/onchainkit
```

#### 3. Create OnrampButton component

```typescript
// src/components/OnrampButton.tsx
import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { CoinbasePayIcon } from '@coinbase/onchainkit'; // Example

declare global {
  interface Window {
    CoinbaseOnchainKit?: any;
  }
}

export function OnrampButton() {
  const { address } = useAccount();

  const handleOnramp = useCallback(() => {
    // Load Coinbase Pay script
    const script = document.createElement('script');
    script.src = 'https://pay.coinbase.com/v3/static/onramp.js'; // Example URL
    script.onload = () => {
      if (window.CoinbaseOnchainKit) {
        window.CoinbaseOnchainKit.openOnramp({
          appId: import.meta.env.VITE_COINBASE_PAY_APP_ID,
          walletAddress: address,
          destinationCurrency: 'USDC',
          presetCryptoAmount: 100, // Default $100
          onSuccess: () => {
            // Redirect back to checkout
            window.location.href = '/checkout';
          },
          onError: (error: any) => {
            console.error('Onramp failed:', error);
          }
        });
      }
    };
    document.head.appendChild(script);
  }, [address]);

  if (!address) return null;

  return (
    <button
      onClick={handleOnramp}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded"
    >
      💳 Buy Crypto with Card
    </button>
  );
}
```

#### 4. Add to CheckoutPage

```typescript
// src/pages/CheckoutPage.tsx (add to render)
import { OnrampButton } from '@/components/OnrampButton';

export function CheckoutPage() {
  return (
    <div>
      {/* Existing checkout form */}
      
      {/* Onramp Option */}
      <div className="my-4 p-4 bg-amber-50 border border-amber-200 rounded">
        <p className="text-sm text-amber-900 mb-2">Don't have {selectedPayment?.name} yet?</p>
        <OnrampButton />
      </div>
    </div>
  );
}
```

**Effort: 2 days | Complexity: Medium | Impact: CRITICAL (non-crypto users)**

---

## PRIORITY 4: Contest/Raffle System

### Current State
- No contest support
- No raffle mechanics
- No entry tracking

### Target State
```
Creator creates:
  - Title: "Art Giveaway"
  - Entry price: 0.1 ETH  
  - Max entries: 100
  - Drawing date: May 1

Users buy entries:
  - Entry 1: 0x123...
  - Entry 2: 0x456...
  - Entry 3: 0x789...

Creator draws winner:
  - Random number generator selects entry 42
  - Winner notified: 0x789... won!
  - Prize delivered
```

### Database Schema

```sql
CREATE TABLE contests (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES creators(id),
  title TEXT NOT NULL,
  description TEXT,
  entry_price NUMERIC NOT NULL, -- in ETH
  max_entries INT NOT NULL,
  current_entries INT DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, drawing, completed
  drawing_date TIMESTAMP,
  winner_wallet VARCHAR(42),
  winner_announced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contest_entries (
  id UUID PRIMARY KEY,
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  buyer_wallet VARCHAR(42) NOT NULL,
  tx_hash VARCHAR(66),
  entry_number INT, -- Sequential: 1, 2, 3...
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Backend Implementation

```typescript
// server/routes/contests.js
import express from 'express';

const router = express.Router();

// Create contest
router.post('/contests', async (req, res) => {
  const { title, description, entry_price, max_entries, drawing_date } = req.body;
  const creator_id = req.auth?.id; // From JWT

  if (!creator_id) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('contests')
    .insert({
      creator_id,
      title,
      description,
      entry_price,
      max_entries,
      drawing_date,
      status: 'active'
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Buy entry
router.post('/contests/:id/buy', async (req, res) => {
  const { id } = req.params;
  const { tx_hash } = req.body;
  const buyer_wallet = req.auth?.wallet || req.body.wallet;

  // Verify blockchain transaction
  const txConfirmed = await verifyTransaction(tx_hash);
  if (!txConfirmed) return res.status(400).json({ error: 'Transaction not found' });

  // Get contest
  const { data: contest } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .single();

  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (contest.current_entries >= contest.max_entries) {
    return res.status(400).json({ error: 'Contest full' });
  }

  // Create entry
  const entry_number = contest.current_entries + 1;
  const { data: entry, error } = await supabase
    .from('contest_entries')
    .insert({
      contest_id: id,
      buyer_wallet,
      tx_hash,
      entry_number
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Update contest entry count
  await supabase
    .from('contests')
    .update({ current_entries: entry_number })
    .eq('id', id);

  res.json(entry);
});

// Draw winner
router.post('/contests/:id/draw', async (req, res) => {
  const { id } = req.params;
  const creator_id = req.auth?.id;

  const { data: contest } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .single();

  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (contest.creator_id !== creator_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Get all entries
  const { data: entries } = await supabase
    .from('contest_entries')
    .select('*')
    .eq('contest_id', id);

  // Random selection
  const winner_entry = entries[Math.floor(Math.random() * entries.length)];

  // Update contest
  await supabase
    .from('contests')
    .update({
      status: 'completed',
      winner_wallet: winner_entry.buyer_wallet,
      winner_announced_at: new Date().toISOString()
    })
    .eq('id', id);

  res.json({
    winner_wallet: winner_entry.buyer_wallet,
    entry_number: winner_entry.entry_number
  });
});

module.exports = router;
```

### Frontend Implementation

```typescript
// src/pages/CreateContestPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';

export function CreateContestPage() {
  const navigate = useNavigate();
  const { address } = useWallet();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    entry_price: '',
    max_entries: '',
    drawing_date: ''
  });

  const handleCreate = async () => {
    const response = await fetch('/api/contests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(form)
    });

    if (response.ok) {
      const contest = await response.json();
      navigate(`/contest/${contest.id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Create a Raffle</h1>

      <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
        <input
          type="text"
          placeholder="Contest Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full p-2 mb-3 border rounded"
        />

        <textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full p-2 mb-3 border rounded"
          rows={4}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Entry Price (ETH)"
          value={form.entry_price}
          onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
          className="w-full p-2 mb-3 border rounded"
        />

        <input
          type="number"
          placeholder="Max Entries"
          value={form.max_entries}
          onChange={(e) => setForm({ ...form, max_entries: e.target.value })}
          className="w-full p-2 mb-3 border rounded"
        />

        <input
          type="datetime-local"
          value={form.drawing_date}
          onChange={(e) => setForm({ ...form, drawing_date: e.target.value })}
          className="w-full p-2 mb-6 border rounded"
        />

        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold">
          Create Contest
        </button>
      </form>
    </div>
  );
}
```

**Effort: 5-7 days | Complexity: High | Impact: MEDIUM (needed for 3x distribution)**

---

## Summary: What to Build First

### Week 1-2 (Critical Path)
1. **Card Stack Homepage** (2 days)
2. **USDC/USDT Payments** (3 days)
3. **Onramp Integration** (2 days)

### Week 3-4 (Feature Complete)
4. **Contest System** (5-7 days)
5. **Gifting Refinement** (2 days)

### Week 5-6 (Monetization)
6. **Creator Payouts**
7. **Analytics Dashboard**

**All code is production-ready when completed. Start with priority 1 today.**
