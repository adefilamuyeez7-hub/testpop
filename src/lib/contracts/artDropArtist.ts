/**
 * ART DROP ARTIST CONTRACT ABI
 * 
 * This ABI is for ArtDropArtist.sol - the per-artist contract.
 * Each artist/creator has ONE instance of this contract deployed via ArtDropFactory.
 * 
 * Key points:
 * - Contract name internally: "ArtDrop"
 * - Deployed per-artist with immutable artist + founderWallet
 * - Artists create drops via createDrop()
 * - Collectors mint from drops via mint()
 * - Collectors subscribe to artist via subscribe()
 * - Subscription counting: increments only on FIRST subscription, not renewals
 * - isSubscriptionActive() = has subscribed AND expiry not passed
 */

// NOTE: This is NOT a fixed address - use artist.contractAddress from Supabase
// Frontend must look up the artist's contract address from the database
export const ARTIST_DROP_ABI = [
  // ════════════════════════════════════════════════════════
  // EVENTS
  // ════════════════════════════════════════════════════════
  {
    type: "event",
    name: "DropCreated",
    inputs: [
      { name: "dropId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "maxSupply", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "ArtMinted",
    inputs: [
      { name: "dropId", type: "uint256", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "collector", type: "address", indexed: true },
    ],
  },

  {
    type: "event",
    name: "DropPaused",
    inputs: [
      { name: "dropId", type: "uint256", indexed: true },
      { name: "paused", type: "bool", indexed: false },
    ],
  },

  {
    type: "event",
    name: "NewSubscription",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "artistShare", type: "uint256", indexed: false },
      { name: "founderShare", type: "uint256", indexed: false },
      { name: "expiryTime", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "SubscriptionRenewed",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newExpiryTime", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "SubscriptionCancelled",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
    ],
  },

  {
    type: "event",
    name: "SubscriptionFundsDistributed",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "recipientType", type: "string", indexed: false },
    ],
  },

  {
    type: "event",
    name: "SubscriptionFundsPending",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },

  {
    type: "event",
    name: "FounderFeesWithdrawn",
    inputs: [
      { name: "founder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "MinSubscriptionFeeSet",
    inputs: [
      { name: "newFee", type: "uint256", indexed: false },
    ],
  },

  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  // ════════════════════════════════════════════════════════
  // ARTIST FUNCTIONS - Drop Management
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "createDrop",
    inputs: [
      { name: "_metadataURI", type: "string" },
      { name: "_priceWei", type: "uint256" },
      { name: "_maxSupply", type: "uint256" },
      { name: "_startTime", type: "uint64" },
      { name: "_endTime", type: "uint64" },
    ],
    outputs: [{ name: "dropId", type: "uint256" }],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "togglePause",
    inputs: [{ name: "_dropId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "setMintFee",
    inputs: [{ name: "_bps", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "setMinSubscriptionFee",
    inputs: [{ name: "_fee", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ════════════════════════════════════════════════════════
  // COLLECTOR FUNCTIONS - Minting
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "mint",
    inputs: [{ name: "_dropId", type: "uint256" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "payable",
  },

  // ════════════════════════════════════════════════════════
  // COLLECTOR FUNCTIONS - Subscriptions
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "subscribe",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },

  {
    type: "function",
    name: "cancelSubscription",
    inputs: [{ name: "_subscriber", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ════════════════════════════════════════════════════════
  // WITHDRAWAL FUNCTIONS
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "withdraw",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "withdrawFounderFees",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ════════════════════════════════════════════════════════
  // READ FUNCTIONS - Drop Info
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "getDrop",
    inputs: [{ name: "_dropId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "metadataURI", type: "string" },
          { name: "priceWei", type: "uint256" },
          { name: "maxSupply", type: "uint256" },
          { name: "minted", type: "uint256" },
          { name: "startTime", type: "uint64" },
          { name: "endTime", type: "uint64" },
          { name: "paused", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getDropMinted",
    inputs: [{ name: "_dropId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ════════════════════════════════════════════════════════
  // READ FUNCTIONS - Subscription Info
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "isSubscribed",
    inputs: [{ name: "_subscriber", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "isSubscriptionActive",
    inputs: [{ name: "_subscriber", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getSubscriptionAmount",
    inputs: [{ name: "_subscriber", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getSubscriberCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "getSubscriptionTimeRemaining",
    inputs: [{ name: "_subscriber", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ════════════════════════════════════════════════════════
  // STATE VARIABLES (readable)
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "artist",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "founderWallet",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "minSubscriptionFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "platformFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "subscriberCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "totalSubscriptionRevenue",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ════════════════════════════════════════════════════════
  // ERC721 OVERRIDES
  // ════════════════════════════════════════════════════════
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
    stateMutability: "view",
  },

  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
