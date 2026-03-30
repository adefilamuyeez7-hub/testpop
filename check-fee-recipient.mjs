import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const ART_DROP_ADDRESS = '0xe29f7bdd18929D2feAfd1FF36186C83305ab3e69';

// ABI fragment for feeRecipient
const abi = [
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
];

try {
  const feeRecipient = await publicClient.readContract({
    address: ART_DROP_ADDRESS,
    abi: abi,
    functionName: 'feeRecipient',
  });

  console.log('Fee Recipient:', feeRecipient);
  console.log('Is Zero Address:', feeRecipient === '0x0000000000000000000000000000000000000000');
  console.log('Fee Recipient Valid:', feeRecipient !== '0x0000000000000000000000000000000000000000');
} catch (error) {
  console.error('Error:', error.message);
}
