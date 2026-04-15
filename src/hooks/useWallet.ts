import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

export function useWallet() {
  const { address, chain, connector, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });
  const { data: walletClient } = useWalletClient({
    query: {
      enabled: Boolean(address),
    },
  });
  const { switchChainAsync, isPending: isSwitchingNetwork } = useSwitchChain();

  async function connectWallet() {
    const connectorToUse = connectors[0];
    if (!connectorToUse) {
      throw new Error("No wallet connector is available.");
    }

    return connectAsync({ connector: connectorToUse });
  }

  async function connectWeb3Auth() {
    return connectWallet();
  }

  async function requestActiveChainSwitch(message?: string) {
    if (!address) {
      throw new Error(message || "Connect a wallet before switching networks.");
    }

    if (chain?.id === ACTIVE_CHAIN.id) {
      return chain;
    }

    try {
      return await switchChainAsync({ chainId: ACTIVE_CHAIN.id });
    } catch (error) {
      const fallbackMessage =
        message || `Switch your wallet to ${ACTIVE_CHAIN.name} and try again.`;
      throw new Error(error instanceof Error ? error.message : fallbackMessage);
    }
  }

  return {
    address,
    balance,
    chain,
    connectorName: connector?.name || "",
    connectWallet,
    connectWeb3Auth,
    disconnect,
    isConnected,
    isConnecting: isConnecting || isReconnecting || isPending,
    isSwitchingNetwork,
    requestActiveChainSwitch,
    signer: walletClient ?? null,
  };
}
