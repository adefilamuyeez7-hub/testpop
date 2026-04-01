import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Clock, Gavel, Share2, Heart, Award, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useWallet, usePlaceBid } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import { recordDropView } from "@/lib/analyticsStore";
import { getAllArtists } from "@/lib/artistStore";
import { useSupabaseAllDrops } from "@/hooks/useSupabase";
import { Web3Error } from "@/lib/types";
import type { AssetType } from "@/lib/assetTypes";
import { VideoViewer } from "@/components/collection/VideoViewer";
import { AudioPlayer } from "@/components/collection/AudioPlayer";
import { PdfReader } from "@/components/collection/PdfReader";
import { EpubReader } from "@/components/collection/EpubReader";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const formatDropTypeLabel = (type: "drop" | "auction" | "campaign") =>
  type === "drop" ? "buy" : type;

const DropDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isConnected, connectWallet } = useWallet();
  const { placeBid, isPending: isBidPending, isConfirming: isBidConfirming, isSuccess: isBidSuccess, error: bidError } = usePlaceBid();
  const [activeMintContractAddress, setActiveMintContractAddress] = useState<string | null>(null);
  const { mint: mintArtist, isConfirming: isMintConfirming, isSuccess: isMintSuccess, error: mintError } = useMintArtist(activeMintContractAddress);
  const { data: allDrops, loading: dropsLoading, refetch: refetchDrops } = useSupabaseAllDrops();
  const [bidAmount, setBidAmount] = useState("");
  const [isLiked, setIsLiked] = useState(false);

  const drop = useMemo(() => {
    if (!id || !allDrops?.length) return null;

    const foundDrop = allDrops.find((entry: any) => entry.id === id);
    if (!foundDrop) return null;

    const artist = getAllArtists().find((entry) => entry.id === foundDrop.artist_id);
    const now = Date.now();
    const endsAt = foundDrop.ends_at ? new Date(foundDrop.ends_at).getTime() : now + 24 * 60 * 60 * 1000;
    const endsInHours = Math.max(0, Math.ceil((endsAt - now) / (60 * 60 * 1000)));
    const normalizedType = (foundDrop.type || "drop") as "drop" | "auction" | "campaign";
    const normalizedContractKind =
      foundDrop.contract_kind || (normalizedType === "auction" ? "poapCampaign" : normalizedType === "campaign" ? null : "artDrop");

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
      type: normalizedType,
      endsIn: `${endsInHours}h left`,
      image: foundDrop.image_url || "",
      imageUri: foundDrop.image_ipfs_uri || "",
      metadataUri: foundDrop.metadata_ipfs_uri || "",
      contractAddress: foundDrop.contract_address || null,
      contractDropId: foundDrop.contract_drop_id !== null && foundDrop.contract_drop_id !== undefined ? Number(foundDrop.contract_drop_id) : null,
      contractKind: normalizedContractKind as "artDrop" | "poapCampaign" | null,
      poap: false,
      poapNote: "",
      assetType: (foundDrop.asset_type || "image") as AssetType,
      previewUri: foundDrop.preview_uri || undefined,
    };
  }, [allDrops, id]);

  const priceEth = drop?.priceEth ?? "0";
  const remaining = (drop?.maxBuy ?? 0) - (drop?.bought ?? 0);
  const boughtPct = drop?.maxBuy ? Math.round(((drop?.bought ?? 0) / drop.maxBuy) * 100) : 0;
  const hasContractAddress = Boolean(drop?.contractAddress && drop.contractAddress !== ZERO_ADDRESS);
  const hasContractListing = drop?.contractDropId !== null && drop?.contractDropId !== undefined;
  const isBuyDrop = drop?.type === "drop" && drop.contractKind === "artDrop";
  const isAuctionDrop = drop?.type === "auction" && drop.contractKind === "poapCampaign";
  const isCampaignDrop = drop?.type === "campaign";

  useEffect(() => {
    if (id) {
      recordDropView(id);
    }
  }, [id]);

  useEffect(() => {
    if (isMintSuccess && id) {
      toast.success("Drop purchased successfully!");
      refetchDrops()?.catch((error) => {
        console.warn("Failed to refresh drop data:", error);
      });
    }
  }, [id, isMintSuccess, refetchDrops]);

  useEffect(() => {
    if (isBidSuccess) {
      toast.success("Bid placed successfully!");
    }
  }, [isBidSuccess]);

  useEffect(() => {
    if (bidError) {
      toast.error(`Bid failed: ${bidError?.message || "Unknown error"}`);
    }
  }, [bidError]);

  useEffect(() => {
    if (!mintError) return;

    const errMsg = (mintError as Web3Error)?.message || "Unknown error";
    if (errMsg.includes("insufficient funds")) {
      toast.error("Insufficient balance for mint plus gas fees.");
      return;
    }
    if (errMsg.includes("network fee") || errMsg.includes("gas")) {
      toast.error("Network congested. Try again in a moment.");
      return;
    }
    toast.error(`Mint failed: ${errMsg}`);
  }, [mintError]);

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

  const handleBuyDrop = () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (!isBuyDrop) {
      toast.error("This listing is not a direct-buy drop.");
      return;
    }
    if (remaining <= 0) {
      toast.error("Sold out");
      return;
    }
    if (!hasContractListing || drop.contractDropId === null) {
      toast.error("This drop is not linked to a live ArtDrop listing yet.");
      return;
    }
    if (!hasContractAddress || !drop.contractAddress) {
      toast.error("Artist contract not properly deployed yet.");
      return;
    }

    setActiveMintContractAddress(drop.contractAddress);
    mintArtist(drop.contractDropId, parseEther(priceEth));
  };

  const handlePlaceBid = () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (!isAuctionDrop) {
      toast.error("This listing is not an auction.");
      return;
    }
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      toast.error("Enter a valid bid amount");
      return;
    }
    if (!hasContractListing || drop.contractDropId === null) {
      toast.error("Auction not linked to contract");
      return;
    }

    placeBid(drop.contractDropId, bidAmount);
    toast.loading("Placing bid...");
  };

  const renderPrimaryAction = () => {
    if (isBuyDrop) {
      return (
        <>
          <div className="mb-3">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full gradient-primary" style={{ width: `${boughtPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {drop.bought || 0} of {drop.maxBuy} claimed · {remaining} left
            </p>
          </div>
          <Button
            onClick={handleBuyDrop}
            disabled={!hasContractListing || remaining <= 0 || isMintConfirming || isMintSuccess}
            className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
          >
            {isMintConfirming ? "Purchasing..." : isMintSuccess ? "Purchased" : `Buy Now · ${drop.priceEth} ETH`}
          </Button>
          {mintError && (
            <p className="text-xs text-destructive mt-2">
              {(mintError as Web3Error).shortMessage || (mintError as Web3Error).message}
            </p>
          )}
        </>
      );
    }

    if (isAuctionDrop) {
      return (
        <div className="space-y-3">
          <Input
            type="number"
            min="0.001"
            value={bidAmount}
            onChange={(event) => setBidAmount(event.target.value)}
            placeholder="Enter bid amount (ETH)"
            className="h-10 rounded-xl bg-secondary text-sm"
          />
          <p className="text-xs text-muted-foreground">Auction bidding is live on-chain for this listing.</p>
          <Button
            onClick={handlePlaceBid}
            disabled={isBidPending || isBidConfirming}
            className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
          >
            {isBidPending || isBidConfirming ? "Confirming..." : "Place Bid"}
          </Button>
        </div>
      );
    }

    if (isCampaignDrop) {
      return (
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Campaign drops are being redesigned before launch. Subscriber claims and content-entry flows are temporarily disabled until the real allocation workflow is implemented.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        This drop has an unsupported contract configuration.
      </div>
    );
  };

  return (
    <div className="space-y-0 pb-4">
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-secondary">
          {drop.assetType === "image" && <img src={drop.image} alt={drop.title} className="w-full h-full object-cover" />}
          {drop.assetType === "video" && <VideoViewer src={drop.image} poster={drop.previewUri} alt={drop.title} />}
          {drop.assetType === "audio" && (
            <div className="w-full h-full flex items-center justify-center">
              <AudioPlayer src={drop.image} title={drop.title} />
            </div>
          )}
          {drop.assetType === "pdf" && <PdfReader src={drop.image} title={drop.title} />}
          {drop.assetType === "epub" && <EpubReader src={drop.image} title={drop.title} />}
        </div>
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 p-2 rounded-full bg-background/60 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => setIsLiked((value) => !value)} className={`p-2 rounded-full bg-background/60 backdrop-blur-sm ${isLiked ? "text-red-500" : "text-foreground"}`}>
            <Heart className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            }}
            className="p-2 rounded-full bg-background/60 backdrop-blur-sm"
          >
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex gap-1 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {formatDropTypeLabel(drop.type)}
              </Badge>
              {drop.assetType !== "image" && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {drop.assetType}
                </Badge>
              )}
              {drop.contractKind && (
                <Badge variant="outline" className="text-[10px]">
                  {drop.contractKind}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground">{drop.title}</h1>
            <p className="text-sm text-muted-foreground">{drop.artist} · {drop.edition}</p>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {drop.endsIn}
          </p>
        </div>

        {!hasContractAddress ? (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Contract not deployed yet
          </div>
        ) : !hasContractListing ? (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            This listing is stored locally, but its on-chain ID is missing.
          </div>
        ) : (
          <a
            href={`https://sepolia.basescan.org/address/${drop.contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            View on Base Sepolia
          </a>
        )}

        <p className="text-sm text-muted-foreground font-body">{drop.description}</p>

        <div className="p-4 rounded-2xl bg-card shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">{isAuctionDrop && drop.currentBidEth ? "Current Bid" : "Price"}</p>
              <p className="text-xl font-bold text-primary">{drop.currentBidEth || drop.priceEth} ETH</p>
            </div>
            {drop.bids > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Gavel className="h-3 w-3" /> {drop.bids} bids
              </p>
            )}
          </div>

          {renderPrimaryAction()}
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
