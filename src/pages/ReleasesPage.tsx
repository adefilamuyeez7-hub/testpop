import { useEffect, useMemo, useState } from "react";
import {
  Gavel,
  Heart,
  Loader2,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DropPrimaryActionCard from "@/components/wallet/DropPrimaryActionCard";
import { useCartStore } from "@/stores/cartStore";
import { useSupabaseLiveDrops, useSupabasePublishedProducts } from "@/hooks/useSupabase";
import {
  createProductFeedbackThread,
  getProductFeedbackOverview,
  type CreativeRelease,
  type Drop,
  type Product,
  type ProductFeedbackOverview,
} from "@/lib/db";
import { resolveDropBehavior, resolveDropDetailPath } from "@/lib/dropBehavior";
import { getFavorites, toggleProductFavorite } from "@/lib/favoritesStore";
import { resolveMediaUrl } from "@/lib/pinata";
import { establishSecureSession } from "@/lib/secureAuth";
import { toast } from "sonner";

type ReleaseCatalogDrop = Drop & {
  artists?: { id?: string; name?: string; avatar_url?: string } | null;
  linked_product?: Product | null;
  creative_release?: CreativeRelease | null;
  source_kind?: string | null;
};

type ReleaseCatalogItem = {
  key: string;
  kind: "product" | "drop";
  title: string;
  description: string;
  image: string;
  priceEth: number;
  sold: number;
  availabilityLabel: string;
  status: string;
  typeLabel: string;
  filterValue: string;
  detailPath: string;
  sortTimestamp: number;
  likeProductId: string | null;
  commentProductId: string | null;
  badges: string[];
  helperText: string;
  action: {
    label: string;
    icon: LucideIcon;
    action: "detail" | "cart";
    disabled: boolean;
  };
  product?: Product;
  drop?: ReleaseCatalogDrop;
};

function formatEthAmount(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0.00";
  return numeric >= 10 ? numeric.toFixed(1) : numeric.toFixed(2);
}

function formatLabel(value?: string | null) {
  return String(value || "").replace(/_/g, " ").trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatEndsIn(endsAt?: string | null) {
  if (!endsAt) return "Live now";
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return "Live now";
  if (diffMs <= 0) return "Ending soon";
  const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  return `${hours}h left`;
}

function isOnchainReady(product: Product) {
  const listingId = Number(product.contract_listing_id || 0);
  const productId = Number(product.contract_product_id || 0);

  return (
    (product.contract_kind === "creativeReleaseEscrow" && Number.isFinite(listingId) && listingId > 0) ||
    (Number.isFinite(productId) && productId > 0)
  );
}

function resolveProductAction(product: Product): ReleaseCatalogItem["action"] {
  const searchSpace = [
    product.product_type,
    product.category,
    typeof product.metadata?.release_type === "string" ? product.metadata.release_type : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (searchSpace.includes("auction") || searchSpace.includes("bid")) {
    return { label: "Bid", icon: Gavel, action: "detail", disabled: false };
  }

  if (product.product_type === "digital" || searchSpace.includes("collectible") || searchSpace.includes("collect")) {
    return { label: "Collect", icon: Sparkles, action: "detail", disabled: false };
  }

  return { label: "Add to cart", icon: ShoppingCart, action: "cart", disabled: !isOnchainReady(product) };
}

function resolveDropAction(drop: ReleaseCatalogDrop): ReleaseCatalogItem["action"] {
  const linkedProduct = drop.linked_product || null;
  const linkedRelease = drop.creative_release || null;
  const metadata = toRecord(drop.metadata);
  const sourceKind =
    (typeof drop.source_kind === "string" ? drop.source_kind : null) ||
    (typeof metadata?.source_kind === "string" ? metadata.source_kind : null);
  const behavior = resolveDropBehavior({
    drop: {
      type: drop.type || "drop",
      contractKind: (drop.contract_kind as
        | "artDrop"
        | "poapCampaign"
        | "poapCampaignV2"
        | "creativeReleaseEscrow"
        | "productStore"
        | null) || null,
      contractDropId: Number.isFinite(Number(drop.contract_drop_id)) ? Number(drop.contract_drop_id) : null,
      metadata,
    },
    linkedProduct,
    linkedRelease,
    sourceKind,
  });

  if (behavior.mode === "auction") {
    return { label: "Bid", icon: Gavel, action: "detail", disabled: false };
  }
  if (behavior.mode === "collect") {
    return { label: "Collect", icon: Sparkles, action: "detail", disabled: false };
  }
  if (behavior.mode === "checkout") {
    return {
      label: "Buy",
      icon: ShoppingCart,
      action: "cart",
      disabled: !behavior.isOnchainReady || !linkedProduct?.id,
    };
  }

  return {
    label: behavior.mode === "campaign" ? "Open campaign" : "Open drop",
    icon: Sparkles,
    action: "detail",
    disabled: false,
  };
}

function buildProductCatalogItem(product: Product): ReleaseCatalogItem {
  const remainingStock =
    Number(product.stock || 0) > 0 ? Math.max(Number(product.stock || 0) - Number(product.sold || 0), 0) : null;

  return {
    key: `product:${product.id}`,
    kind: "product",
    title: product.name || "Untitled Release",
    description:
      product.description ||
      "Stay on the release page to buy now, leave feedback, or open the full release detail when you want the expanded view.",
    image: resolveMediaUrl(product.preview_uri, product.image_url, product.image_ipfs_uri),
    priceEth: Number(product.price_eth || 0),
    sold: Number(product.sold || 0),
    availabilityLabel: remainingStock === null ? "Open" : String(remainingStock),
    status: product.status || "published",
    typeLabel: formatLabel(product.product_type || product.category || "release"),
    filterValue: String(product.product_type || product.category || "release"),
    detailPath: `/products/${product.id}`,
    sortTimestamp: new Date(product.updated_at || product.created_at || 0).getTime(),
    likeProductId: product.id,
    commentProductId: product.id,
    badges: [formatLabel(product.category || "release"), product.status || "published", ...(product.is_gated ? ["Gated"] : [])],
    helperText: "Release checkout, gated access, and thread entry are all available from this card.",
    action: resolveProductAction(product),
    product,
  };
}

function buildDropCatalogItem(drop: ReleaseCatalogDrop): ReleaseCatalogItem {
  const linkedProduct = drop.linked_product || null;
  const metadata = toRecord(drop.metadata);
  const sourceKind =
    (typeof drop.source_kind === "string" ? drop.source_kind : null) ||
    (typeof metadata?.source_kind === "string" ? metadata.source_kind : null);
  const releaseType =
    drop.creative_release?.release_type ||
    linkedProduct?.product_type ||
    (typeof metadata?.release_type === "string" ? metadata.release_type : null) ||
    (typeof metadata?.product_type === "string" ? metadata.product_type : null);
  const remaining =
    Number(drop.supply || 0) > 0 ? Math.max(Number(drop.supply || 0) - Number(drop.sold || 0), 0) : null;
  const action = resolveDropAction(drop);

  return {
    key: `drop:${drop.id}`,
    kind: "drop",
    title: drop.title || "Untitled Drop",
    description: drop.description || "Collect, bid, or buy this drop directly from the release page without leaving the card.",
    image: resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri, drop.delivery_uri),
    priceEth: Number(drop.price_eth || 0),
    sold: Number(drop.sold || 0),
    availabilityLabel: remaining === null ? "Live" : String(remaining),
    status: drop.status || "live",
    typeLabel: formatLabel(releaseType || (action.label === "Buy" ? "buy" : drop.type || "drop")),
    filterValue: String(releaseType || (action.label === "Buy" ? "buy" : drop.type || "drop")),
    detailPath: resolveDropDetailPath({
      id: drop.id,
      linked_product: linkedProduct,
      source_kind: sourceKind,
      metadata,
    }),
    sortTimestamp: new Date(drop.updated_at || drop.created_at || 0).getTime(),
    likeProductId: linkedProduct?.id || null,
    commentProductId: linkedProduct?.id || null,
    badges: [formatLabel(drop.type || "drop"), formatLabel(releaseType || ""), ...(drop.is_gated ? ["Gated"] : [])].filter(Boolean),
    helperText:
      action.label === "Buy"
        ? "This live drop is release-backed, so checkout works directly here."
        : "This drop keeps its native collect or bid mechanics while living inside the release interface.",
    action,
    drop,
  };
}

function buildDropActionCardData(drop: ReleaseCatalogDrop) {
  const metadata = toRecord(drop.metadata);

  return {
    drop: {
      id: drop.id,
      title: drop.title || "Untitled Drop",
      artist: drop.artists?.name || "Unknown Artist",
      priceEth: String(drop.price_eth || 0),
      currentBidEth:
        typeof metadata?.current_bid_eth === "number"
          ? String(metadata.current_bid_eth)
          : typeof metadata?.current_bid_eth === "string"
            ? metadata.current_bid_eth
            : undefined,
      maxBuy: Number(drop.supply || 0) || undefined,
      bought: Number(drop.sold || 0),
      bids:
        typeof metadata?.bid_count === "number"
          ? metadata.bid_count
          : typeof metadata?.bids === "number"
            ? metadata.bids
            : 0,
      type: (drop.type || "drop") as "drop" | "auction" | "campaign",
      endsIn: formatEndsIn(drop.ends_at),
      contractAddress: drop.contract_address || null,
      contractDropId:
        drop.contract_drop_id !== null && drop.contract_drop_id !== undefined ? Number(drop.contract_drop_id) : null,
      contractKind: (drop.contract_kind as
        | "artDrop"
        | "poapCampaign"
        | "poapCampaignV2"
        | "creativeReleaseEscrow"
        | "productStore"
        | null) || null,
      assetType: String(drop.asset_type || "image"),
      previewUri: drop.preview_uri || undefined,
      deliveryUri: drop.delivery_uri || undefined,
      image: resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri, drop.delivery_uri),
      metadata: metadata || undefined,
    },
    linkedProduct: drop.linked_product || null,
    linkedRelease: drop.creative_release || null,
    sourceKind:
      (typeof drop.source_kind === "string" ? drop.source_kind : null) ||
      (typeof metadata?.source_kind === "string" ? metadata.source_kind : null),
  };
}

const defaultCommentForm = {
  visibility: "public" as "public" | "private",
  feedbackType: "review" as "review" | "feedback" | "question",
  rating: 5,
  title: "",
  body: "",
};

const ReleasesPage = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const addItem = useCartStore((state) => state.addItem);
  const { data: products, loading: productsLoading, error: productsError } = useSupabasePublishedProducts();
  const { data: liveDrops, loading: dropsLoading, error: dropsError } = useSupabaseLiveDrops();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [commentTarget, setCommentTarget] = useState<ReleaseCatalogItem | null>(null);
  const [commentOverview, setCommentOverview] = useState<ProductFeedbackOverview | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentForm, setCommentForm] = useState(defaultCommentForm);

  useEffect(() => {
    if (!address) {
      setFavoriteProductIds(new Set());
      return;
    }

    setFavoriteProductIds(new Set(getFavorites(address).favoriteProducts));
  }, [address]);

  const catalogItems = useMemo(() => {
    const productItems = (products || []).map(buildProductCatalogItem);
    const productIds = new Set((products || []).map((product) => product.id));
    const dropItems = ((liveDrops || []) as ReleaseCatalogDrop[])
      .filter((drop) => {
        const metadata = toRecord(drop.metadata);
        const sourceKind =
          (typeof drop.source_kind === "string" ? drop.source_kind : null) ||
          (typeof metadata?.source_kind === "string" ? metadata.source_kind : null);
        const linkedProductId =
          drop.linked_product?.id ||
          (typeof metadata?.source_product_id === "string" ? metadata.source_product_id : null);

        if (sourceKind === "release_product" || sourceKind === "catalog_product") {
          return false;
        }

        if (linkedProductId && productIds.has(linkedProductId) && Boolean(drop.creative_release_id)) {
          return false;
        }

        return true;
      })
      .map(buildDropCatalogItem);

    return [...productItems, ...dropItems].sort((left, right) => right.sortTimestamp - left.sortTimestamp);
  }, [liveDrops, products]);

  const releaseTypes = useMemo(() => {
    const types = new Set(catalogItems.map((item) => item.filterValue).filter(Boolean));
    return ["all", ...Array.from(types).sort((left, right) => String(left).localeCompare(String(right)))];
  }, [catalogItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return catalogItems.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.title, item.description, item.typeLabel, item.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const matchesType = typeFilter === "all" || item.filterValue === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [catalogItems, searchQuery, typeFilter]);

  const featuredItem = filteredItems[0] || catalogItems[0] || null;
  const loading = productsLoading || dropsLoading;
  const error = productsError || dropsError;
  const canLeaveComment = commentOverview?.can_leave_feedback ?? false;
  const canPublishPublicReview = commentOverview?.can_publish_public_review ?? false;
  const feedbackGate = commentOverview?.feedback_gate ?? "locked";

  useEffect(() => {
    if (!commentTarget?.commentProductId) {
      setCommentOverview(null);
      setCommentForm(defaultCommentForm);
      return;
    }

    let active = true;
    setCommentLoading(true);
    setCommentForm(defaultCommentForm);

    const loadFeedback = async () => {
      try {
        if (address) {
          await establishSecureSession(address).catch(() => undefined);
        }
        const overview = await getProductFeedbackOverview(commentTarget.commentProductId);
        if (active) {
          setCommentOverview(overview);
        }
      } catch (loadError) {
        if (active) {
          console.error(loadError);
          setCommentOverview(null);
        }
      } finally {
        if (active) {
          setCommentLoading(false);
        }
      }
    };

    void loadFeedback();

    return () => {
      active = false;
    };
  }, [address, commentTarget?.commentProductId]);

  useEffect(() => {
    if (!commentOverview || commentOverview.can_publish_public_review) {
      return;
    }

    setCommentForm((prev) => ({
      ...prev,
      visibility: "private",
      feedbackType: "question",
      rating: 5,
    }));
  }, [commentOverview]);

  function addProductToCart(product: Product, successMessage: string) {
    addItem(
      product.id,
      product.creative_release_id ?? null,
      product.contract_kind ?? "productStore",
      Number.isFinite(Number(product.contract_listing_id)) ? Number(product.contract_listing_id) : null,
      Number.isFinite(Number(product.contract_product_id)) ? Number(product.contract_product_id) : null,
      1,
      BigInt(Math.floor(Number(product.price_eth || 0) * 1e18)),
      product.name || "Untitled Release",
      resolveMediaUrl(product.preview_uri, product.image_url, product.image_ipfs_uri),
    );
    toast.success(successMessage);
    navigate("/cart");
  }

  function handleToggleLike(item: ReleaseCatalogItem) {
    if (!item.likeProductId) {
      toast.error("Likes are available on linked release products.");
      return;
    }
    if (!address) {
      toast.error("Connect your wallet to like releases.");
      return;
    }

    const added = toggleProductFavorite(address, item.likeProductId);
    setFavoriteProductIds(new Set(getFavorites(address).favoriteProducts));
    toast.success(added ? "Release added to likes." : "Release removed from likes.");
  }

  function handleOpenComments(item: ReleaseCatalogItem) {
    if (!item.commentProductId) {
      toast.error("Comments are available on linked release products.");
      return;
    }

    setCommentTarget(item);
  }

  function handleOpenDetail(item: ReleaseCatalogItem) {
    navigate(item.detailPath);
  }

  function handleAction(item: ReleaseCatalogItem) {
    if (item.kind === "product" && item.product) {
      if (item.action.action === "cart") {
        if (item.action.disabled) {
          toast.error("This release is not ready for cart checkout yet.");
          return;
        }

        addProductToCart(item.product, "Release added to cart.");
        return;
      }

      navigate(item.detailPath);
      return;
    }

    if (item.kind === "drop" && item.drop) {
      const linkedProduct = item.drop.linked_product || null;
      if (item.action.action === "cart") {
        if (!linkedProduct || item.action.disabled) {
          toast.error("This drop is not ready for checkout yet.");
          return;
        }

        addProductToCart(linkedProduct, "Drop added to cart.");
        return;
      }

      navigate(item.detailPath);
    }
  }

  async function handleSubmitComment() {
    if (!commentTarget?.commentProductId) return;
    if (!address) {
      toast.error("Connect your wallet to comment on this release.");
      return;
    }
    if (!commentForm.body.trim()) {
      toast.error("Write your comment before sending it.");
      return;
    }

    setCommentSubmitting(true);
    try {
      await establishSecureSession(address);
      await createProductFeedbackThread({
        productId: commentTarget.commentProductId,
        feedbackType:
          canPublishPublicReview && commentForm.visibility === "public"
            ? "review"
            : commentForm.feedbackType,
        visibility: canPublishPublicReview ? commentForm.visibility : "private",
        rating: canPublishPublicReview && commentForm.visibility === "public" ? commentForm.rating : null,
        title: commentForm.title,
        body: commentForm.body,
      });
      setCommentOverview(await getProductFeedbackOverview(commentTarget.commentProductId));
      setCommentForm(defaultCommentForm);
      toast.success(
        canPublishPublicReview && commentForm.visibility === "public"
          ? "Your release comment is live."
          : feedbackGate === "subscriber"
            ? "Your gated subscriber thread is now open."
            : "Your private release note was sent."
      );
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to send comment");
    } finally {
      setCommentSubmitting(false);
    }
  }

  function renderInlineDropAction(drop: ReleaseCatalogDrop) {
    const dropActionData = buildDropActionCardData(drop);

    return (
      <DropPrimaryActionCard
        drop={dropActionData.drop}
        linkedProduct={dropActionData.linkedProduct}
        linkedRelease={dropActionData.linkedRelease}
        sourceKind={dropActionData.sourceKind}
        onCollectSuccess={() => {
          toast.success("Collected from the release page.");
        }}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
            <div className="rounded-[1.8rem] bg-white/92 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-foreground">Releases</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Audit-ready release surface where collectors can buy, collect, bid, like, and comment without leaving the page.
                  </p>
                </div>

                <div className="relative min-w-[260px] flex-1 lg:max-w-md">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search releases, drops, formats, categories..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-12 rounded-full border-black/8 bg-white pl-11 pr-4"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3">
              {releaseTypes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTypeFilter(option)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition-colors ${
                    typeFilter === option ? "bg-[#dbeafe] text-foreground" : "bg-secondary/60 text-foreground"
                  }`}
                >
                  <span>{option === "all" ? "All releases" : formatLabel(option)}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {option === "all" ? catalogItems.length : catalogItems.filter((item) => item.filterValue === option).length}
                  </span>
                </button>
              ))}

              <div className="rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-4 text-sm text-muted-foreground">
                Drops now keep inline commerce on the release page, and comments open in a release-native modal instead of bouncing collectors into detail routes.
              </div>
            </aside>

            <main className="space-y-6">
              <section className="rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-6">
                {featuredItem ? (
                  <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                    <div className="space-y-4">
                      {(() => {
                        const isLiked = featuredItem.likeProductId ? favoriteProductIds.has(featuredItem.likeProductId) : false;
                        const FeaturedActionIcon = featuredItem.action.icon;

                        return (
                          <>
                            <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">
                              {featuredItem.kind === "drop" ? "Featured Live Drop" : "Featured Release"}
                            </p>
                            <h2 className="text-4xl font-black leading-tight text-foreground">{featuredItem.title}</h2>
                            <p className="text-lg font-semibold text-foreground/80">{featuredItem.typeLabel}</p>
                            <p className="max-w-2xl text-sm leading-7 text-foreground/70">{featuredItem.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {featuredItem.badges.map((badge) => (
                                <Badge
                                  key={badge}
                                  className={
                                    badge === "Gated"
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-white/90 text-[#1d4ed8] hover:bg-white/90"
                                  }
                                >
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-foreground/70">{featuredItem.helperText}</p>
                            <div className="flex flex-wrap gap-2">
                              {featuredItem.likeProductId ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleToggleLike(featuredItem)}
                                  className={`rounded-full bg-white/70 ${isLiked ? "border-rose-200 text-rose-600" : ""}`}
                                >
                                  <Heart className={`mr-2 h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                                  Like
                                </Button>
                              ) : null}
                              {featuredItem.commentProductId ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleOpenComments(featuredItem)}
                                  className="rounded-full bg-white/70"
                                >
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  Comment
                                </Button>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                onClick={() => handleOpenDetail(featuredItem)}
                                className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                              >
                                Open {featuredItem.kind === "drop" ? "drop" : "release"}
                              </Button>
                              {featuredItem.kind === "product" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleAction(featuredItem)}
                                  disabled={featuredItem.action.disabled}
                                  className="rounded-full bg-white/70"
                                >
                                  <FeaturedActionIcon className="mr-2 h-4 w-4" />
                                  {featuredItem.action.label}
                                </Button>
                              ) : null}
                            </div>
                            {featuredItem.kind === "drop" && featuredItem.drop ? (
                              <div className="max-w-xl rounded-[1.8rem] border border-white/60 bg-white/60 p-3">
                                {renderInlineDropAction(featuredItem.drop)}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>

                    <div className="overflow-hidden rounded-[1.8rem] border border-white/60 bg-white/65 shadow-sm">
                      {featuredItem.image ? (
                        <img src={featuredItem.image} alt={featuredItem.title} className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-white/60 text-sm text-muted-foreground">
                          Release preview coming soon
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.8rem] bg-white/75 p-8 text-center">
                    <Sparkles className="mx-auto mb-4 h-10 w-10 text-[#1d4ed8]" />
                    <p className="text-lg font-semibold text-foreground">No public releases are live yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Published releases and live drops will appear here as soon as they go live.
                    </p>
                  </div>
                )}
              </section>

              {loading ? (
                <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center text-muted-foreground">
                  Loading releases...
                </div>
              ) : error ? (
                <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center">
                  <p className="mb-4 text-destructive">{error.message}</p>
                  <Button onClick={() => window.location.reload()} variant="outline">
                    Retry
                  </Button>
                </div>
              ) : filteredItems.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredItems.map((item) => {
                    const ActionIcon = item.action.icon;
                    const isLiked = item.likeProductId ? favoriteProductIds.has(item.likeProductId) : false;

                    return (
                      <article
                        key={item.key}
                        className="rounded-[1.7rem] border border-[#dbeafe] bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
                      >
                        <div className="overflow-hidden rounded-[1.3rem] bg-[#f8fbff]">
                          {item.image ? (
                            <img src={item.image} alt={item.title} className="aspect-[4/3] w-full object-cover" />
                          ) : (
                            <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
                              No preview
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {item.badges.map((badge) => (
                            <Badge
                              key={`${item.key}:${badge}`}
                              className={
                                badge === "Gated"
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : badge === item.status
                                    ? "border border-border bg-transparent text-foreground"
                                    : "bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]"
                              }
                              variant={badge === item.status ? "outline" : "default"}
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>

                        <h3 className="mt-4 text-xl font-black text-foreground">{item.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{item.typeLabel}</p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.helperText}</p>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                            <p className="text-sm font-bold text-foreground">{formatEthAmount(item.priceEth)} ETH</p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Price</p>
                          </div>
                          <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                            <p className="text-sm font-bold text-foreground">{item.sold}</p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sold</p>
                          </div>
                          <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                            <p className="text-sm font-bold text-foreground">{item.availabilityLabel}</p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {item.availabilityLabel === "Live" || item.availabilityLabel === "Open" ? "Access" : "Left"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {item.likeProductId ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleToggleLike(item)}
                              className={`rounded-full ${isLiked ? "border-rose-200 text-rose-600" : ""}`}
                            >
                              <Heart className={`mr-2 h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                              Like
                            </Button>
                          ) : null}
                          {item.commentProductId ? (
                            <Button type="button" variant="outline" onClick={() => handleOpenComments(item)} className="rounded-full">
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Comment
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <Button
                            onClick={() => handleOpenDetail(item)}
                            className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                          >
                            Open {item.kind === "drop" ? "drop" : "release"}
                          </Button>
                          {item.kind === "product" ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleAction(item)}
                              disabled={item.action.disabled}
                              className="rounded-full"
                            >
                              <ActionIcon className="mr-2 h-4 w-4" />
                              {item.action.label}
                            </Button>
                          ) : null}
                        </div>

                        {item.kind === "drop" && item.drop ? (
                          <div className="mt-4 rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-3">
                            {renderInlineDropAction(item.drop)}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.8rem] border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-6 py-16 text-center">
                  <Sparkles className="mx-auto mb-4 h-10 w-10 text-[#1d4ed8]" />
                  <p className="text-lg font-semibold text-foreground">No releases match this view</p>
                  <p className="mt-2 text-sm text-muted-foreground">Try a different format filter or search term.</p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(commentTarget)} onOpenChange={(open) => !open && setCommentTarget(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-[2rem] border-[#dbeafe]">
          <DialogHeader>
            <DialogTitle>{commentTarget?.title || "Release comments"}</DialogTitle>
            <DialogDescription>
              Leave a release comment, private note, or subscriber thread directly from the catalog.
            </DialogDescription>
          </DialogHeader>

          {commentLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-4">
                  <p className="text-sm font-semibold text-foreground">Community thread snapshot</p>
                  {commentOverview?.public_threads?.length ? (
                    <div className="mt-3 space-y-3">
                      {commentOverview.public_threads.slice(0, 3).map((thread) => (
                        <div key={thread.id} className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap gap-2">
                            {thread.featured ? <Badge className="bg-[#dbeafe] text-[#1d4ed8]">Featured</Badge> : null}
                            {thread.creator_curated ? <Badge variant="outline">Curated</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {thread.title || (thread.feedback_type === "review" ? "Release review" : "Release thread")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {thread.rating ? `${thread.rating}/5` : "Conversation"} · {thread.feedback_type}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-foreground/80">
                            {thread.latest_message?.body || "No messages yet."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No public comments yet. The first release comment can start here.
                    </p>
                  )}
                </div>

                {commentOverview?.viewer_threads?.length ? (
                  <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-foreground">Your active release threads</p>
                    <div className="mt-3 space-y-2">
                      {commentOverview.viewer_threads.slice(0, 3).map((thread) => (
                        <div key={thread.id} className="rounded-2xl bg-background px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{thread.visibility}</Badge>
                            <Badge variant="outline">{thread.feedback_type}</Badge>
                            {thread.subscriber_priority ? <Badge className="bg-[#ecfeff] text-[#0f766e]">Subscriber priority</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{thread.title || "Release thread"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{thread.latest_message?.body || "Thread started"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-[#dbeafe] bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Leave a comment</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {canLeaveComment
                      ? "Post from the release page without leaving the catalog."
                      : address
                        ? "Collect this release or activate a subscription to open a private thread."
                        : "Connect your wallet to comment on this release."}
                  </p>
                </div>

                {canLeaveComment ? (
                  <>
                    {canPublishPublicReview ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={commentForm.visibility === "public" ? "default" : "outline"}
                          onClick={() => setCommentForm((prev) => ({ ...prev, visibility: "public", feedbackType: "review" }))}
                          className="rounded-full"
                        >
                          Public comment
                        </Button>
                        <Button
                          type="button"
                          variant={commentForm.visibility === "private" ? "default" : "outline"}
                          onClick={() => setCommentForm((prev) => ({ ...prev, visibility: "private", feedbackType: "feedback" }))}
                          className="rounded-full"
                        >
                          Private note
                        </Button>
                        {commentOverview?.viewer_relationship.active_subscription ? (
                          <Badge className="bg-[#ecfeff] text-[#0f766e]">Subscriber priority</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#99f6e4] bg-[#f0fdfa] p-4 text-sm text-[#0f766e]">
                        Your subscription unlocks a gated private thread with the creator directly from this release page.
                      </div>
                    )}

                    {commentForm.visibility === "private" || !canPublishPublicReview ? (
                      <select
                        value={commentForm.feedbackType}
                        onChange={(event) =>
                          setCommentForm((prev) => ({
                            ...prev,
                            feedbackType: event.target.value as "feedback" | "question" | "review",
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      >
                        <option value="feedback">Feedback</option>
                        <option value="question">Question</option>
                        {canPublishPublicReview ? <option value="review">Collector note</option> : null}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Rating</span>
                        <select
                          value={commentForm.rating}
                          onChange={(event) =>
                            setCommentForm((prev) => ({ ...prev, rating: Number(event.target.value) || 5 }))
                          }
                          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} / 5
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Input
                      value={commentForm.title}
                      onChange={(event) => setCommentForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder={
                        canPublishPublicReview && commentForm.visibility === "public"
                          ? "Comment title"
                          : feedbackGate === "subscriber"
                            ? "Optional subject for your subscriber thread"
                            : "Optional subject for the creator"
                      }
                      className="rounded-xl"
                    />
                    <textarea
                      value={commentForm.body}
                      onChange={(event) => setCommentForm((prev) => ({ ...prev, body: event.target.value }))}
                      className="min-h-[180px] w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm"
                      placeholder={
                        canPublishPublicReview && commentForm.visibility === "public"
                          ? "Tell collectors what this release felt like to collect, buy, or experience."
                          : feedbackGate === "subscriber"
                            ? "Ask a subscriber-only question or start a gated release conversation."
                            : "Send the creator a private release note, request, or idea."
                      }
                    />
                    <Button
                      onClick={() => void handleSubmitComment()}
                      disabled={commentSubmitting || !commentForm.body.trim()}
                      className="w-full rounded-full"
                    >
                      {commentSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : canPublishPublicReview ? (
                        "Post comment"
                      ) : (
                        "Open subscriber thread"
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    Public comments stay available to read here, but posting opens only after collection or with an active subscriber relationship.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReleasesPage;
