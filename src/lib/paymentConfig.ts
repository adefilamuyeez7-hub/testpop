/**
 * Multi-chain USDC/USDT Payment Configuration
 * Supports: Base, Polygon, Optimism, Arbitrum
 */

export type PaymentChain = "base" | "polygon" | "optimism" | "arbitrum";
export type TokenType = "USDC" | "USDT";

export interface PaymentOption {
  id: string;
  label: string;
  description: string;
  chain: PaymentChain;
  token: TokenType;
  tokenAddress: string;
  decimals: number;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  isActive: boolean;
}

/**
 * Supported payment options across chains
 * USDC uses same address on most chains, USDT varies
 */
export const PAYMENT_OPTIONS: Record<string, PaymentOption> = {
  // Base Network (Primary recommendation)
  "usdc-base": {
    id: "usdc-base",
    label: "USDC (Base)",
    description: "Fastest and cheapest option",
    chain: "base",
    token: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    chainId: 8453,
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    isTestnet: false,
    isActive: true,
  },

  "usdt-base": {
    id: "usdt-base",
    label: "USDT (Base)",
    description: "Alternative stablecoin on Base",
    chain: "base",
    token: "USDT",
    tokenAddress: "0xfde4C96c8593536E31F26ECd50712f94295e27e7",
    decimals: 6,
    chainId: 8453,
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    isTestnet: false,
    isActive: true,
  },

  // Polygon Network (Low cost)
  "usdc-polygon": {
    id: "usdc-polygon",
    label: "USDC (Polygon)",
    description: "Low cost, multichain liquidity",
    chain: "polygon",
    token: "USDC",
    tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
    chainId: 137,
    chainName: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    isTestnet: false,
    isActive: true,
  },

  "usdt-polygon": {
    id: "usdt-polygon",
    label: "USDT (Polygon)",
    description: "Alternative on Polygon",
    chain: "polygon",
    token: "USDT",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    chainId: 137,
    chainName: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    isTestnet: false,
    isActive: true,
  },

  // Optimism Network
  "usdc-optimism": {
    id: "usdc-optimism",
    label: "USDC (Optimism)",
    description: "Fast and reliable",
    chain: "optimism",
    token: "USDC",
    tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d53F0658",
    decimals: 6,
    chainId: 10,
    chainName: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    isTestnet: false,
    isActive: true,
  },

  "usdt-optimism": {
    id: "usdt-optimism",
    label: "USDT (Optimism)",
    description: "Alternative on Optimism",
    chain: "optimism",
    token: "USDT",
    tokenAddress: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    decimals: 6,
    chainId: 10,
    chainName: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    isTestnet: false,
    isActive: true,
  },

  // Arbitrum Network
  "usdc-arbitrum": {
    id: "usdc-arbitrum",
    label: "USDC (Arbitrum)",
    description: "High-speed trading",
    chain: "arbitrum",
    token: "USDC",
    tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    chainId: 42161,
    chainName: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    isTestnet: false,
    isActive: true,
  },

  "usdt-arbitrum": {
    id: "usdt-arbitrum",
    label: "USDT (Arbitrum)",
    description: "Alternative on Arbitrum",
    chain: "arbitrum",
    token: "USDT",
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    chainId: 42161,
    chainName: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    isTestnet: false,
    isActive: true,
  },
};

/**
 * Get active payment options (production-ready)
 */
export function getActivePaymentOptions(): PaymentOption[] {
  return Object.values(PAYMENT_OPTIONS).filter((opt) => opt.isActive && !opt.isTestnet);
}

/**
 * Get payment options by chain
 */
export function getPaymentOptionsByChain(chain: PaymentChain): PaymentOption[] {
  return Object.values(PAYMENT_OPTIONS)
    .filter((opt) => opt.chain === chain && opt.isActive)
    .sort((a, b) => {
      // USDC first, then USDT
      if (a.token !== b.token) {
        return a.token === "USDC" ? -1 : 1;
      }
      return 0;
    });
}

/**
 * Get unique chains with active options
 */
export function getActiveChains(): PaymentChain[] {
  const chains = new Set(
    Object.values(PAYMENT_OPTIONS)
      .filter((opt) => opt.isActive)
      .map((opt) => opt.chain)
  );
  return Array.from(chains).sort();
}

/**
 * Payment processor configuration (Stripe + Coinbase)
 */
export interface OnrampConfig {
  provider: "coinbase" | "stripe";
  isEnabled: boolean;
  apiKey?: string;
}

export const ONRAMP_CONFIG: Record<string, OnrampConfig> = {
  coinbase: {
    provider: "coinbase",
    isEnabled: !!import.meta.env.VITE_COINBASE_PAY_APP_ID,
    apiKey: import.meta.env.VITE_COINBASE_PAY_APP_ID,
  },
  stripe: {
    provider: "stripe",
    isEnabled: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    apiKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  },
};

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 6): string {
  return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Parse token amount to wei
 */
export function parseTokenAmount(amount: string, decimals: number = 6): bigint {
  const [integer, fractional] = amount.split(".");
  const frac = fractional ? fractional.padEnd(decimals, "0").slice(0, decimals) : "".padEnd(decimals, "0");
  return BigInt(integer + frac);
}
