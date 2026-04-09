import { useMemo, useState } from "react";
import { Gavel, Heart, MessageCircle, Search, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cartStore";
import { useSupabaseLiveDrops, useSupabasePublishedProducts } from "@/hooks/useSupabase";
import type { CreativeRelease, Drop, Product } from "@/lib/db";
import { resolveDropBehavior, resolveDropDetailPath } from "@/lib/dropBehavior";
import { isProductFavorited, toggleProductFavorite } from "@/lib/favoritesStore";
import { resolveMediaUrl } from "@/lib/pinata";
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
    return {
      label: "Bid",
      icon: Gavel,
      action: "detail",
      disabled: false,
    };
  }

  if (product.product_type === "digital" || searchSpace.includes("collectible") || searchSpace.includes("collect")) {
    return {
      label: "Collect",
      icon: Sparkles,
      action: "detail",
      disabled: false,
    };
  }

  return {
    label: "Add to cart",
    icon: ShoppingCart,
    action: "cart",
    disabled: !isOnchainReady(product),
  };
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
        | null
      ) || null,
      contractDropId: Number.isFinite(Number(drop.contract_drop_id)) ? Number(drop.contract_drop_id) : null,
      metadata,
    },
    linkedProduct,
    linkedRelease,
    sourceKind,
  });

  if (behavior.mode === "auction") {
    return {
      label: "Bid",
      icon: Gavel,
      action: "detail",
      disabled: false,
    };
  }

  if (behavior.mode === "collect") {
    return {
      label: "Collect",
      icon: Sparkles,
      action: "detail",
      disabled: false,
    };
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
  const remainingStock = Number(product.stock || 0) > 0
    ? Math.max(Number(product.stock || 0) - Number(product.sold || 0), 0)
    : null;

  return {
    key: `product:${product.id}`,
    kind: "product",
    title: product.name || "Untitled Release",
    description:
      product.description ||
      "Open the release to view full details, onchain checkout status, and creator threads.",
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
    badges: [
      formatLabel(product.category || "release"),
      product.status || "published",
      ...(product.is_gated ? ["Gated"] : []),
    ],
    helperText: "Release checkout, gated access, and subscriber-ready thread entry all live here.",
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
  const remaining = Number(drop.supply || 0) > 0
    ? Math.max(Number(drop.supply || 0) - Number(drop.sold || 0), 0)
    : null;
  const action = resolveDropAction(drop);

  return {
    key: `drop:${drop.id}`,
    kind: "drop",
    title: drop.title || "Untitled Drop",
    description:
      drop.description ||
      "Open this live drop from the release surface to collect, bid, or buy through its linked commerce flow.",
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
    badges: [
      formatLabel(drop.type || "drop"),
      formatLabel(releaseType || ""),
      ...(drop.is_gated ? ["Gated"] : []),
    ].filter(Boolean),
    helperText:
      action.label === "Buy"
        ? "This live drop is checkout-backed and can move straight into cart from the release catalog."
        : "This live drop keeps its drop mechanics while inheriting the release browsing experience.",
    action,
    drop,
  };
}

const ReleasesPage = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const addItem = useCartStore((state) => state.addItem);
  const { data: products, loading: productsLoading, error: productsError } = useSupabasePublishedProducts();
  const { data: liveDrops, loading: dropsLoading, error: dropsError } = useSupabaseLiveDrops();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

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
    const types = new Set(
      catalogItems
        .map((item) => item.filterValue)
        .filter(Boolean),
    );
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
    toast.success(added ? "Release added to likes." : "Release removed from likes.");
  }

  function handleOpenComments(item: ReleaseCatalogItem) {
    if (!item.commentProductId) {
      toast.error("Comment threads open on linked release pages.");
      return;
    }

    navigate(`/products/${item.commentProductId}#feedback`);
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

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Releases</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse one release-style catalog for published releases, live drops, auctions, and gated subscriber conversation entry.
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
                  {option === "all"
                    ? catalogItems.length
                    : catalogItems.filter((item) => item.filterValue === option).length}
                </span>
              </button>
            ))}

            <div className="rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-4 text-sm text-muted-foreground">
              Subscribers can now open gated release threads, while collectors still unlock public reviews and private feedback after collection.
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-6">
              {featuredItem ? (
                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                  <div className="space-y-4">
                    {(() => {
                      const isLiked = featuredItem.likeProductId && address
                        ? isProductFavorited(address, featuredItem.likeProductId)
                        : false;
                      const FeaturedActionIcon = featuredItem.action.icon;

                      return (
                        <>
                          <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">
                            {featuredItem.kind === "drop" ? "Featured Live Drop" : "Featured Release"}
                          </p>
                          <h2 className="text-4xl font-black leading-tight text-foreground">
                            {featuredItem.title}
                          </h2>
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
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="overflow-hidden rounded-[1.8rem] border border-white/60 bg-white/65 shadow-sm">
                    {featuredItem.image ? (
                      <img
                        src={featuredItem.image}
                        alt={featuredItem.title}
                        className="aspect-[4/3] w-full object-cover"
                      />
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
                  const isLiked = item.likeProductId && address
                    ? isProductFavorited(address, item.likeProductId)
                    : false;

                  return (
                    <article
                      key={item.key}
                      className="rounded-[1.7rem] border border-[#dbeafe] bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
                    >
                      <div className="overflow-hidden rounded-[1.3rem] bg-[#f8fbff]">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="aspect-[4/3] w-full object-cover"
                          />
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
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenComments(item)}
                            className="rounded-full"
                          >
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
                      </div>
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
  );
};

export default ReleasesPage;
