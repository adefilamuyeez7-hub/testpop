import { createPublicClient, createWalletClient, http, parseEther, getAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const ART_DROP_ADDRESS = '0xe29f7bdd18929D2feAfd1FF36186C83305ab3e69';

const abi = [
  {
    type: 'function',
    name: 'subscribe',
    inputs: [{ name: 'artist', type: 'address' }],
    outputs: [],
    stateMutability: 'payable',
  },
];

// Use a test account (you'll need to provide a real private key)
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';

if (PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
  console.error('⚠️ No PRIVATE_KEY provided. Please set PRIVATE_KEY environment variable.');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

async function testSubscribe() {
  try {
    // Simulate the transaction to check gas estimation and see errors
    const artistAddress = getAddress('0x74c567af7f2a2e8f5e9c1c1c1c1c1c1c1c1c1c1'); // random artist for testing
    const subscriptionAmount = parseEther('0.01');

    console.log('🔍 Testing subscribe transaction...');
    console.log('Artist:', artistAddress);
    console.log('Amount:', subscriptionAmount.toString(), 'wei (0.01 ETH)');
    console.log('Subscriber:', account.address);

    // Try to estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: ART_DROP_ADDRESS,
      abi: abi,
      functionName: 'subscribe',
      args: [artistAddress],
      value: subscriptionAmount,
      account: account.address,
    });

    console.log('✅ Gas Estimate:', gasEstimate.toString());

    // Try to call the function (non-payable simulation)
    const result = await publicClient.call({
      account: account.address,
      to: ART_DROP_ADDRESS,
      value: subscriptionAmount,
      data: undefined, // Would contain encoded function call
    });

    console.log('✅ Call Result:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('📋 Details:', error.details);
    }
    if (error.shortMessage) {
      console.error('📌 Short Message:', error.shortMessage);
    }
  }
}

testSubscribe();
