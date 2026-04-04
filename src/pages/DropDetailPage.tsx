import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Clock, Award, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordDropView } from "@/lib/analyticsStore";
import { useSupabaseDropById } from "@/hooks/useSupabase";
import type { AssetType } from "@/lib/assetTypes";
import { ipfsToHttp, resolveMediaUrl } from "@/lib/pinata";
import { resolveDropCoverImage } from "@/lib/mediaPreview";
import { VideoViewer } from "@/components/collection/VideoViewer";
import { AudioPlayer } from "@/components/collection/AudioPlayer";
import { PdfReader } from "@/components/collection/PdfReader";
import { useCollectionStore } from "@/stores/collectionStore";
import { CampaignArchitectureCard } from "@/components/campaign/CampaignArchitectureCard";
import {
  getCreativeRelease,
  getProductAssets,
  getProductsByCreativeRelease,
  type CreativeRelease,
  type Product,
  type ProductAsset,
} from "@/lib/db";
import { detectAssetTypeFromUri } from "@/lib/assetTypes";

const DropPrimaryActionCard = lazy(() => import("@/components/wallet/DropPrimaryActionCard"));

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const formatDropTypeLabel = (type: "drop" | "auction" | "campaign") =>
  type === "drop" ? "collect" : type;

const formatReleaseListingLabel = (value?: string | null) => {
  if (value === "hybrid") return "hybrid collectible";
  if (value === "digital") return "digital release";
  if (value === "physical") return "merchandise";
  return value || "";
};

function resolveDropAssetType(dropRecord: {
  asset_type?: string | null;
  delivery_uri?: string | null;
  preview_uri?: string | null;
  image_ipfs_uri?: string | null;
  image_url?: string | null;
}): AssetType {
  const storedType = (dropRecord.asset_type || "").trim().toLowerCase() as AssetType | "";
  if (storedType && storedType !== "digital") {
    return storedType;
  }

  const candidates = [
    dropRecord.delivery_uri,
    dropRecord.preview_uri,
    dropRecord.image_ipfs_uri,
    dropRecord.image_url,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const inferredType = detectAssetTypeFromUri(candidate);
    if (inferredType === "pdf" || inferredType === "epub") {
      return inferredType;
    }
  }

  return storedType || "image";
}

function formatDetailValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const DropDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const { data: dropRecord, loading: dropsLoading, error: dropError, refetch: refetchDrop } = useSupabaseDropById(id);
  const [linkedRelease, setLinkedRelease] = useState<CreativeRelease | null>(null);
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);
  const [linkedAssets, setLinkedAssets] = useState<ProductAsset[]>([]);
  const [linkedDetailsLoading, setLinkedDetailsLoading] = useState(false);

  const drop = useMemo(() => {
    if (!dropRecord) return null;

    const artist = dropRecord.artists && !Array.isArray(dropRecord.artists) ? dropRecord.artists : null;
    const now = Date.now();
    const endsAt = dropRecord.ends_at ? new Date(dropRecord.ends_at).getTime() : now + 24 * 60 * 60 * 1000;
    const endsInHours = Math.max(0, Math.ceil((endsAt - now) / (60 * 60 * 1000)));
    const normalizedType = (dropRecord.type || "drop").toLowerCase() as "drop" | "auction" | "campaign";
    const resolvedAssetType = resolveDropAssetType(dropRecord);
    const resolvedCoverImage = resolveDropCoverImage({
      assetType: resolvedAssetType,
      previewUri: dropRecord.preview_uri,
      imageUrl: dropRecord.image_url,
      imageIpfsUri: dropRecord.image_ipfs_uri,
      deliveryUri: dropRecord.delivery_uri,
      metadata: (dropRecord.metadata as Record<string, unknown> | undefined) || null,
    });
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
      creativeReleaseId: dropRecord.creative_release_id || null,
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
      image: resolvedCoverImage,
      imageUri: dropRecord.image_ipfs_uri || "",
      metadataUri: dropRecord.metadata_ipfs_uri || "",
      deliveryUri: dropRecord.delivery_uri || dropRecord.image_ipfs_uri || "",
      previewUri: dropRecord.preview_uri || undefined,
      isGated: Boolean(dropRecord.is_gated),
      contractAddress: dropRecord.contract_address || null,
      contractDropId: dropRecord.contract_drop_id !== null && dropRecord.contract_drop_id !== undefined ? Number(dropRecord.contract_drop_id) : null,
      contractKind: normalizedContractKind as "artDrop" | "poapCampaign" | "poapCampaignV2" | "creativeReleaseEscrow" | null,
      metadata: (dropRecord.metadata as Record<string, unknown> | undefined) || {},
      poap: false,
      poapNote: "",
      assetType: resolvedAssetType,
    };
  }, [dropRecord]);

  const hasContractAddress = Boolean(drop?.contractAddress && drop.contractAddress !== ZERO_ADDRESS);
  const inlineLinkedRelease =
    dropRecord?.creative_release && typeof dropRecord.creative_release === "object" && !Array.isArray(dropRecord.creative_release)
      ? (dropRecord.creative_release as CreativeRelease)
      : null;
  const inlineLinkedProduct =
    dropRecord?.linked_product && typeof dropRecord.linked_product === "object" && !Array.isArray(dropRecord.linked_product)
      ? (dropRecord.linked_product as Product)
      : null;
  const resolvedLinkedRelease = linkedRelease || inlineLinkedRelease;
  const resolvedLinkedProduct = linkedProduct || inlineLinkedProduct;
  const linkedProductMetadata = toRecord(resolvedLinkedProduct?.metadata);
  const releaseType =
    resolvedLinkedRelease?.release_type ||
    resolvedLinkedProduct?.product_type ||
    (typeof linkedProductMetadata?.release_type === "string" ? linkedProductMetadata.release_type : null) ||
    (typeof linkedProductMetadata?.product_type === "string" ? linkedProductMetadata.product_type : null);
  const isReleaseBackedDrop =
    dropRecord?.source_kind === "release_product" ||
    dropRecord?.source_kind === "catalog_product" ||
    drop?.contractKind === "creativeReleaseEscrow" ||
    Boolean(resolvedLinkedProduct?.id);
  const mediaSrc = drop ? ipfsToHttp(drop.deliveryUri || drop.imageUri || drop.image || "") : "";
  const posterSrc = drop ? ipfsToHttp(drop.image || drop.previewUri || "") : "";
  const linkedReleaseCoverSrc = resolvedLinkedRelease?.cover_image_uri ? ipfsToHttp(resolvedLinkedRelease.cover_image_uri) : "";
  const linkedProductImageSrc = resolvedLinkedProduct
    ? resolveMediaUrl(resolvedLinkedProduct.image_url, resolvedLinkedProduct.image_ipfs_uri)
    : "";
  const coverSrc = drop ? ipfsToHttp(drop.image || "") || linkedProductImageSrc || linkedReleaseCoverSrc : "";
  const showInlinePdfReader = Boolean(drop && drop.assetType === "pdf" && mediaSrc && !drop.isGated);
  const mediaFrameClass = showInlinePdfReader
    ? "min-h-[34rem] overflow-hidden bg-secondary"
    : "aspect-square overflow-hidden bg-secondary";

  useEffect(() => {
    let isMounted = true;

    async function loadLinkedCommerce() {
      if (!dropRecord?.creative_release_id && !inlineLinkedProduct?.id) {
        setLinkedRelease(null);
        setLinkedProduct(null);
        setLinkedAssets([]);
        return;
      }

      try {
        setLinkedDetailsLoading(true);
        const [release, products] = await Promise.all([
          dropRecord?.creative_release_id ? getCreativeRelease(dropRecord.creative_release_id) : Promise.resolve(null),
          dropRecord?.creative_release_id ? getProductsByCreativeRelease(dropRecord.creative_release_id) : Promise.resolve([]),
        ]);
        const nextProduct = inlineLinkedProduct || products?.[0] || null;
        const assets = nextProduct?.id ? await getProductAssets(nextProduct.id) : [];

        if (!isMounted) return;
        setLinkedRelease(release || null);
        setLinkedProduct(nextProduct);
        setLinkedAssets(assets || []);
      } catch (error) {
        if (isMounted) {
          console.warn("Failed to load linked release details:", error);
        }
      } finally {
        if (isMounted) {
          setLinkedDetailsLoading(false);
        }
      }
    }

    void loadLinkedCommerce();

    return () => {
      isMounted = false;
    };
  }, [dropRecord?.creative_release_id, inlineLinkedProduct]);

  useEffect(() => {
    if (id) {
      recordDropView(id);
    }
  }, [id]);

  const galleryImages = useMemo(() => {
    const orderedUrls: string[] = [];
    const seen = new Set<string>();

    const pushUrl = (value?: string | null) => {
      const resolved = value ? resolveMediaUrl(value) : "";
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        orderedUrls.push(resolved);
      }
    };

    pushUrl(resolvedLinkedRelease?.cover_image_uri || null);
    pushUrl(linkedProductImageSrc);

    for (const asset of linkedAssets) {
      if (["hero_art", "gallery_photo", "physical_photo", "preview"].includes(String(asset.role || ""))) {
        pushUrl(resolveMediaUrl(asset.preview_uri, asset.uri));
      }
    }

    return orderedUrls;
  }, [linkedAssets, linkedProductImageSrc, resolvedLinkedRelease?.cover_image_uri]);

  const physicalDetails =
    resolvedLinkedRelease?.physical_details_jsonb ||
    toRecord(linkedProductMetadata?.physical_details_jsonb) ||
    {};
  const shippingProfile =
    resolvedLinkedRelease?.shipping_profile_jsonb ||
    toRecord(linkedProductMetadata?.shipping_profile_jsonb) ||
    {};
  const physicalDetailEntries = Object.entries(physicalDetails).filter(([, value]) => formatDetailValue(value));
  const shippingEntries = Object.entries(shippingProfile).filter(([, value]) => formatDetailValue(value));
  const creatorNotes =
    resolvedLinkedRelease?.creator_notes ||
    (typeof linkedProductMetadata?.creator_notes === "string" ? linkedProductMetadata.creator_notes : null);

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
        <div className={mediaFrameClass}>
          {drop.assetType === "image" && <img src={ipfsToHttp(drop.image || mediaSrc)} alt={drop.title} className="w-full h-full object-cover" />}
          {drop.assetType === "video" && <VideoViewer src={mediaSrc} poster={posterSrc} />}
          {drop.assetType === "audio" && (
            <div className="w-full h-full flex items-center justify-center">
              <AudioPlayer src={mediaSrc} title={drop.title} />
            </div>
          )}
          {showInlinePdfReader && <PdfReader src={mediaSrc} title={drop.title} />}
          {!showInlinePdfReader && (drop.assetType === "pdf" || drop.assetType === "epub" || drop.assetType === "digital") && (
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
            <div className="mb-2 flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {formatDropTypeLabel(drop.type)}
              </Badge>
              {drop.assetType !== "image" && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {drop.assetType}
                </Badge>
              )}
              {releaseType && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {formatReleaseListingLabel(releaseType)} release
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
          <CampaignArchitectureCard
            details={
              drop.metadata &&
              typeof drop.metadata.campaign_details === "object" &&
              drop.metadata.campaign_details !== null
                ? (drop.metadata.campaign_details as {
                    title?: string;
                    intro?: string;
                    primaryLabel?: string;
                    primaryItems?: string[];
                    secondaryLabel?: string;
                    secondaryItems?: string[];
                  })
                : undefined
            }
          />
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

        {(resolvedLinkedProduct || resolvedLinkedRelease) && (
          <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Release Listing</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {resolvedLinkedProduct?.name || resolvedLinkedRelease?.title || drop.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This drop is the public discovery page for the linked release, including checkout, media, and hybrid fulfillment details.
                </p>
              </div>
              {resolvedLinkedProduct?.id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/products/${resolvedLinkedProduct.id}`)}
                >
                  Open Checkout
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {resolvedLinkedRelease?.release_type ? (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {formatReleaseListingLabel(resolvedLinkedRelease.release_type)}
                </Badge>
              ) : null}
              {resolvedLinkedProduct?.product_type ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {formatReleaseListingLabel(resolvedLinkedProduct.product_type)}
                </Badge>
              ) : null}
              {resolvedLinkedProduct?.contract_kind ? (
                <Badge variant="outline" className="text-[10px]">
                  {resolvedLinkedProduct.contract_kind}
                </Badge>
              ) : null}
              {resolvedLinkedProduct?.delivery_uri ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Includes gated delivery
                </Badge>
              ) : null}
            </div>
          </div>
        )}

        {isReleaseBackedDrop ? (
          <div className="p-4 rounded-2xl bg-card shadow-card space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Release checkout</p>
              <p className="mt-1 text-sm text-foreground">
                This drop is the public discovery view for a linked release. Open the release checkout to buy the edition and access fulfillment details.
              </p>
            </div>
            <Button
              onClick={() => navigate(`/products/${resolvedLinkedProduct?.id || drop.id}`)}
              className="w-full rounded-full gradient-primary text-primary-foreground font-semibold h-11"
            >
              Open Release Checkout
            </Button>
          </div>
        ) : (
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
        )}

        {(linkedDetailsLoading || galleryImages.length > 0 || physicalDetailEntries.length > 0 || shippingEntries.length > 0 || creatorNotes) && (
          <div className="space-y-4">
            {linkedDetailsLoading && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Loading release details...
              </div>
            )}

            {galleryImages.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gallery</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Preview the art, product photos, and collector-facing media attached to this release.
                    </p>
                  </div>
                  {releaseType && (
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {formatReleaseListingLabel(releaseType)}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {galleryImages.map((image) => (
                    <div key={image} className="overflow-hidden rounded-2xl border border-border bg-secondary">
                      <img src={image} alt={drop.title} className="h-40 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(physicalDetailEntries.length > 0 || creatorNotes) && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Physical Details</p>
                {physicalDetailEntries.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {physicalDetailEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl bg-secondary/60 p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{formatDetailValue(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No physical details have been added yet.</p>
                )}
                {creatorNotes && (
                  <div className="mt-4 rounded-2xl border border-border p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Creator Notes</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{creatorNotes}</p>
                  </div>
                )}
              </div>
            )}

            {shippingEntries.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Shipping & Fulfillment</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {shippingEntries.map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-secondary/60 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{formatDetailValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
