import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet, metaMask, walletConnect } from "wagmi/connectors";
import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

export const ACTIVE_CHAIN = baseSepolia;

const networks = [baseSepolia, base] as const;

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "POPUP",
    description: "Drop it. Own it. Get paid.",
    url: "https://pop-up.fun",
    icons: ["https://pop-up.fun/favicon.ico"],
  },
  features: {
    analytics: false,
  },
  themeMode: "dark",
});

export const config = wagmiAdapter.wagmiConfig;

// Keep backward compat
const BASE_RPC = import.meta.env.VITE_BASE_RPC_URL || "https://mainnet.base.org";
const BASE_SEPOLIA_RPC = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
