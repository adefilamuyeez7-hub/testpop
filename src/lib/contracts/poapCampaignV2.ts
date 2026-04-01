// ABI generated from contracts/POAPCampaignV2.sol
// Deployed on Base Sepolia on 2026-04-01.

export const POAP_CAMPAIGN_V2_ADDRESS = "0x63d62d1479345265EaA432846834449DE39568de" as const;

export const POAP_CAMPAIGN_V2_ABI = [
  {
    type: "function",
    name: "createCampaign",
    inputs: [
      { name: "metadataURI", type: "string" },
      { name: "entryMode", type: "uint8" },
      { name: "maxSupply", type: "uint256" },
      { name: "ticketPriceWei", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "redeemStartTime", type: "uint64" },
    ],
    outputs: [{ name: "campaignId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyEntries",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "grantContentCredits",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeContentCredits",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getRedeemableCount",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalCredits",
    inputs: [
      { name: "campaignId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "campaigns",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "artist", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "entryMode", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "maxSupply", type: "uint256" },
      { name: "minted", type: "uint256" },
      { name: "ticketPriceWei", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "redeemStartTime", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ethCredits",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "contentCredits",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "redeemedCredits",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawArtistBalance",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "artist", type: "address", indexed: true },
      { name: "entryMode", type: "uint8", indexed: false },
      { name: "maxSupply", type: "uint256", indexed: false },
      { name: "ticketPriceWei", type: "uint256", indexed: false },
      { name: "startTime", type: "uint64", indexed: false },
      { name: "endTime", type: "uint64", indexed: false },
      { name: "redeemStartTime", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EthEntriesPurchased",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "amountWei", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ContentCreditsGranted",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardsRedeemed",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
    ],
  },
] as const;
