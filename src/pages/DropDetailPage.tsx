import { lazy, Suspense, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Clock, Award, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordDropView } from "@/lib/analyticsStore";
import { useSupabaseDropById } from "@/hooks/useSupabase";
import type { AssetType } from "@/lib/assetTypes";
import { ipfsToHttp, resolveMediaUrl } from "@/lib/pinata";
import { VideoViewer } from "@/components/collection/VideoViewer";
import { AudioPlayer } from "@/components/collection/AudioPlayer";
import { useCollectionStore } from "@/stores/collectionStore";
import { CampaignArchitectureCard } from "@/components/campaign/CampaignArchitectureCard";

const DropPrimaryActionCard = lazy(() => import("@/components/wallet/DropPrimaryActionCard"));

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const formatDropTypeLabel = (type: "drop" | "auction" | "campaign") =>
  type === "drop" ? "collect" : type;

const DropDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const { data: dropRecord, loading: dropsLoading, error: dropError, refetch: refetchDrop } = useSupabaseDropById(id);

  const drop = useMemo(() => {
    if (!dropRecord) return null;

    const artist = dropRecord.artists && !Array.isArray(dropRecord.artists) ? dropRecord.artists : null;
    const now = Date.now();
    const endsAt = dropRecord.ends_at ? new Date(dropRecord.ends_at).getTime() : now + 24 * 60 * 60 * 1000;
    const endsInHours = Math.max(0, Math.ceil((endsAt - now) / (60 * 60 * 1000)));
    const normalizedType = (dropRecord.type || "drop") as "drop" | "auction" | "campaign";
    const normalizedContractKind =
      dropRecord.contract_kind ||
      (normalizedType === "auction"
        ? "poapCampaign"
        : normalizedType === "campaign" && dropRecord.contract_drop_id !== null && dropRecord.contract_drop_id !== undefined
          ? "poapCampaignV2"
          : normalizedType === "campaign"
            ? null
            : "artDrop");

    return {
      id: dropRecord.id,
      title: dropRecord.title || "Untitled",
      artistId: dropRecord.artist_id,
      artist: artist?.name || "Unknown Artist",
      edition: `by ${artist?.handle || "artist"}`,
      description: dropRecord.description || "",
      priceEth: dropRecord.price_eth ? String(dropRecord.price_eth) : "0",
      currentBidEth: undefined,
      maxBuy: dropRecord.supply || 1,
      bought: dropRecord.sold || 0,
      bids: 0,
      status: dropRecord.status || "draft",
      type: normalizedType,
      endsIn: `${endsInHours}h left`,
      image: resolveMediaUrl(dropRecord.preview_uri, dropRecord.image_url, dropRecord.image_ipfs_uri),
      imageUri: dropRecord.image_ipfs_uri || "",
      metadataUri: dropRecord.metadata_ipfs_uri || "",
      deliveryUri: dropRecord.delivery_uri || dropRecord.image_ipfs_uri || "",
      previewUri: dropRecord.preview_uri || undefined,
      contractAddress: dropRecord.contract_address || null,
      contractDropId: dropRecord.contract_drop_id !== null && dropRecord.contract_drop_id !== undefined ? Number(dropRecord.contract_drop_id) : null,
      contractKind: normalizedContractKind as "artDrop" | "poapCampaign" | null,
      poap: false,
      poapNote: "",
      assetType: (dropRecord.asset_type || "image") as AssetType,
    };
  }, [dropRecord]);

  const hasContractAddress = Boolean(drop?.contractAddress && drop.contractAddress !== ZERO_ADDRESS);
  const mediaSrc = drop ? ipfsToHttp(drop.deliveryUri || drop.imageUri || drop.image || "") : "";
  const posterSrc = drop ? ipfsToHttp(drop.previewUri || drop.image || "") : "";
  const coverSrc = drop ? ipfsToHttp(drop.previewUri || drop.imageUri || drop.image || "") : "";

  useEffect(() => {
    if (id) {
      recordDropView(id);
    }
  }, [id]);

  if (dropsLoading) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading drop details...</p>
      </div>
    );
  }

  if (dropError) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Unable to load this drop</p>
        <p className="text-sm text-muted-foreground">{dropError.message}</p>
        <Button onClick={() => refetchDrop()} className="rounded-full gradient-primary text-primary-foreground">
          Try Again
        </Button>
      </div>
    );
  }

  if (!drop) {
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

  const handleCollectSuccess = ({ ownerWallet, mintedTokenId }: { ownerWallet: string; mintedTokenId: number | null }) => {
    const collectedItem = {
      id: drop.id,
      ownerWallet,
      title: drop.title,
      artist: drop.artist,
      imageUrl: drop.image,
      previewUri: drop.previewUri,
      deliveryUri: drop.deliveryUri,
      assetType: drop.assetType,
      mintedTokenId,
      contractAddress: drop.contractAddress,
      contractDropId: drop.contractDropId,
      collectedAt: new Date().toISOString(),
    };
    addCollectedDrop(collectedItem);
    toast.success("Collected successfully!");
    refetchDrop()?.catch((error) => {
      console.warn("Failed to refresh drop data:", error);
    });
    window.setTimeout(() => {
      navigate("/collection", {
        state: {
          highlightDropId: drop.id,
          collectedItem,
        },
      });
    }, 500);
  };

  return (
    <div className="space-y-0 pb-4">
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-secondary">
          {drop.assetType === "image" && <img src={ipfsToHttp(drop.image || mediaSrc)} alt={drop.title} className="w-full h-full object-cover" />}
          {drop.assetType === "video" && <VideoViewer src={mediaSrc} poster={posterSrc} />}
          {drop.assetType === "audio" && (
            <div className="w-full h-full flex items-center justify-center">
              <AudioPlayer src={mediaSrc} title={drop.title} />
            </div>
          )}
          {(drop.assetType === "pdf" || drop.assetType === "epub" || drop.assetType === "digital") && (
            coverSrc ? (
              <div className="relative w-full h-full">
                <img src={coverSrc} alt={drop.title} className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-xs uppercase tracking-[0.2em]">
                    {drop.assetType === "pdf" ? "ebook pdf" : drop.assetType === "epub" ? "ebook epub" : "downloadable file"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white text-sm font-semibold text-center px-6">
                {drop.assetType === "digital" ? "Downloadable content" : "eBook preview"}
              </div>
            )
          )}
        </div>
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 p-2 rounded-full bg-background/60 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
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

        {drop.type === "campaign" ? (
          <CampaignArchitectureCard />
        ) : !hasContractAddress ? (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-3 text-warning text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Contract not deployed yet
          </div>
        ) : drop.contractDropId === null || drop.contractDropId === undefined ? (
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

        <Suspense
          fallback={
            <div className="p-4 rounded-2xl bg-card shadow-card">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          }
        >
          <DropPrimaryActionCard drop={drop} onCollectSuccess={handleCollectSuccess} />
        </Suspense>

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
