# Deploy to Base Sepolia via Remix IDE

Since automated solc compilation is hitting compatibility issues, use Remix (the most reliable method).

## Step 1: Deploy Factory

1. **Open Rem ix**: https://remix.ethereum.org/
2. **Create file**: `ArtDropFactory.sol`
3. **Copy contents** from: `contracts/ArtDropFactory.sol`
4. **Compiler settings**:
   - Version: `0.8.28`
   - EVM: `cancun`
5. **Compile**: Click "Compile ArtDropFactory.sol"
6. **Deploy**:
   - Go to "Deploy & Run Transactions" (left panel)
   - Select "Injected Web3" (MetaMask)
   - Network: **Base Sepolia**
   - Environment: Select `ArtDropFactory`
   - Click **Deploy**
7. **Copy factory address** from transaction receipt

## Step 2: Set ArtDrop Bytecode

1. **Create file** in Remix: `ArtDrop.sol`
2. **Copy contents** from: `contracts/ArtDropArtist.sol`
3. **Compile** with same settings (0.8.28, cancun)
4. **Expand** "ArtDrop" contract in compiler panel
5. **Copy bytecode** (click copy icon)
6. **In contract**:
   - Expand deployed Factory address (right panel)
   - Find `setArtDropBytecode` function
   - Paste bytecode and call

## Step 3: Deploy Artist Contract

1. **In contract** (Factory):
   - Find `deployArtDrop` function
   - Enter artist wallet: `0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092`
   - Call function
2. **Get contract address** from transaction receipt

## Step 4: Update Frontend

```typescript
// src/lib/contracts/artDropFactory.ts
export const FACTORY_ADDRESS = "0x..."; // Paste factory address from Step 1
```

## Step 5: Redeploy

```powershell
npm run build
npx vercel --prod
```

Done! 🚀
