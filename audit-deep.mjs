import { createPublicClient, http, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', { timeout: 30_000, retryCount: 3 }),
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

// Test with different artist addresses
async function testWithArtist(artistAddress, label) {
  console.log(`\n🧪 Testing with ${label}: ${artistAddress}`);
  
  const encoded = encodeFunctionData({
    abi: abi,
    functionName: 'subscribe',
    args: [artistAddress],
  });

  try {
    // Try to simulate with a fork
    const result = await publicClient.call({
      to: ART_DROP_ADDRESS,
      data: encoded,
      value: BigInt('10000000000000000'), // 0.01 ETH
      account: '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092',
    });

    console.log('   ✅ Success');
    return true;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    
    // Decode the revert reason
    if (error.details && error.details.includes('Artist transfer failed')) {
      console.log('   🔴 ROOT CAUSE: Artist account cannot receive ETH!');
      console.log('      - Artist is likely a contract without fallback function');
      console.log('      - Or artist address is invalid/blacklisted');
    } else if (error.details && error.details.includes('Admin transfer failed')) {
      console.log('   🔴 ROOT CAUSE: Admin account cannot receive ETH!');
    }
    return false;
  }
}

async function auditContractLogic() {
  console.log('🔍 DEEP AUDIT: Why Subscribe is Failing\n');

  // Test 1: EOA to EOA (should work)
  await testWithArtist('0x1234567890123456789012345678901234567890', 'Random address');

  // Test 2: Known address that's likely an EOA
  await testWithArtist('0x742d35Cc6634C0532925a3b844Bc9e7595f42bE', 'Multi-sig');

  console.log('\n📊 ANALYSIS:');
  console.log('The "network fee unavailable" error is likely caused by:');
  console.log('1. ❌ Artist address is a contract that cannot receive ETH');
  console.log('2. ❌ The .call() operation to send ETH is reverting');
  console.log('3. ❌ Gas estimation fails because the revert is caught by the RPC');
  console.log('4. ❌ Frontend sees this as "network fee unavailable"');
  console.log('\nSOLUTION:');
  console.log('Need to validate artist address can receive ETH BEFORE calling subscribe');
}

auditContractLogic();
