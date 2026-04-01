#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const solcImport = await import("solc");
const solc = solcImport.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(__dirname, "../contracts");
const nodeModulesDir = path.join(__dirname, "../node_modules");
const outputDir = path.join(__dirname, "../artifacts/contracts");

const sourceFile = "POAPCampaignV2.sol";
const contractPath = path.join(contractsDir, sourceFile);

function findImports(importPath) {
  const localContractPath = path.join(contractsDir, importPath);
  if (fs.existsSync(localContractPath)) {
    return { contents: fs.readFileSync(localContractPath, "utf8") };
  }

  const nodeModulePath = path.join(nodeModulesDir, importPath);
  if (fs.existsSync(nodeModulePath)) {
    return { contents: fs.readFileSync(nodeModulePath, "utf8") };
  }

  return { error: `File not found: ${importPath}` };
}

const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    [sourceFile]: { content: source },
  },
  settings: {
    evmVersion: "cancun",
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors?.length) {
  const errors = output.errors.filter((entry) => entry.severity === "error");
  if (errors.length) {
    console.error("Compilation failed:");
    for (const error of errors) {
      console.error(error.formattedMessage || error.message);
    }
    process.exit(1);
  }
}

const compiledContracts = output.contracts?.[sourceFile];
if (!compiledContracts?.POAPCampaignV2) {
  console.error("POAPCampaignV2 artifact missing from compiler output.");
  process.exit(1);
}

const artifactDir = path.join(outputDir, sourceFile);
fs.mkdirSync(artifactDir, { recursive: true });

const contract = compiledContracts.POAPCampaignV2;
const artifact = {
  _format: "hh-sol-artifact-1",
  contractName: "POAPCampaignV2",
  sourceName: sourceFile,
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object,
  deployedBytecode: contract.evm.deployedBytecode.object,
  linkReferences: {},
  deployedLinkReferences: {},
};

const artifactPath = path.join(artifactDir, "POAPCampaignV2.json");
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

console.log(`Compiled POAPCampaignV2 -> ${artifactPath}`);
