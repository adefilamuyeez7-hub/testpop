import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Copy, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/hooks/useContracts";
import { formatEther } from "viem";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

const WalletConnect = () => {
  const { address, isConnected, isConnecting, chain, balance, connectWallet, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const isWrongNetwork = isConnected && chain?.id !== ACTIVE_CHAIN.id;

  // Mobile-optimized connect button
  if (!isConnected) {
    return (
      <Button
        onClick={connectWallet}
        disabled={isConnecting}
        size="sm"
        className="rounded-full gradient-primary text-primary-foreground font-semibold text-sm px-3 h-8 md:h-9 md:px-4"
      >
        <Wallet className="h-3.5 w-3.5 mr-1.5 md:h-4 md:w-4 md:mr-2" />
        <span className="hidden xs:inline">{isConnecting ? "Connecting..." : "Connect"}</span>
        <span className="xs:hidden">{isConnecting ? "..." : "Connect"}</span>
      </Button>
    );
  }

  // Wrong network state - mobile optimized
  if (isWrongNetwork) {
    return (
      <div className="flex items-center gap-1 md:gap-2">
        <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
          <AlertTriangle className="h-3 w-3" />
          <span className="hidden sm:inline">Wrong network</span>
          <span className="sm:hidden">Wrong</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-1.5 rounded-full bg-secondary hover:bg-destructive/10 transition-colors"
          title="Disconnect"
        >
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  // Connected state - mobile optimized with collapsible details
  return (
    <div className="flex items-center gap-1 md:gap-2">
      {/* Network and balance - collapsible on mobile */}
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition-colors"
        >
          <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-primary animate-pulse" />
          <span className="hidden sm:inline">{chain?.name ?? ACTIVE_CHAIN.name}</span>
          <span className="sm:hidden">Base</span>
          <span className="text-muted-foreground hidden md:inline">·</span>
          <span className="hidden md:inline">{balance ? `${parseFloat(formatEther(balance.value)).toFixed(3)} ETH` : "..."}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        {/* Mobile dropdown for balance */}
        {showDetails && (
          <div className="absolute top-full mt-1 right-0 bg-popover border border-border rounded-lg p-2 shadow-lg z-50 min-w-[120px]">
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className="text-sm font-medium">
              {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "..."}
            </div>
          </div>
        )}
      </div>

      {/* Address button - mobile optimized */}
      <button
        onClick={copyAddress}
        className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors min-w-0"
      >
        <span className="truncate max-w-[60px] md:max-w-none">
          {address && shortenAddress(address)}
        </span>
        {copied ? <Check className="h-3 w-3 text-primary flex-shrink-0" /> : <Copy className="h-3 w-3 flex-shrink-0" />}
      </button>

      {/* Disconnect button */}
      <button
        onClick={() => disconnect()}
        className="p-1.5 rounded-full bg-secondary hover:bg-destructive/10 transition-colors flex-shrink-0"
        title="Disconnect"
      >
        <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
};

export default WalletConnect;
