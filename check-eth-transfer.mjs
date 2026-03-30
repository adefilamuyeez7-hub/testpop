import { createPublicClient, http, getAddress } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', { timeout: 30_000, retryCount: 3 }),
});

// The feeRecipient from the deployed contract
const FEE_RECIPIENT = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092';

async function checkAddressType(address) {
  console.log(`\n🔍 Checking: ${address}`);

  try {
    // Get the code at the address
    const code = await publicClient.getCode({ address });
    
    console.log('   Code returned:', typeof code, code === '0x' ? 'IS ZERO ADDRESS' : 'HAS CODE');
    
    if (code === '0x') {
      console.log('   ✅ Type: EOA (Externally Owned Account)');
      console.log('   ✅ Can receive ETH: YES');
      return 'EOA';
    } else {
      console.log('   🤖 Type: Smart Contract (has code)');
      console.log('   ⚠️  Requires fallback/receive to accept ETH');
      return 'CONTRACT';
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return 'ERROR';
  }
}

async function audit() {
  console.log('🔍 AUDIT: Check if ETH Transfer is Possible\n');

  // Check fee recipient
  await checkAddressType(FEE_RECIPIENT);

  // Check a known public EOA
  await checkAddressType('0x1111111111111111111111111111111111111111');
}

audit();
