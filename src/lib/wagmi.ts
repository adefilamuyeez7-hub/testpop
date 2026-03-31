import { base, baseSepolia } from "wagmi/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || "";

export const ACTIVE_CHAIN = baseSepolia;

export const networks = [baseSepolia, base] as const;

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

export const config = wagmiAdapter.wagmiConfig;
