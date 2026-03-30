import { createPublicClient, http, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', { timeout: 30_000, retryCount: 3 }),
});

const NEW_ART_DROP = '0xf5bedee37de384305a29d2af644d358c5958e15a';

const abi = [
  {
    type: 'function',
    name: 'subscribe',
    inputs: [{ name: 'artist', type: 'address' }],
    outputs: [],
    stateMutability: 'payable',
  },
];

async function testNewContract() {
  console.log('🔍 Testing new ArtDrop contract with ETH transfer fix\n');
  console.log('Contract address:', NEW_ART_DROP);

  // Test with the same address that was failing before
  const artistAddress = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092';

  const encoded = encodeFunctionData({
    abi: abi,
    functionName: 'subscribe',
    args: [artistAddress],
  });

  try {
    // Try calling the function
    const result = await publicClient.call({
      to: NEW_ART_DROP,
      data: encoded,
      value: BigInt('10000000000000000'), // 0.01 ETH
      account: '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092',
    });

    console.log('✅ Subscribe call succeeded!');
    console.log('Result:', result);
  } catch (error) {
    console.log('Result:', error.message);
    
    if (error.message.includes('execution reverted')) {
      console.log('❌ Still reverting - address issue');
    } else if (error.message.includes('Network request failed') || error.message.includes('timeout')) {
      console.log('⚠️  RPC timeout/network issue');
    } else {
      console.log('Other error:', error.details);
    }
  }
}

testNewContract();
