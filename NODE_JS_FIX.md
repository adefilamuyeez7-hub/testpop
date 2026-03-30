# Node.js Version Fix for Hardhat Compilation

## Quick Fix: Use nvm (Node Version Manager)

If you have nvm-windows installed, you can switch versions:

```pwsh
# List installed versions
nvm list

# Install Node.js 22 LTS if not already installed
nvm install 22.13.0

# Switch to Node.js 22
nvm use 22.13.0

# Verify
node --version  # Should show v22.x.x

# Now compile
npx hardhat compile

# Switch back to 25 if needed
nvm use 25.6.1
```

## Alternative: Direct Download

1. Go to https://nodejs.org/
2. Download **Node.js 22 LTS** (e.g., 22.13.0)
3. Install it (can have both 22 and 25 installed)
4. Use the Node.js 22 installer's "Add to PATH" option OR manually set PATH

## After Compiling

Once `npx hardhat compile` succeeds:

```pwsh
# Set private key
$env:PRIVATE_KEY="0xf0a13aebe3430c042e6968e916f4660fddc7e01f3c3acb972b55a503e5442e21"

# Deploy factory
npx node scripts/deploy-factory.mjs

# Update FACTORY_ADDRESS in src/lib/contracts/artDropFactory.ts

# Deploy artist contract (repeat for each artist)
npx node scripts/deploy-artist-contract.mjs 0xArtistWalletAddress
```

## Why This Works

- **Hardhat 3.2.0** officially supports Node.js 22 LTS
- Your current Node.js 25.6.1 is unsupported by Hardhat
- OpenZeppelin compatibility is not the issue - it's the Node.js version

## Status

- ✅ Contracts written and tested
- ✅ Deployment scripts ready
- ❌ Hardhat needs Node.js 22 LTS to compile
