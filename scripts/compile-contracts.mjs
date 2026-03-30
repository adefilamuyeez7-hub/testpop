#!/usr/bin/env node

/**
 * Simple contract compilation script using solc directly
 * Bypasses hardhat configuration issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(__dirname, '../contracts');
const artifactsDir = path.join(__dirname, '../artifacts/contracts');

// Create artifacts directory if it doesn't exist
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

console.log('📖 Reading Solidity files...\n');

// Read contract source files
const artistContractPath = path.join(contractsDir, 'ArtDropArtist.sol');
const factoryContractPath = path.join(contractsDir, 'ArtDropFactory.sol');

const artistSource = fs.readFileSync(artistContractPath, 'utf8');
const factorySource = fs.readFileSync(factoryContractPath, 'utf8');

const sources = {
  'contracts/ArtDropArtist.sol': { content: artistSource },
  'contracts/ArtDropFactory.sol': { content: factorySource },
  '@openzeppelin/contracts/token/ERC721/ERC721.sol': {
    content: require('fs').readFileSync(
      path.join(__dirname, '../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol'),
      'utf8'
    ),
  },
};

console.log('✅ Files read successfully\n');
console.log('⏳ Compiling contracts...\n');

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
    evmVersion: 'cancun',
  },
};

try {
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    console.error('❌ Compilation errors:\n');
    output.errors.forEach((error) => {
      console.error(error.message);
    });
    process.exit(1);
  }

  console.log('✅ Compilation successful\n');

  // Save artifacts
  console.log('💾 Saving artifacts...\n');

  for (const [filePath, fileOutput] of Object.entries(output.contracts)) {
    for (const [contractName, contract] of Object.entries(fileOutput)) {
      const contractDir = path.join(artifactsDir, path.basename(filePath).replace('.sol', '.sol'));
      
      if (!fs.existsSync(contractDir)) {
        fs.mkdirSync(contractDir, { recursive: true });
      }

      const artifact = {
        _format: 'hh-sol-artifact-1',
        contractName,
        sourceName: filePath,
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: contract.evm.deployedBytecode.object,
        linkReferences: {},
        deployedLinkReferences: {},
      };

      const outputPath = path.join(contractDir, `${contractName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
      console.log(`✓ ${contractName}`);
    }
  }

  console.log('\n✅ Compilation complete! Artifacts saved.\n');

} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  process.exit(1);
}
