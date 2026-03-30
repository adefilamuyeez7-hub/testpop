import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, getAddress } from 'viem';
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
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
];

const TEST_SUBSCRIBER = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092'; // fee recipient address
const SUBSCRIPTION_AMOUNT = parseEther('0.01');

async function auditSubscribe() {
  console.log('🔍 AUDITING SUBSCRIBE FUNCTION\n');

  try {
    // 1. Check fee recipient
    const feeRecipient = await publicClient.readContract({
      address: ART_DROP_ADDRESS,
      abi: abi,
      functionName: 'feeRecipient',
    });

    console.log('1. ✅ Fee Recipient:', feeRecipient);
    console.log('   - Is zero address:', feeRecipient === '0x0000000000000000000000000000000000000000');

    // 2. Try gas estimation WITHOUT sending ETH (simulate only)
    console.log('\n2. 🧪 Testing gas estimation for subscribe...');
    
    const encoded = encodeFunctionData({
      abi: abi,
      functionName: 'subscribe',
      args: [TEST_SUBSCRIBER],
    });

    console.log('   Function encoded:', encoded.slice(0, 50) + '...');
    console.log('   Sender:', TEST_SUBSCRIBER);
    console.log('   Amount:', SUBSCRIPTION_AMOUNT.toString(), 'wei (0.01 ETH)');

    // Try to estimate gas
    try {
      const gasEstimate = await publicClient.estimateGas({
        to: ART_DROP_ADDRESS,
        data: encoded,
        value: SUBSCRIPTION_AMOUNT,
        account: TEST_SUBSCRIBER,
      });

      console.log('   ✅ Gas estimate:', gasEstimate.toString());
    } catch (gasError) {
      console.log('   ❌ Gas estimation failed:', gasError.message);
      console.log('   Details:', gasError.details);

      // Try to get more info by calling
      console.log('\n3. 🔗 Attempting call simulation...');
      try {
        const callResult = await publicClient.call({
          to: ART_DROP_ADDRESS,
          data: encoded,
          value: SUBSCRIPTION_AMOUNT,
          account: TEST_SUBSCRIBER,
        });
        console.log('   Result:', callResult);
      } catch (callError) {
        console.log('   ❌ Call failed:', callError.message);
        if (callError.details) console.log('   📋', callError.details);
      }
    }

    // 4. Check if artist account exists and has balance
    console.log('\n4. 💰 Checking test artist account...');
    const artistBalance = await publicClient.getBalance({
      address: TEST_SUBSCRIBER,
    });
    console.log('   Test artist balance:', artistBalance.toString(), 'wei');

    // 5. Check feeRecipient account
    console.log('\n5. 💰 Checking fee recipient account...');
    const feeRecipientBalance = await publicClient.getBalance({
      address: feeRecipient,
    });
    console.log('   Fee recipient balance:', feeRecipientBalance.toString(), 'wei');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

auditSubscribe();
