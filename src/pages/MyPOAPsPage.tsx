import { useMemo, useEffect, useState } from "react";
import { ArrowLeft, Gift, CheckCircle2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet, useUserOwnedPOAPs, useClaimPOAP } from "@/hooks/useContracts";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trackPOAPsView, trackCampaignInteraction, trackPOAPClaimed } from "@/lib/analyticsStore";
import { createPublicClient, http, getAddress } from "viem";
import { POAP_CAMPAIGN_ADDRESS, POAP_CAMPAIGN_ABI } from "@/lib/contracts/poapCampaign";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

interface POAP {
  id: string;
  campaignId: number;
  campaignName: string;
  campaignType: "Auction" | "Content" | "Subscriber";
  earnedDate: string;
  redeemed: boolean;
  reward?: string;
  tokenId?: number;
}

const MyPOAPsPage = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const { balance: poapsBalance } = useUserOwnedPOAPs(address);
  const { claim: claimPOAP, isPending: isClaimPending } = useClaimPOAP();
  const [poaps, setPoaps] = useState<POAP[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Track view
  useEffect(() => {
    if (isConnected && address) {
      trackPOAPsView(address);
    }
  }, [isConnected, address]);

  // Fetch user's earned POAPs from contract logs
  useEffect(() => {
    if (!isConnected || !address) {
      setPoaps([]);
      return;
    }

    let active = true;

    const fetchPOAPs = async () => {
      try {
        const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });

        const logs = await publicClient.getLogs({
          address: POAP_CAMPAIGN_ADDRESS,
          event: {
            type: "event",
            name: "POAPClaimed",
            inputs: [
              { name: "campaignId", type: "uint256", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
              { name: "to", type: "address", indexed: true },
            ],
          },
          args: {
            to: getAddress(address),
          },
          fromBlock: "earliest",
          toBlock: "latest",
        });

        if (!active) return;

        const parsed = await Promise.all(
          logs.map(async (log) => {
            const campaignId = Number((log.args as any).campaignId);
            const tokenId = Number((log.args as any).tokenId);

            // Load campaign metadata if possible
            let campaignName = `Campaign ${campaignId}`;
            let campaignType: POAP["campaignType"] = "Subscriber";
            try {
              const campaign = await publicClient.readContract({
                address: POAP_CAMPAIGN_ADDRESS,
                abi: POAP_CAMPAIGN_ABI,
                functionName: "campaigns",
                args: [BigInt(campaignId)],
              });

              if (campaign) {
                const type = Number((campaign as any).campaignType);
                campaignType = type === 0 ? "Auction" : type === 1 ? "Content" : "Subscriber";
                campaignName = `Campaign #${campaignId}`;
              }
            } catch {
              // keep defaults
            }

            return {
              id: `${campaignId}-${tokenId}`,
              campaignId,
              campaignName,
              campaignType,
              earnedDate: new Date().toISOString(),
              redeemed: true,
              tokenId,
            } as POAP;
          })
        );

        if (!active) return;

        setPoaps(parsed);
      } catch (error) {
        console.error("Error fetching POAPs:", error);
        if (active) setPoaps([]);
      }
    };

    fetchPOAPs();

    return () => {
      active = false;
    };
  }, [isConnected, address, poapsBalance]);

  const handleClaim = async (poap: POAP) => {
    if (!address) {
      toast.error("Connect wallet to claim POAP");
      return;
    }

    setClaimingId(poap.id);
    try {
      await claimPOAP(poap.campaignId);
      trackPOAPClaimed(address);
      toast.success("POAP claimed successfully!");
      // Update local state
      setPoaps((prev) =>
        prev.map((p) =>
          p.id === poap.id ? { ...p, redeemed: true } : p
        )
      );
    } catch (err: any) {
      const message = err?.message || "Failed to claim POAP";
      toast.error(message);
    } finally {
      setClaimingId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground">Connect to see your POAP rewards</p>
        <Button onClick={() => navigate(-1)} className="rounded-full gradient-primary text-primary-foreground">
          Back
        </Button>
      </div>
    );
  }

  const unredeemed = poaps.filter((p) => !p.redeemed);
  const redeemed = poaps.filter((p) => p.redeemed);

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 flex items-center gap-3 border-b">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">My POAP Rewards</h1>
          <p className="text-xs text-muted-foreground">{poaps.length} total</p>
        </div>
      </div>

      {poaps.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">
            No POAP rewards yet.
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Participate in campaigns to earn POAPs!
          </p>
        </div>
      ) : (
        <>
          {/* Unredeemed section */}
          {unredeemed.length > 0 && (
            <div className="px-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Available to Redeem ({unredeemed.length})</p>
              {unredeemed.map((poap) => (
                <div
                  key={poap.id}
                  className="p-3 rounded-xl bg-card shadow-card border border-primary/20"
                >
                  <div className="flex items-start gap-3">
                    <Gift className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{poap.campaignName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {poap.campaignType} • {new Date(poap.earnedDate).toLocaleDateString()}
                      </p>
                      {poap.reward && (
                        <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> {poap.reward}
                        </p>
                      )}
                      <Button
                        onClick={() => handleClaim(poap)}
                        className="w-full mt-2 rounded-lg text-xs h-7 gradient-primary"
                        size="sm"
                        disabled={isClaimPending || claimingId === poap.id}
                      >
                        {claimingId === poap.id ? "Claiming..." : "Redeem Now"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Redeemed section */}
          {redeemed.length > 0 && (
            <div className="px-4 space-y-2">
              <p className="text-xs font-semibold text-foreground text-muted-foreground">
                Redeemed ({redeemed.length})
              </p>
              {redeemed.map((poap) => (
                <div
                  key={poap.id}
                  className="p-3 rounded-xl bg-secondary/50"
                >
                  <div className="flex items-start gap-3">
                    <Gift className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground/60">{poap.campaignName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {poap.campaignType} • {new Date(poap.earnedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      Redeemed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {poaps.length > 0 && (
        <div className="text-center pb-4 text-xs text-muted-foreground font-body px-4">
          <p>{unredeemed.length} available • {redeemed.length} redeemed</p>
        </div>
      )}
    </div>
  );
};

export default MyPOAPsPage;
