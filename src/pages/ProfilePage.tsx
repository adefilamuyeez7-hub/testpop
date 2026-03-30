import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Wallet, Award, ShoppingBag, ChevronRight, BarChart3, Copy, Check, LogOut, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import WalletConnect from "@/components/WalletConnect";
import { useWallet } from "@/hooks/useContracts";
import { formatEther } from "viem";
import { toast } from "sonner";

// Generate Jazzicon-style avatar from wallet address
function getAvatarColor(address?: string): string {
  if (!address) return "#8884d8";
  const hash = address.toLowerCase().substring(2);
  const colors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  ];
  return colors[parseInt(hash.substring(0, 2), 16) % colors.length];
}

const ProfilePage = () => {
  const { address, isConnected, chain, balance, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const menuItems = [
    {
      icon: ShoppingBag,
      label: "My Collection",
      desc: "Art you've purchased",
      link: "/collection",
      action: null,
    },
    {
      icon: Award,
      label: "My POAPs",
      desc: "Campaign rewards & badges",
      link: "/poaps",
      action: null,
    },
    {
      icon: Wallet,
      label: "Subscriptions",
      desc: "Artists you support",
      link: "/subscriptions",
      action: null,
    },
    {
      icon: Shield,
      label: "Artist Studio",
      desc: "For whitelisted artists",
      link: "/studio",
      action: null,
    },
  ];

  return (
    <div className="px-4 pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <button
          className="p-2 rounded-full bg-secondary opacity-50 cursor-not-allowed"
          disabled
          title="Settings coming soon"
        >
          <Settings className="h-4 w-4 text-secondary-foreground" />
        </button>
      </div>

      {/* User card */}
      <div className="p-4 rounded-2xl bg-card shadow-card text-center">
        <div className="h-20 w-20 rounded-full bg-accent mx-auto mb-3 overflow-hidden flex items-center justify-center font-bold text-xl text-white" style={{ backgroundColor: getAvatarColor(address) }}>
          {address ? address.substring(2, 4).toUpperCase() : "?"}
        </div>

        {isConnected ? (
          <>
            <h2 className="font-semibold text-card-foreground mb-1">Connected Wallet</h2>
            <p className="text-xs text-muted-foreground font-body mb-2">{chain?.name || "Unknown chain"}</p>
            <p className="text-xs text-muted-foreground font-body mb-1">
              {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "Fetching balance..."}
            </p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xs font-mono truncate max-w-[140px]">{address}</span>
              <button
                onClick={copyAddress}
                className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={() => {
                disconnect();
                toast.success("Wallet disconnected");
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-card-foreground mb-1">Your Wallet</h2>
            <p className="text-xs text-muted-foreground font-body mb-3">Link your Base wallet to get started</p>
            <div className="flex justify-center">
              <WalletConnect />
            </div>
          </>
        )}
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const content = (
            <>
              <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </>
          );

          return item.link ? (
            <Link
              key={item.label}
              to={item.link}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              {content}
            </Link>
          ) : item.action ? (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              {content}
            </button>
          ) : null;
        })}
      </div>

      <div className="text-center pb-4">
        <p className="text-[10px] text-muted-foreground font-body">PopUp · Built on Base</p>
      </div>
    </div>
  );
};

export default ProfilePage;
