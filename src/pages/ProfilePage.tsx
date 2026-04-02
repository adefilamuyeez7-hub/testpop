import { Award, Gift, LogOut, ShoppingBag, Shield, Sparkles, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useContracts";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { address, isConnected, disconnect } = useWallet();
  const isMobile = useIsMobile();

  const handleDisconnect = () => {
    disconnect();
    toast.success("Wallet disconnected");
    navigate("/");
  };

  const collectorNavItems = [
    {
      icon: ShoppingBag,
      label: "My Collection",
      desc: "Your collected items",
      path: "/collection",
    },
    {
      icon: Gift,
      label: "My POAPs",
      desc: "Campaign badges & drops",
      path: "/poaps",
    },
    {
      icon: Wallet,
      label: "My Subscriptions",
      desc: "Artists you support",
      path: "/subscriptions",
    },
    {
      icon: Shield,
      label: "Artist Studio",
      desc: "Manage your artist profile",
      path: "/studio",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_30%),linear-gradient(180deg,#f7fbff_0%,#ecf4ff_100%)] px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_35px_120px_rgba(37,99,235,0.10)] backdrop-blur md:p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#60a5fa_0%,#1d4ed8_100%)] text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-foreground">Collector Hub</p>
              <p className="text-xs text-muted-foreground">Wallet, library & artist memberships</p>
            </div>
          </div>

          <nav className="space-y-3">
            {collectorNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-[#dbeafe] bg-[#f3f8ff]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[#d7e7ff]">
                  <item.icon className="h-4 w-4 text-[#1d4ed8]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleDisconnect}
            disabled={!isConnected}
            className="mt-8 w-full flex items-center gap-3 rounded-2xl px-4 py-3 bg-[#fee2e2] transition-colors hover:bg-[#fecaca] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[#fca5a5]">
              <LogOut className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-red-900">Log Out</p>
              <p className="text-xs text-red-700">Disconnect wallet session</p>
            </div>
          </button>

          {!isConnected && (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-[#bfd5ff] bg-[#f3f8ff] p-6 text-center">
              <p className="text-sm font-semibold text-foreground">Wallet not connected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your Base wallet to access your collection, POAPs, subscriptions, and artist studio.
              </p>
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-[#eff6ff] border border-[#dbeafe]">
            <p className="text-xs font-semibold text-[#1d4ed8]">Address</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{address || "Not connected"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
