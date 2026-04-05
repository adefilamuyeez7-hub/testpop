import { useEffect, useRef, type ReactNode } from "react";
import { useAccount, WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { establishSecureSession } from "@/lib/secureAuth";
import { clearRuntimeSession, getRuntimeSession } from "@/lib/runtimeSession";

type WalletRuntimeProviderProps = {
  children: ReactNode;
};

function WalletRuntimeSessionBridge() {
  const { address, isConnected } = useAccount();
  const attemptedWalletRef = useRef<string>("");

  useEffect(() => {
    const normalizedAddress = address?.trim().toLowerCase() || "";
    const runtimeSession = getRuntimeSession();

    if (!isConnected || !normalizedAddress) {
      attemptedWalletRef.current = "";
      if (runtimeSession.wallet || runtimeSession.apiToken || runtimeSession.role || runtimeSession.supabaseToken) {
        clearRuntimeSession();
      }
      return;
    }

    if (runtimeSession.wallet && runtimeSession.wallet.trim().toLowerCase() !== normalizedAddress) {
      clearRuntimeSession();
      attemptedWalletRef.current = "";
    }

    const nextRuntimeSession = getRuntimeSession();
    const hasMatchingSecureSession =
      Boolean(nextRuntimeSession.apiToken) &&
      nextRuntimeSession.wallet.trim().toLowerCase() === normalizedAddress;

    if (hasMatchingSecureSession || attemptedWalletRef.current === normalizedAddress) {
      return;
    }

    attemptedWalletRef.current = normalizedAddress;
    establishSecureSession(normalizedAddress).catch((error) => {
      console.warn("Background secure session bootstrap failed:", error);
    });
  }, [address, isConnected]);

  return null;
}

const WalletRuntimeProvider = ({ children }: WalletRuntimeProviderProps) => {
  return (
    <WagmiProvider config={config}>
      <WalletRuntimeSessionBridge />
      {children}
    </WagmiProvider>
  );
};

export default WalletRuntimeProvider;
