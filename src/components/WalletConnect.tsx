import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Copy, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { formatEther } from "viem";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { toast } from "sonner";

const WalletConnect = () => {
  const {
    address,
    isConnected,
    isConnecting,
    chain,
    balance,
    connectWallet,
    requestActiveChainSwitch,
    isSwitchingNetwork,
    disconnect,
    connectorName,
  } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showDetails) return;

    const onPointerDown = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDetails(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [showDetails]);

  const copyAddress = async () => {
    if (!address) return;

    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const isWrongNetwork = isConnected && chain?.id !== ACTIVE_CHAIN.id;
  const balanceLabel = balance ? `${parseFloat(formatEther(balance.value)).toFixed(3)} ETH` : "Balance unavailable";

  if (!isConnected) {
    return (
      <Button
        type="button"
        onClick={connectWallet}
        disabled={isConnecting}
        size="sm"
        className="h-9 rounded-full px-4 text-sm font-semibold"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={async () => {
            try {
              await requestActiveChainSwitch(`Switch your wallet to ${ACTIVE_CHAIN.name} to continue.`);
            } catch (error) {
              const message = error instanceof Error ? error.message : `Switch to ${ACTIVE_CHAIN.name} in your wallet`;
              toast.error(message);
            }
          }}
          disabled={isSwitchingNetwork}
          className="h-9 rounded-full bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          {isSwitchingNetwork ? "Switching..." : `Switch to ${ACTIVE_CHAIN.name}`}
        </Button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-border bg-background p-2 transition-colors hover:bg-destructive/10"
          title="Disconnect wallet"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div ref={detailsRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowDetails((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        aria-expanded={showDetails}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="hidden sm:inline">{shortenAddress(address)}</span>
        <span className="sm:hidden">Wallet</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
      </button>

      {showDetails ? (
        <div className="absolute right-0 top-12 z-50 min-w-[220px] rounded-2xl border border-border bg-popover p-3 shadow-xl">
          <div className="space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Address</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{shortenAddress(address)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Network</p>
              <p className="mt-1 text-sm text-foreground">{chain?.name ?? ACTIVE_CHAIN.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Balance</p>
              <p className="mt-1 text-sm text-foreground">{balanceLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Connected via</p>
              <p className="mt-1 text-sm text-foreground">{connectorName || "Wallet"}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WalletConnect;
