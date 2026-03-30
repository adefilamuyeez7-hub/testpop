import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Clock, Gavel, Share2, Heart, Award, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useWallet, usePlaceBid, useIsSubscribedToArtistContract, useSubscribeToArtistContract } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import { recordDropView } from "@/lib/analyticsStore";
import { getAllArtists } from "@/lib/artistStore";
import { useSupabaseAllDrops } from "@/hooks/useSupabase";
import { Web3Error } from "@/lib/types";

const DropDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { address, isConnected, connectWallet } = useWallet();
  const { placeBid, isPending: isBidPending, isConfirming: isBidConfirming, isSuccess: isBidSuccess, error: bidError } = usePlaceBid();
  
  // State for per-artist contract minting
  const [activeMintContractAddress, setActiveMintContractAddress] = useState<string | null>(null);
  const { mint: mintArtist, isConfirming: isMintConfirming, isSuccess: isMintSuccess, error: mintError } = useMintArtist(activeMintContractAddress);
  
  // Fetch all drops from React Query (cached + auto-refetch)
  const { data: allDrops, loading: dropsLoading, refetch: refetchDrops } = useSupabaseAllDrops();

  // Compute current drop from the React Query data
  const drop = useMemo(() => {
    if (!id || !allDrops || allDrops.length === 0) return null;
    
    const foundDrop = allDrops.find((d: any) => d.id === id);
    if (!foundDrop) return null;

    // Transform Supabase drop to local format
    const artist = getAllArtists().find(a => a.id === foundDrop.artist_id);
    const now = new Date();
    const endsAt = foundDrop.ends_at ? new Date(foundDrop.ends_at) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endsInMs = endsAt.getTime() - now.getTime();
    const endsInHours = Math.ceil(endsInMs / (60 * 60 * 1000));
    
    return {
      id: foundDrop.id,
      title: foundDrop.title || "Untitled",
      artistId: foundDrop.artist_id,
      artist: artist?.name || "Unknown Artist",
      edition: `by ${artist?.handle || "artist"}`,
      description: foundDrop.description || "",
      priceEth: foundDrop.price_eth ? String(foundDrop.price_eth) : "0",
      currentBidEth: undefined,
      maxBuy: foundDrop.supply || 1,
      bought: foundDrop.sold || 0,
      bids: 0,
      status: foundDrop.status || "draft",
      type: foundDrop.type || "drop",
      endsIn: `${endsInHours}h left`,
      image: foundDrop.image_url || "",
      imageUri: foundDrop.image_ipfs_uri || "",
      metadataUri: foundDrop.metadata_ipfs_uri || "",
      contractAddress: foundDrop.contract_address,
      contractDropId: foundDrop.contract_drop_id ? Number(foundDrop.contract_drop_id) : null,
      contractKind: foundDrop.contract_kind,
      poap: false,
      poapNote: "",
    };
  }, [id, allDrops]);

  // Artist-specific contract subscription hooks with proper contract address
  const { subscribe, isPending: isSubscribePending, isConfirming: isSubscribeConfirming, isSuccess: isSubscribeSuccess, error: subscribeError } = useSubscribeToArtistContract(drop?.contractAddress ?? null);
  const { isSubscribed, isLoading: isSubscribedLoading, refetch: refetchSubscriptionStatus } = useIsSubscribedToArtistContract(drop?.contractAddress ?? null, address ?? null);

  // Get artist profile for subscription price and wallet info
  const artistProfile = drop?.artistId ? getAllArtists().find(a => a.id === drop.artistId) : null;
  const artistWallet = artistProfile?.wallet ?? null;

  const [bidAmount, setBidAmount] = useState("");
  const [campaignLink, setCampaignLink] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [tab, setTab] = useState<"subscribers" | "bidders" | "creators">("subscribers");
  const [contentSubmitted, setContentSubmitted] = useState(false);
  const [isSubmittingContent, setIsSubmittingContent] = useState(false);

  // Compute derived values from drop data
  const priceEth = drop?.priceEth ?? "0";
  const remaining = (drop?.maxBuy ?? 0) - (drop?.bought ?? 0);
  const boughtPct = drop?.maxBuy ? Math.round(((drop?.bought ?? 0) / drop.maxBuy) * 100) : 0;
  const hasLiveArtDrop = !!drop?.contractDropId && drop.contractDropId !== null;

  useEffect(() => {
    if (id) {
      recordDropView(id);
    }
  }, [id]);

  // Refetch drop data after successful mint
  useEffect(() => {
    if (isMintSuccess && id) {
      console.log("✅ Mint succeeded! Refetching drop details...");
      toast.success("Drop purchased successfully!");
      
      // Refetch from React Query to show updated inventory
      refetchDrops()?.catch(err => {
        console.warn("Failed to refresh drop data:", err);
        // Still show success even if refresh fails
      });
    }
  }, [isMintSuccess, id, toast, refetchDrops]);

  useEffect(() => {
    if (isBidSuccess) toast.success("Bid placed successfully!");
  }, [isBidSuccess]);

  useEffect(() => {
    if (bidError) toast.error("Bid failed: " + (bidError?.message || "Unknown error"));
  }, [bidError]);

  useEffect(() => {
    if (mintError) {
      const errMsg = (mintError as any)?.message || "Unknown error";
      console.error("❌ Mint error:", errMsg);
      
      // Better error messaging
      if (errMsg.includes("insufficient funds")) {
        toast.error("Insufficient balance for mint + gas fees");
      } else if (errMsg.includes("network fee") || errMsg.includes("gas")) {
        toast.error("Network congested. Try again in a moment.");
      } else {
        toast.error("Mint failed: " + errMsg);
      }
    }
  }, [mintError, toast]);

  // Handle subscribe success
  useEffect(() => {
    if (isSubscribeSuccess) {
      console.log("✅ Subscribe succeeded! Refetching subscription status...");
      toast.success("Successfully subscribed to artist!");
      
      // Wait a moment for blockchain to update, then refetch subscription status
      setTimeout(() => {
        refetchSubscriptionStatus();
      }, 2000);
    }
  }, [isSubscribeSuccess, refetchSubscriptionStatus]);

  // Handle subscribe error with better messaging
  useEffect(() => {
    if (subscribeError) {
      const errMsg = (subscribeError as any)?.message || "Unknown error";
      console.error("❌ Subscribe error:", errMsg);
      
      // Better error messaging for subscribe
      if (errMsg.includes("network fee") || errMsg.includes("gas estimation")) {
        toast.error("⚠️ Network fee unavailable. This may be a temporary network issue. Try:\n1. Refreshing the page\n2. Checking your internet connection\n3. Using a different RPC endpoint");
      } else if (errMsg.includes("insufficient funds")) {
        toast.error("Insufficient balance for subscription + gas fees");
      } else if (errMsg.includes("Invalid artist address")) {
        toast.error("Invalid artist wallet address");
      } else {
        toast.error("Subscription failed: " + errMsg);
      }
    }
  }, [subscribeError, toast]);

  if (dropsLoading || !drop) {
    if (dropsLoading) {
      return (
        <div className="px-4 py-10 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading drop details...</p>
        </div>
      );
    }

    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Drop not found</p>
        <p className="text-sm text-muted-foreground">This artwork is no longer available or has not been published yet.</p>
        <Button onClick={() => navigate("/drops")} className="rounded-full gradient-primary text-primary-foreground">
          Back to Drops
        </Button>
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (!isConnected) { 
      await connectWallet(); 
      return; 
    }

    if (!artistWallet) {
      toast.error("Artist wallet not found to subscribe.");
      return;
    }

    if (!artistProfile?.wallet) {
      toast.error("Artist profile not loaded. Please refresh the page.");
      return;
    }
    
    if (!drop?.contractAddress) {
      toast.error("Artist contract not deployed yet. Please try again later.");
      return;
    }

    try {
      console.log("🎨 Initiating subscription...");
      const amount = artistProfile?.subscriptionPrice ?? "0.02";
      
      // Call subscribe with just the amount - contract address is already set in hook
      const txHash = await subscribe(amount);
      
      if (txHash) {
        toast.loading(`Confirming subscription transaction ${txHash.slice(0, 8)}...`);
        console.log("📤 Subscription tx submitted:", txHash);
      }
    } catch (err: any) {
      console.error("❌ Subscription error:", err);
      
      // Handle specific error types
      if (err?.message?.includes("network fee") || err?.message?.includes("gas estimation")) {
        toast.error("⚠️ Network fee unavailable. Try:\n1. Switch MetaMask network to Base Sepolia\n2. Refresh the page\n3. Try again in 30 seconds");
      } else if (err?.message?.includes("Invalid artist address")) {
        toast.error("Invalid artist address format");
      } else if (err?.message?.includes("denied")) {
        toast.error("Transaction cancelled in wallet");
      } else {
        toast.error(err?.message || "Subscription transaction failed");
      }
    }
  };

  const handleBuyDrop = () => {
    if (!isConnected) { connectWallet(); return; }
    if (remaining <= 0) { toast.error("Sold out"); return; }
    if (!hasLiveArtDrop || drop.contractDropId === null || drop.contractDropId === undefined) {
      toast.error("This drop is not linked to a live ArtDrop listing yet.");
      return;
    }
    if (!drop.contractAddress) {
      toast.error("Artist contract not properly deployed yet.");
      return;
    }
    
    setActiveMintContractAddress(drop.contractAddress);
    mintArtist(drop.contractDropId, parseEther(priceEth.toString()));
  };

  const handlePlaceBid = () => {
    if (!isConnected) { connectWallet(); return; }
    if (!bidAmount || parseFloat(bidAmount) <= 0) { toast.error("Enter a valid bid amount"); return; }
    if (!drop.contractDropId || drop.contractDropId === null) { toast.error("Campaign not linked to contract"); return; }
    
    try {
      placeBid(drop.contractDropId, bidAmount);
      toast.loading("Placing bid...");
    } catch (error) {
      console.error("Bid error:", error);
      toast.error("Failed to place bid");
    }
  };

  const submitContentLink = async () => {
    if (!isConnected) { connectWallet(); return; }
    if (!campaignLink) { toast.error("Enter a link first."); return; }
    setIsSubmittingContent(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmittingContent(false);
    setContentSubmitted(true);
    setCampaignLink("");
    toast.success("Entry submitted!");
  };

  const renderCampaignTabs = () => {
    const tabs = [
      { key: "subscribers", label: "Subscribers" },
      { key: "bidders", label: "ETH Bidders" },
      { key: "creators", label: "Content Creators" },
    ] as const;

    return (
      <>
        <div className="flex gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${tab === item.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {tab === "subscribers" && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Free POAP claim for subscribers.</p>
              <Button
                onClick={() => {
                  if (!isConnected) return connectWallet();
                  if (!isSubscribed) {
                    toast.error("Only subscribed users can claim POAP.");
                    return;
                  }
                  toast.success("POAP claimed!");
                }}
                className="w-full rounded-full gradient-primary text-primary-foreground h-11"
                disabled={isSubscribedLoading || !isSubscribed}
              >
                {isSubscribedLoading ? "Checking subscription..." : isSubscribed ? "Claim POAP" : "Subscriber Locked"}
              </Button>
              {!isSubscribed && (
                <Button
                  onClick={handleSubscribe}
                  variant="outline"
                  className="mt-2 w-full rounded-full border border-border"
                  disabled={isSubscribePending || isSubscribeConfirming || isSubscribed || isSubscribedLoading}
                >
                  {isSubscribedLoading ? "Checking subscription..." : isSubscribed ? "Subscribed ✓" : "Become Subscriber"}
                </Button>
              )}
              {isSubscribed && (
                <Button
                  disabled
                  variant="default"
                  className="mt-2 w-full rounded-full"
                >
                  ✓ Subscribed
                </Button>
              )}
            </div>
          )}

          {tab === "bidders" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Bid ETH. Top bidder wins. Non-winners refunded.</p>
              <Input type="number" min="0.001" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="h-10 rounded-xl bg-secondary text-sm" placeholder="Bid amount (ETH)" />
              <Button 
                onClick={handlePlaceBid} 
                disabled={isBidPending || isBidConfirming}
                className="w-full rounded-full gradient-primary text-primary-foreground h-11"
              >
                {isBidPending || isBidConfirming ? "Confirming..." : "Place Bid"}
              </Button>
              <p className="text-xs text-muted-foreground">Bidding is live on-chain. Top bidder wins the item.</p>
            </div>
          )}

          {tab === "creators" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Submit your creative link for raffle entry.</p>
              <Input type="url" value={campaignLink} onChange={(e) => setCampaignLink(e.target.value)} className="h-10 rounded-xl bg-secondary text-sm" placeholder="https://your-work.example" disabled={contentSubmitted} />
              {contentSubmitted ? (
                <p className="text-xs text-primary font-medium text-center">Entry submitted ✓</p>
              ) : (
                <Button onClick={submitContentLink} disabled={isSubmittingContent} className="w-full rounded-full gradient-primary text-primary-foreground h-11">
                  {isSubmittingContent ? "Submitting..." : "Submit Entry"}
                </Button>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-0 pb-4">
      <div className="relative">
        <div className="aspect-square overflow-hidden">
          <img src={drop.image} alt={drop.title} className="w-full h-full object-cover" />
        </div>
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 p-2 rounded-full bg-background/60 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => setIsLiked(!isLiked)} className={`p-2 rounded-full bg-background/60 backdrop-blur-sm ${isLiked ? "text-red-500" : "text-foreground"}`}>
            <Heart className="h-4 w-4" />
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
            className="p-2 rounded-full bg-background/60 backdrop-blur-sm"
          >
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="text-[10px] mb-1">{drop.type}</Badge>
            <h1 className="text-xl font-bold text-foreground">{drop.title}</h1>
            <p className="text-sm text-muted-foreground">{drop.artist} · {drop.edition}</p>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />{drop.endsIn}
          </p>
        </div>

        {!drop.contractAddress ? (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Contract not deployed yet
          </div>
        ) : !hasLiveArtDrop && drop.type === "Drop" ? (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> This drop is stored locally, but its on-chain drop ID is missing.
          </div>
        ) : (
          <a href={`https://sepolia.basescan.org/address/${drop.contractAddress}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <LinkIcon className="h-3 w-3" /> View on Base Sepolia
          </a>
        )}

        <p className="text-sm text-muted-foreground font-body">{drop.description}</p>

        <div className="p-4 rounded-2xl bg-card shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">{drop.currentBidEth ? "Current Bid" : "Price"}</p>
              <p className="text-xl font-bold text-primary">{drop.currentBidEth || drop.priceEth} ETH</p>
            </div>
            {drop.bids > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Gavel className="h-3 w-3" /> {drop.bids} bids
              </p>
            )}
          </div>

          {drop.type === "Drop" ? (
            <>
              <div className="mb-3">
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full gradient-primary" style={{ width: `${boughtPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{drop.bought || 0} of {drop.maxBuy} claimed · {remaining} left</p>
              </div>
              <Button onClick={handleBuyDrop} disabled={!hasLiveArtDrop || remaining <= 0 || isMintConfirming || isMintSuccess} className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11">
                {isMintConfirming ? "Purchasing..." : isMintSuccess ? "Purchased" : `Buy Now · ${drop.priceEth} ETH`}
              </Button>
              {mintError && <p className="text-xs text-destructive mt-2">{(mintError as Web3Error).shortMessage || (mintError as Web3Error).message}</p>}
            </>
          ) : drop.type === "Campaign" ? (
            renderCampaignTabs()
          ) : (
            <div className="space-y-3">
              <Input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Enter bid amount (ETH)" className="h-10 rounded-xl bg-secondary text-sm" />
              <p className="text-xs text-muted-foreground">Auction bidding is now live on-chain. Place your bid to participate.</p>
              <Button 
                onClick={handlePlaceBid} 
                disabled={isBidPending || isBidConfirming}
                className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
              >
                {isBidPending || isBidConfirming ? "Confirming..." : "Place Bid"}
              </Button>
            </div>
          )}
        </div>

        {drop.poap && (
          <div className="p-3 rounded-xl bg-accent border border-border flex items-start gap-2">
            <Award className="h-4 w-4 text-accent-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-accent-foreground">POAP Reward</p>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">{drop.poapNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropDetailPage;
