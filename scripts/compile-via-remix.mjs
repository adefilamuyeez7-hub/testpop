#!/usr/bin/env node

/**
 * Generate bytecode for contracts that can be pasted into deploy scripts
 * This extracts just the bytecode without needing to resolve all imports
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deployAddressesPath = path.join(__dirname, '../deployed-addresses.json');

// For manual Remix compilation - this script helps with deployment
console.log('='.repeat(70));
console.log('MANUAL COMPILATION VIA REMIX IDE');
console.log('='.repeat(70));
console.log('\n📋 Steps to compile contracts:\n');

console.log('1️⃣  Go to https://remix.ethereum.org/');
console.log('2️⃣  Create new file: ArtDropArtist.sol');
console.log('3️⃣  Copy this entire file:');
console.log('     contracts/ArtDropArtist.sol\n');

console.log('4️⃣  Set compiler to 0.8.28');
console.log('5️⃣  Set EVM version to "cancun"');
console.log('6️⃣  Click "Compile ArtDropArtist.sol"\n');

console.log('7️⃣  Under "ARTIFACTS" → Copy the JSON file');
console.log('8️⃣  Save to: artifacts/contracts/ArtDropArtist.sol/ArtDrop.json\n');

console.log('Repeat steps 2-8 for:');
console.log('  - ArtDropFactory.sol\n');

console.log('Then run:');
console.log('  $env:PRIVATE_KEY="<your-key>"');
console.log('  npx node scripts/deploy-factory.mjs\n');

console.log('='.repeat(70));
console.log('\n✅ Alternative: Downgrade Node.js to 22 LTS\n');
console.log('If you prefer to use `hardhat compile` instead:\n');
console.log('1. Download Node.js 22 LTS from https://nodejs.org/');
console.log('2. Install it (can keep Node.js 25 parallel)');
console.log('3. Use nvm to switch: nvm use 22');
console.log('4. Run: npx hardhat compile');
console.log('5. Switch back: nvm use 25\n');

// Create a helper for manual bytecode injection
const helperContents = `/**
 * After compiling in Remix:
 * 1. Go to Solidity Compiler panel
 * 2. Expand "ArtDrop" contract
 * 3. Click copy bytecode (the long hex string starting with 0x)
 * 4. Paste it here:
 */

const ARTDROP_BYTECODE = "0x"; // Paste here

/**
 * Usage in deploy-factory.mjs:
 * 
 * const bytecodeFromRemix = ARTDROP_BYTECODE;
 * const tx = await factory.setArtDropBytecode(bytecodeFromRemix);
 * await tx.wait();
 */
`;

const helperPath = path.join(__dirname, 'remix-artifact-helper.js');
fs.writeFileSync(helperPath, helperContents);

console.log('💾 Created helper file: scripts/remix-artifact-helper.js');
console.log('   This file shows where to paste bytecode from Remix\n');
