// Contract references for ArtDropFactory
// Deployed on Base Sepolia. Override with VITE_FACTORY_ADDRESS for replacement deployments.

export const FACTORY_ADDRESS =
  ((import.meta.env.VITE_FACTORY_ADDRESS as string | undefined)?.trim() as
    | `0x${string}`
    | undefined) ??
  ("0x2d044a0AFAbE0C07Ee12b8f4c18691b82fb6cF01" as const);

export const FACTORY_ABI = [
  // Events
  {
    type: "event",
    name: "ArtDropDeployed",
    inputs: [
      { name: "artist", type: "address", indexed: true },
      { name: "artDropContract", type: "address", indexed: true },
      { name: "founder", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ArtDropBytecodeSet",
    inputs: [{ name: "bytecodeLength", type: "uint256", indexed: false }],
  },
  {
    type: "event",
    name: "FactoryOwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "FounderWalletUpdated",
    inputs: [
      { name: "previousFounder", type: "address", indexed: true },
      { name: "newFounder", type: "address", indexed: true },
    ],
  },

  // State variables
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "founderWallet",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "artistToContract",
    inputs: [{ name: "_artist", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "contractToArtist",
    inputs: [{ name: "_contract", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },

  // Core functions
  {
    type: "function",
    name: "deployArtDrop",
    inputs: [{ name: "_artistWallet", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setArtDropBytecode",
    inputs: [{ name: "_bytecode", type: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // View functions
  {
    type: "function",
    name: "getArtistContract",
    inputs: [{ name: "_artist", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getContractArtist",
    inputs: [{ name: "_contract", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllDeployedContracts",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDeploymentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isDeployedContract",
    inputs: [{ name: "_contract", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // Admin functions
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "_newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateFounderWallet",
    inputs: [{ name: "_newFounder", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
