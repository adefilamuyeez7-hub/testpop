# Artful Sparkle Vault

NFT Art Drops Platform built with React, Vite, and wagmi.

## Getting Started

```bash
npm install
npm run dev
```

## ⚠️ Security Warning

**Never commit private keys to version control!** This is extremely dangerous and can result in the loss of all funds.

### Secure Key Management

1. **For Local Development:**
   - Use a test wallet with no real funds
   - Create a separate `.env.local` file (add to `.gitignore`)
   - Never use mainnet funds for testing

2. **For Production Deployment:**
   - Use environment variables in secure CI/CD pipelines
   - Consider using hardware wallets or signer services
   - Never store private keys in repository files

3. **Environment Setup:**
   ```bash
   cp .env.example .env.local  # Create local env file
   # Edit .env.local with your test credentials
   ```

### WalletConnect Setup (Required for Mobile)

WalletConnect v2 requires a project ID for mobile wallet connections:

1. **Register at WalletConnect Cloud:**
   - Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
   - Create a free account and project
   - Copy your Project ID

2. **Add to Environment:**
   ```bash
   # In .env.local
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

3. **Without Project ID:**
   - WalletConnect connector will be disabled
   - Mobile users can only use injected wallets (MetaMask, etc.)
   - QR code connections won't work

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Smart Contract Deployment

This project includes two smart contracts: `ArtDrop.sol` and `POAPCampaign.sol`.

### Prerequisites

- Node.js 22+ (Hardhat recommends LTS)
- A funded wallet on Base network

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your private key and Pinata JWT:
```bash
cp .env.example .env
# Edit .env and add:
# PRIVATE_KEY=...        # without 0x prefix
# VITE_PINATA_JWT=...
```

### Deploy to Base Sepolia (Testnet)

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy.js --network base
```

After deployment, the contract addresses will be saved to `deployed-addresses.json`. Update the addresses in `src/lib/contracts/` files accordingly.

## Pinata Uploads In The UI

The artist creation dialogs use `VITE_PINATA_JWT` from your Vite env.

- If the contract addresses in `src/lib/contracts/` are still the zero address, the dialogs will still upload the asset or metadata to Pinata and complete in mock mode.
- Once you paste real deployed contract addresses into those files, the same dialogs will continue on to the on-chain write step.

### Contract Addresses (Update these after deployment)

- ArtDrop: Update in `src/lib/contracts/artDrop.ts`
- POAPCampaign: Update in `src/lib/contracts/poapCampaign.ts`
