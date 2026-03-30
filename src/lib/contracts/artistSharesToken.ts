// ABI generated from contracts/ArtistSharesToken.sol
// Contract: ArtistSharesToken — ERC-20 with artist fundraising capabilities
// Deployed on Base Sepolia: https://sepolia.basescan.org/address/0x6CCDAD96591d0Bd2e97070dD2a96E56d7ce6BC97

export const ARTIST_SHARES_TOKEN_ADDRESS = "0x6CCDAD96591d0Bd2e97070dD2a96E56d7ce6BC97" as const;

export const ARTIST_SHARES_TOKEN_ABI = [
  // ─── Events ──────────────────────────────────────────────────────

  {
    type: "event",
    name: "CampaignStarted",
    inputs: [
      { name: "targetAmount", type: "uint256", indexed: false },
      { name: "pricePerShare", type: "uint256", indexed: false },
      { name: "endTime", type: "uint64", indexed: false },
    ],
  },

  {
    type: "event",
    name: "SharesPurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
      { name: "amountPaid", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "CampaignEnded",
    inputs: [
      { name: "totalRaised", type: "uint256", indexed: false },
      { name: "successful", type: "bool", indexed: false },
    ],
  },

  {
    type: "event",
    name: "RevenueDistributed",
    inputs: [
      { name: "distributor", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "ShareholderClaimed",
    inputs: [
      { name: "shareholder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "CampaignCancelled",
    inputs: [
      { name: "returnedAmount", type: "uint256", indexed: false },
    ],
  },

  // ─── Read Functions ──────────────────────────────────────────────

  {
    type: "function",
    name: "artist",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "totalShares",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "totalRevenueDistributed",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getCampaignStatus",
    inputs: [],
    outputs: [
      { name: "target", type: "uint256" },
      { name: "raised", type: "uint256" },
      { name: "pricePerShare", type: "uint256" },
      { name: "endTime", type: "uint64" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getRevenueClaim",
    inputs: [{ name: "_shareholder", type: "address" }],
    outputs: [{ name: "claimable", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "claimedRevenue",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ─── Write Functions ─────────────────────────────────────────────

  {
    type: "function",
    name: "launchCampaign",
    inputs: [
      { name: "_targetAmount", type: "uint256" },
      { name: "_sharesForTarget", type: "uint256" },
      { name: "_durationDays", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "buyShares",
    inputs: [{ name: "_amountEth", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },

  {
    type: "function",
    name: "closeCampaign",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "distributeRevenue",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },

  {
    type: "function",
    name: "claimRevenue",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── ERC20 Standard Functions ────────────────────────────────────

  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
  },

  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },

  // ─── Constructor ──────────────────────────────────────────────────

  {
    type: "constructor",
    inputs: [{ name: "_artist", type: "address" }],
    stateMutability: "nonpayable",
  },
];
