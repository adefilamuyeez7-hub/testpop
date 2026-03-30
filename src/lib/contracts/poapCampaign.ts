// ABI generated from contracts/POAPCampaign.sol
// Contract: POAPCampaign — ERC-721 POAP system for artist campaigns
// Campaign types: 0=Auction, 1=Content, 2=Subscriber
// Campaign statuses: 0=Active, 1=Ended, 2=Cancelled
// Deployed on Base Sepolia (testnet)

export const POAP_CAMPAIGN_ADDRESS = "0x0fcb25EA06cB29296080C203119c25f9923A02ad" as const;

export const POAP_CAMPAIGN_ABI = [
  {
    type: "function",
    name: "createCampaign",
    inputs: [
      { name: "_uri", type: "string" },
      { name: "_type", type: "uint8" },
      { name: "_maxSupply", type: "uint256" },
      { name: "_startTime", type: "uint64" },
      { name: "_endTime", type: "uint64" },
      { name: "_subPct", type: "uint8" },
      { name: "_bidPct", type: "uint8" },
      { name: "_creatorPct", type: "uint8" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "placeBid",
    inputs: [{ name: "_campaignId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "settleAuction",
    inputs: [{ name: "_campaignId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "_campaignId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "distribute",
    inputs: [
      { name: "_campaignId", type: "uint256" },
      { name: "_to", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelCampaign",
    inputs: [{ name: "_campaignId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "campaigns",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "artist",       type: "address" },
      { name: "metadataURI",  type: "string"  },
      { name: "campaignType", type: "uint8"   },
      { name: "status",       type: "uint8"   },
      { name: "maxSupply",    type: "uint256" },
      { name: "minted",       type: "uint256" },
      { name: "startTime",    type: "uint64"  },
      { name: "endTime",      type: "uint64"  },
      {
        name: "tier",
        type: "tuple",
        components: [
          { name: "subscriberPct", type: "uint8" },
          { name: "bidderPct",     type: "uint8" },
          { name: "creatorPct",    type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "artist", type: "address", indexed: true },
      { name: "cType", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "POAPClaimed",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BidPlaced",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "bidder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AuctionSettled",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "winnerCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BidRefunded",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "bidder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CampaignCancelled",
    inputs: [
      { name: "campaignId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenCampaign",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "supportsInterface",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "claimed",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextCampaignId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextTokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
