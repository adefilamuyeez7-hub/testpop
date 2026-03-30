#!/usr/bin/env node

/**
 * Compile Solidity contracts using solc
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

// Helper to read OZ files (optional - won't fail if missing)
function readOZFile(name, optional = false) {
  try {
    return fs.readFileSync(path.join(nodeModulesDir, '@openzeppelin/contracts', name), 'utf8');
  } catch (e) {
    if (optional) {
      console.log(`  ⚠️  Skipping optional: @openzeppelin/contracts/${name}`);
      return null;
    }
    console.error(`❌ Could not read @openzeppelin/contracts/${name}`);
    throw e;
  }
}

console.log('📦 Loading OpenZeppelin dependencies...');

const sources = {
  'ArtDropArtist.sol': { content: artistSource },
  'ArtDropFactory.sol': { content: factorySource },
  '@openzeppelin/contracts/token/ERC721/ERC721.sol': { content: readOZFile('token/ERC721/ERC721.sol') },
  '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol': { content: readOZFile('token/ERC721/extensions/ERC721URIStorage.sol') },
  '@openzeppelin/contracts/access/Ownable.sol': { content: readOZFile('access/Ownable.sol') },
  '@openzeppelin/contracts/utils/ReentrancyGuard.sol': { content: readOZFile('utils/ReentrancyGuard.sol') },
  '@openzeppelin/contracts/token/ERC721/IERC721.sol': { content: readOZFile('token/ERC721/IERC721.sol') },
  '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol': { content: readOZFile('token/ERC721/extensions/IERC721Metadata.sol') },
  '@openzeppelin/contracts/utils/introspection/ERC165.sol': { content: readOZFile('utils/introspection/ERC165.sol') },
  '@openzeppelin/contracts/utils/introspection/IERC165.sol': { content: readOZFile('utils/introspection/IERC165.sol') },
  '@openzeppelin/contracts/utils/Strings.sol': { content: readOZFile('utils/Strings.sol') },
  '@openzeppelin/contracts/utils/Math.sol': { content: readOZFile('utils/Math.sol', true) },
  '@openzeppelin/contracts/access/Ownable2Step.sol': { content: readOZFile('access/Ownable2Step.sol', true) },
};

// Filter out null values (optional dependencies that don't exist)
for (const key of Object.keys(sources)) {
  if (sources[key].content === null) {
    delete sources[key];
  }
}

console.log('✓ Dependencies loaded\n');

const input = {
  language: 'Solidity',
  sources,
  settings: {
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

try {
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors && output.errors.length > 0) {
    const hasErrors = output.errors.some(e => e.severity === 'error');
    if (hasErrors) {
      console.error('❌ Compilation errors:\n');
      output.errors.forEach(e => console.error(e.message));
      process.exit(1);
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
