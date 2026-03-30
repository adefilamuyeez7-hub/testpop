// ABI generated from contracts/ProductStore.sol
// Contract: ProductStore — physical/digital product sales with royalties
// IMPORTANT: This contract is NOT deployed yet (address is zero).
// Update PRODUCT_STORE_ADDRESS after deployment.
//
// Revenue model:
//   platformCommissionPercent (default 5%) goes to platformBalance
//   Remainder goes to artistBalances[creator] — artists withdraw themselves
//   royaltyPercent on Product is a display field only; actual split is fixed above

export const PRODUCT_STORE_ADDRESS =
  "0x58BB50b4370898dED4d5d724E4A521825a4B0cE6" as const;

export const PRODUCT_STORE_ABI = [
  {
    type: "function",
    name: "createProduct",
    inputs: [
      { name: "_metadataURI", type: "string" },
      { name: "_price", type: "uint256" },
      { name: "_stock", type: "uint256" },
      { name: "_royaltyPercent", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateProductStatus",
    inputs: [
      { name: "_productId", type: "uint256" },
      { name: "_active", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addToCart",
    inputs: [
      { name: "_productId", type: "uint256" },
      { name: "_quantity", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeFromCart",
    inputs: [{ name: "_productId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCart",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "productId", type: "uint256" },
          { name: "quantity", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "clearCart",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyProduct",
    inputs: [
      { name: "_productId", type: "uint256" },
      { name: "_quantity", type: "uint256" },
      { name: "_orderMetadata", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "checkoutCart",
    inputs: [{ name: "_orderMetadata", type: "string" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fulfillOrder",
    inputs: [{ name: "_orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getUserOrders",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOrder",
    inputs: [{ name: "_orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "orderId", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "productId", type: "uint256" },
          { name: "quantity", type: "uint256" },
          { name: "totalPrice", type: "uint256" },
          { name: "orderMetadata", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "fulfilled", type: "bool" },
        ],
      },
    ],
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
    type: "function",
    name: "withdrawPlatformBalance",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getArtistBalance",
    inputs: [{ name: "_artist", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPlatformCommission",
    inputs: [{ name: "_percent", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getProduct",
    inputs: [{ name: "_productId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "metadataURI", type: "string" },
          { name: "price", type: "uint256" },
          { name: "stock", type: "uint256" },
          { name: "sold", type: "uint256" },
          { name: "royaltyPercent", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ProductCreated",
    inputs: [
      { name: "productId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "royaltyPercent", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProductUpdated",
    inputs: [
      { name: "productId", type: "uint256", indexed: true },
      { name: "active", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProductAddedToCart",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "productId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CartCleared",
    inputs: [{ name: "buyer", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "PurchaseCompleted",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "productId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "totalPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",    name: "ArtistWithdrawal",
    inputs: [
      { name: "artist", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlatformWithdrawal",
    inputs: [
      { name: "owner",  type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",    name: "ProductFulfilled",
    inputs: [{ name: "orderId", type: "uint256", indexed: true }],
  },
  {
    type: "function",
    name: "nextProductId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "nextOrderId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",    name: "platformCommissionPercent",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "products",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "creator", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "price", type: "uint256" },
      { name: "stock", type: "uint256" },
      { name: "sold", type: "uint256" },
      { name: "royaltyPercent", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "createdAt", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "orders",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "orderId",       type: "uint256" },
      { name: "buyer",         type: "address" },
      { name: "productId",     type: "uint256" },
      { name: "quantity",      type: "uint256" },
      { name: "totalPrice",    type: "uint256" },
      { name: "orderMetadata", type: "string"  },
      { name: "timestamp",     type: "uint256" },
      { name: "fulfilled",     type: "bool"    },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "artistBalances",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
