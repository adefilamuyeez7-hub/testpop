#!/usr/bin/env node

/**
 * Compile Solidity contracts using solc with import callback support
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const solcImport = await import('solc');
const solc = solcImport.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const contractsDir = path.join(__dirname, '../contracts');
const nodeModulesDir = path.join(__dirname, '../node_modules');
const outputDir = path.join(__dirname, '../artifacts/contracts');

// Read contract files
const artistPath = path.join(contractsDir, 'ArtDropArtist.sol');
const factoryPath = path.join(contractsDir, 'ArtDropFactory.sol');

console.log('📖 Reading contract files...');

let artistSource, factorySource;
try {
  artistSource = fs.readFileSync(artistPath, 'utf8');
  factorySource = fs.readFileSync(factoryPath, 'utf8');
  console.log('✓ Contracts read\n');
} catch(e) {
  console.error('❌ Error reading files:', e.message);
  process.exit(1);
}

const input = {
  language: 'Solidity',
  sources: {
    'ArtDropArtist.sol': { content: artistSource },
    'ArtDropFactory.sol': { content: factorySource },
  },
  settings: {
    evmVersion: 'cancun',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

console.log('⏳ Compiling...\n');

// Create import callback for solc to resolve OpenZeppelin imports
function findImports(importPath) {
  // If it's a relative path in our contracts dir, resolve it there
  const contractPath = path.join(contractsDir, importPath);
  if (fs.existsSync(contractPath)) {
    return { contents: fs.readFileSync(contractPath, 'utf8') };
  }
  
  // Otherwise, try node_modules
  const nodeModulePath = path.join(nodeModulesDir, importPath);
  if (fs.existsSync(nodeModulePath)) {
    return { contents: fs.readFileSync(nodeModulePath, 'utf8') };
  }
  
  return { error: `File not found: ${importPath}` };
}

try {
  // Use findImports callback for import resolution
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors && output.errors.length > 0) {
    const hasErrors = output.errors.some(e => e.severity === 'error');
    if (hasErrors) {
      console.error('❌ Compilation errors:\n');
      output.errors.forEach(e => {
        console.error(`File: ${e.sourceLocation?.file || 'unknown'}`);
        console.error(`Line: ${e.sourceLocation?.start || 'unknown'}`);
        console.error(`Message: ${e.message}\n`);
      });
      process.exit(1);
    } else {
      console.log('⚠️  Warnings:\n');
      output.errors.forEach(e => console.log(e.message));
    }
  }

  console.log('✅ Compilation successful\n');
  console.log('💾 Saving artifacts...\n');

  // Create directories and save artifacts for our contracts only
  for (const sourceFile of ['ArtDropArtist.sol', 'ArtDropFactory.sol']) {
    const contracts = output.contracts[sourceFile];
    if (!contracts) continue;

    for (const [contractName, contract] of Object.entries(contracts)) {
      const dir = path.join(outputDir, sourceFile.replace('.sol', '.sol'));
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const artifact = {
        _format: 'hh-sol-artifact-1',
        contractName,
        sourceName: sourceFile,
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: contract.evm.deployedBytecode.object,
        linkReferences: {},
        deployedLinkReferences: {},
      };

      const outputPath = path.join(dir, `${contractName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
      console.log(`✓ ${contractName}`);
    }
  }

  console.log('\n✅ Compilation complete!\n');

} catch(error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
