import { createWalletClient, createPublicClient, http, parseEther, getAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.startsWith('PRIVATE_KEY=')) {
    envVars.PRIVATE_KEY = line.split('=')[1].trim();
  }
});

const PRIVATE_KEY = envVars.PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY not found in .env or environment');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

// Read the compiled contract
const artifactPath = './artifacts/contracts/ArtDrop.sol/ArtDrop.json';
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
const bytecode = artifact.bytecode;

const ABI = artifact.abi;

// Fee recipient (deployer address in this case)
const FEE_RECIPIENT = account.address;

async function deploy() {
  console.log('🚀 Deploying ArtDrop contract with ETH transfer fix...\n');
  console.log('Deployer:', account.address);
  console.log('Fee Recipient:', FEE_RECIPIENT);
  console.log('Network: Base Sepolia (84532)\n');

  try {
    // Deploy contract
    const hash = await walletClient.deployContract({
      abi: ABI,
      bytecode: bytecode,
      args: [FEE_RECIPIENT],
      account,
    });

    console.log('📝 Deployment hash:', hash);
    console.log('⏳ Waiting for confirmation...\n');

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('✅ Contract deployed successfully!');
      console.log('📍 Contract address:', receipt.contractAddress);
      console.log('Block number:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Save deployment info
      const deploymentInfo = {
        contract: 'ArtDrop',
        address: receipt.contractAddress,
        deployer: account.address,
        feeRecipient: FEE_RECIPIENT,
        network: 'baseSepolia',
        chainId: 84532,
        rpcUrl: 'https://sepolia.base.org',
        timestamp: new Date().toISOString(),
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
        transactionHash: hash,
      };

      // Save to file
      const filename = `deployments/baseSepolia_ArtDrop_${Date.now()}.json`;
      fs.mkdirSync('deployments', { recursive: true });
      fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
      console.log(`\n📄 Deployment info saved to: ${filename}`);

      console.log('\n✨ Update this address in src/lib/contracts/artDrop.ts:');
      console.log(`export const ART_DROP_ADDRESS = "${receipt.contractAddress}" as const;`);
    } else {
      console.error('❌ Deployment failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deploy();
