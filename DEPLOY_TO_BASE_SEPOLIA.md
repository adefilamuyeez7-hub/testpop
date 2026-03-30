# Deploy to Base Sepolia - Complete Steps

## Overview

Deploy the artist-specific ArtDrop contracts to Base Sepolia testnet. You'll need:
- Remix.ethereum.org (for compilation)
- Your private key from `.env`
- A few ETH in your deployer wallet

**Time estimate: 10-15 minutes**

---

## Step 1: Get Testnet ETH

If your wallet has no ETH:

1. Go to https://www.coinbase.com/faucets/base-sepolia-faucet
2. Connect wallet or paste address: `0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092`
3. Request 0.5 ETH (arrives in ~1 minute)

---

## Step 2: Compile Factory Contract (Remix)

1. Open https://remix.ethereum.org/
2. Create new file: **ArtDropFactory.sol**
3. Paste entire contents from: `contracts/ArtDropFactory.sol`
4. In left panel, go to **Solidity Compiler**
5. Set version to **0.8.28**
6. Set EVM version to **cancun** (dropdown below version)
7. Click **Compile ArtDropFactory.sol**
8. Once compiled, expand the **ArtDropFactory** contract
9. Click the copy icon next to **Bytecode** (long hex starting with `6080...`)

---

## Step 3: Deploy Factory

```powershell
# Terminal 1: Set environment
$env:PRIVATE_KEY="0xf0a13aebe3430c042e6968e916f4660fddc7e01f3c3acb972b55a503e5442e21"

# Open deploy script
notepad scripts/deploy-factory-direct.mjs
```

Find this line (near top):
```javascript
const FACTORY_BYTECODE = ``;
```

Paste the bytecode you copied from Remix:
```javascript
const FACTORY_BYTECODE = `608060405234801561001057600080fd5b50...`; // Remove 0x prefix
```

Save and run:
```powershell
node scripts/deploy-factory-direct.mjs
```

**Output example:**
```
🔑 Deployer: 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092
📡 Network: Base Sepolia
💰 Balance: 0.5 ETH

✅ Factory deployed!
📍 Address: 0xABC...DEF
```

**Save the address** - you'll need it for the next step!

---

## Step 4: Get ArtDrop Bytecode (Remix)

1. In Remix, create another new file: **ArtDrop.sol**
2. Paste entire contents from: `contracts/ArtDropArtist.sol`
3. Click **Compile ArtDrop.sol** (should use same 0.8.28 settings)
4. Once compiled, expand the **ArtDrop** contract
5. Copy the **Bytecode** (this is different from factory bytecode)

---

## Step 5: Set Bytecode in Factory

Run:
```powershell
node scripts/set-artdrop-bytecode.mjs
```

When prompted, paste the ArtDrop bytecode you copied from Remix.

**Output example:**
```
✅ Bytecode set!
📦 Gas used: 45000
💰 Cost: 0.001 ETH

🎉 Factory is now ready!
```

---

## Step 6: Deploy First Artist Contract

Get an artist wallet address. For testing, you can use the factory address itself or create a new test wallet.

```powershell
# Deploy artist contract using factory
node scripts/deploy-artist-contract.mjs 0xArtistWalletAddressHere
```

**Output example:**
```
✅ Artist contract deployed!
📍 Address: 0x123...456
📝 Artist wallet: 0xABC...DEF

✅ Supabase updated!
```

---

## Step 7: Update Frontend

Open `src/lib/contracts/artDropFactory.ts`:

Find:
```typescript
export const FACTORY_ADDRESS = "0x...";
```

Replace with your deployed factory address:
```typescript
export const FACTORY_ADDRESS = "0xABC...DEF";
```

Rebuild and deploy:
```powershell
npm run build
npx vercel --prod
```

---

## Troubleshooting

### "No ETH in wallet"
→ Get testnet ETH from faucet (60 seconds)

### "Bytecode already set"
→ Contract was already configured, move to Step 6

### "Artist contract failed"
→ Check Supabase migration ran, or create artist first in UI

### Transaction failed / reverted
→ Check balance has enough gas
→ Verify network is Base Sepolia

---

## Verification

Once deployed, verify on Block Explorer:

1. Go to https://sepolia.basescan.org/
2. Search for factory address
3. Should see:
   - Contract code verified ✓
   - `setArtDropBytecode` function called
   - Multiple `ArtDropDeployed` events

---

## Next Steps

1. ✅ Create artist profiles in UI
2. ✅ Each profile auto-deploys artist contract
3. ✅ Test subscribe (enforces one-per-wallet)
4. ✅ Test mint/drops

Artist contracts are live on Base Sepolia! 🚀
