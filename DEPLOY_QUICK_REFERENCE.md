# Quick Deploy Reference

## 🚀 Deploy to Base Sepolia in 15 minutes

### Prerequisites
- ✅ Contracts written: `contracts/ArtDropFactory.sol` + `contracts/ArtDropArtist.sol`
- ✅ Deployment scripts ready: `scripts/deploy-factory-direct.mjs`
- ✅ Private key available: `0xf0a13aebe3430c042e6968e916f4660fddc7e01f3c3acb972b55a503e5442e21`
- ✅ Testnet funds: Get ETH from https://www.coinbase.com/faucets/base-sepolia-faucet

### Command Sequence

```powershell
# Step 1: Get testnet ETH (60 sec)
# Go to: https://www.coinbase.com/faucets/base-sepolia-faucet
# Request ETH for: 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092

# Step 2: Compile & get bytecode (2 min)
# Go to: https://remix.ethereum.org/
# Create ArtDropFactory.sol, paste from contracts/ArtDropFactory.sol
# Compiler: 0.8.28, EVM: cancun
# Copy bytecode

# Step 3: Deploy factory (2 min)
notepad scripts/deploy-factory-direct.mjs
# Replace FACTORY_BYTECODE = `` with bytecode from Remix (no 0x prefix)

$env:PRIVATE_KEY="0xf0a13aebe3430c042e6968e916f4660fddc7e01f3c3acb972b55a503e5442e21"
node scripts/deploy-factory-direct.mjs

# Step 4: Set ArtDrop bytecode (3 min)
# In Remix, compile contracts/ArtDropArtist.sol
# Copy ArtDrop bytecode

node scripts/set-artdrop-bytecode.mjs
# Paste bytecode when prompted

# Step 5: Deploy artist contract (2 min)
node scripts/deploy-artist-contract.mjs 0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092

# Step 6: Update frontend
notepad src/lib/contracts/artDropFactory.ts
# Replace FACTORY_ADDRESS with deployed address from Step 3

npm run build
npx vercel --prod
```

### Files to Update

1. **scripts/deploy-factory-direct.mjs** (line ~30)
   ```javascript
   const FACTORY_BYTECODE = `6080604052...`; // From Remix
   ```

2. **scripts/set-artdrop-bytecode.mjs**
   - Run script, paste bytecode when prompted

3. **src/lib/contracts/artDropFactory.ts** (line ~1)
   ```typescript
   export const FACTORY_ADDRESS = "0xABC..."; // From Step 3 output
   ```

### Verification

After deployment, verify on:
- https://sepolia.basescan.org/?q=0xFactoryAddress
- Should show contract code with functions:
  - `deployArtDrop`
  - `setArtDropBytecode`

### Issues?

| Problem | Solution |
|---------|----------|
| No ETH | Get testnet ETH from faucet (link in Prerequisites) |
| Bytecode paste fails | Remove `0x` prefix from bytecode |
| Contract not found | Check factory deploy succeeded (has address) |
| Remix compile fails | Verify EVM version is "cancun" in settings |

---

See [DEPLOY_TO_BASE_SEPOLIA.md](DEPLOY_TO_BASE_SEPOLIA.md) for detailed steps.
