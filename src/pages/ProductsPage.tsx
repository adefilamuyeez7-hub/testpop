/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Package, Search, ShoppingCart, Sparkles } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ProductGrid } from "@/components/ProductCard";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { useSupabasePublishedProducts } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { resolveContractProductId, resolveProductMetadataUri } from "@/lib/productMetadata";
import {
  getIPCampaigns,
  getInvestorPositions,
  getRoyaltyDistributions,
  type IPCampaign,
  type RoyaltyDistribution,
} from "@/lib/db";
import { getRuntimeApiToken } from "@/lib/runtimeSession";

function mapSupabaseProductToStoreProduct(p: any) {
  return {
    id: p.id,
    creativeReleaseId: p.creative_release_id ?? null,
    name: p.name,
    image: resolveMediaUrl(p.image_url, p.image_ipfs_uri),
    price: BigInt(Math.floor(parseFloat(p.price_eth) * 1e18)),
    creator: p.creator_wallet || "0x0",
    description: p.description || "",
    stock: p.stock || 0,
    sold: p.sold || 0,
    category: p.category || "Other",
    releaseType: p.product_type || "physical",
    contractKind: p.contract_kind || "productStore",
    contractListingId: Number.isFinite(Number(p.contract_listing_id)) ? Number(p.contract_listing_id) : null,
    contractProductId: resolveContractProductId(p.metadata, p.contract_product_id),
    metadataUri: resolveProductMetadataUri(p.metadata, p.metadata_uri),
  };
}

function formatEthAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.00";
  }
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const setProducts = useProductStore((state) => state.setProducts);
  const totalCartItems = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );
  const { data: supabaseProducts, loading, error } = useSupabasePublishedProducts();
  const hasApiSession = Boolean(getRuntimeApiToken());

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [category, setCategory] = useState("all");
  const [campaigns, setCampaigns] = useState<IPCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [investorPositions, setInvestorPositions] = useState<Record<string, number>>({});
  const [royaltyDistributions, setRoyaltyDistributions] = useState<RoyaltyDistribution[]>([]);

  useEffect(() => {
    if (supabaseProducts && supabaseProducts.length > 0) {
      setProducts(supabaseProducts.map(mapSupabaseProductToStoreProduct));
      return;
    }

    setProducts([]);
  }, [supabaseProducts, setProducts]);

  useEffect(() => {
    let isMounted = true;
    setCampaignsLoading(true);

    getIPCampaigns()
      .then((data) => {
        if (isMounted) {
          setCampaigns(data || []);
        }
      })
      .catch((campaignError) => {
        console.error("Failed to load marketplace campaigns:", campaignError);
        if (isMounted) {
          setCampaigns([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setCampaignsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!address || !hasApiSession) {
      setInvestorPositions({});
      setRoyaltyDistributions([]);
      return;
    }

    let isMounted = true;

    Promise.all([
      getInvestorPositions(address),
      getRoyaltyDistributions(address),
    ])
      .then(([positions, distributions]) => {
        if (!isMounted) return;

        const nextPositions = (positions || []).reduce<Record<string, number>>((acc, position) => {
          acc[position.campaign_id] = (acc[position.campaign_id] || 0) + Number(position.units_purchased || 0);
          return acc;
        }, {});

        setInvestorPositions(nextPositions);
        setRoyaltyDistributions(distributions || []);
      })
      .catch((positionsError) => {
        console.error("Failed to load investor marketplace data:", positionsError);
        if (isMounted) {
          setInvestorPositions({});
          setRoyaltyDistributions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [address, hasApiSession]);

  const categoryOptions = useMemo(() => {
    const categories = new Set(
      (supabaseProducts || [])
        .map((product) => product.category || "Other")
        .filter(Boolean)
    );

    return ["all", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  }, [supabaseProducts]);

  const filteredByCategory = useMemo(() => {
    let products = (supabaseProducts || []).map(mapSupabaseProductToStoreProduct);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      products = products.filter((product) =>
        product.name?.toLowerCase().includes(normalizedQuery) ||
        product.description?.toLowerCase().includes(normalizedQuery)
      );
    }

    if (category !== "all") {
      products = products.filter((product) => product.category === category);
    }

    if (sortOrder === "price-low") {
      products = [...products].sort((a, b) => Number(a.price - b.price));
    } else if (sortOrder === "price-high") {
      products = [...products].sort((a, b) => Number(b.price - a.price));
    }

    return products;
  }, [category, searchQuery, sortOrder, supabaseProducts]);

  const desktopCategories = categoryOptions.filter((option) => option !== "all");
  const heroDesktopProduct = filteredByCategory[0] ?? null;
  const heroDesktopTiles = filteredByCategory.slice(1, 3);
  const featuredCampaigns = useMemo(
    () => campaigns.filter((campaign) => ["active", "funded", "settled", "closed"].includes(campaign.status || "")).slice(0, 3),
    [campaigns],
  );
  const totalRevenueDistributed = useMemo(
    () => royaltyDistributions.reduce((sum, distribution) => sum + Number(distribution.net_amount_eth || 0), 0),
    [royaltyDistributions],
  );
  const totalOwnedUnits = useMemo(
    () => Object.values(investorPositions).reduce((sum, units) => sum + units, 0),
    [investorPositions],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-6">
            <div className="flex items-center gap-4 border-b border-black/6 pb-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">MARKETPLACE</h1>
                <p className="text-sm text-muted-foreground">Discover collectible releases, investment rights, and revenue-ready creative goods.</p>
              </div>

              <div className="relative ml-6 max-w-xl flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search for items, brands, inspiration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-full border-black/8 bg-white pl-11 pr-4"
                />
              </div>

              <Button
                onClick={() => navigate("/orders")}
                className="h-12 rounded-full border border-black/8 bg-white px-5 text-foreground hover:bg-secondary"
                variant="outline"
              >
                <Package className="mr-2 h-4 w-4" />
                Orders
              </Button>

              <Button
                onClick={() => navigate("/cart")}
                className="relative h-12 rounded-full border border-black/8 bg-white px-5 text-foreground hover:bg-secondary"
                variant="outline"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
                {totalCartItems > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                    {totalCartItems}
                  </span>
                )}
              </Button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition-colors ${
                    category === "all" ? "bg-[#dbeafe] text-foreground" : "bg-secondary/60 text-foreground"
                  }`}
                >
                  <span>New arrivals</span>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </button>

                {desktopCategories.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition-colors ${
                      category === option ? "bg-[#dbeafe] text-foreground" : "bg-secondary/60 text-foreground"
                    }`}
                  >
                    <span>{option}</span>
                    <span className="text-xs text-muted-foreground">Market</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-8">
                  <div className="absolute left-6 top-5 h-20 w-20 rounded-full bg-black/8 blur-2xl" />
                  <div className="absolute bottom-4 right-6 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />
                  <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Desktop Marketplace</p>
                      <h2 className="max-w-2xl text-4xl font-black leading-tight text-foreground">
                        Primary releases, relist-ready rights, and artist-backed investment access
                      </h2>
                      <p className="max-w-xl text-sm leading-7 text-foreground/70">
                        Explore curated products alongside campaign positions that can keep earning through revenue distributions as the release ecosystem grows.
                      </p>
                      <Button
                        onClick={() => {
                          if (heroDesktopProduct) {
                            navigate(`/products/${heroDesktopProduct.id}`);
                          }
                        }}
                        className="h-11 rounded-full bg-[#1d4ed8] px-6 text-white hover:bg-[#1e40af]"
                      >
                        Explore marketplace
                      </Button>
                    </div>

                    {heroDesktopProduct ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm lg:col-span-2">
                          <img
                            src={heroDesktopProduct.image}
                            alt={heroDesktopProduct.name}
                            className="h-56 w-full rounded-[1.2rem] object-cover"
                          />
                        </div>

                        {heroDesktopTiles.map((product) => (
                          <button
                            key={`shop-hero-${product.id}`}
                            type="button"
                            onClick={() => navigate(`/products/${product.id}`)}
                            className="overflow-hidden rounded-[1.4rem] bg-white/65 p-2 text-left shadow-sm transition-transform hover:-translate-y-1"
                          >
                            <img src={product.image} alt={product.name} className="h-24 w-full rounded-[1rem] object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Marketplace</p>
                    <h3 className="mt-2 text-3xl font-black text-foreground">Primary listings</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filteredByCategory.length} product{filteredByCategory.length !== 1 ? "s" : ""} found
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Marketplace</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">Primary + rights discovery</p>
                    <p className="mt-1 text-sm text-muted-foreground">Browse product drops, investment listings, and revenue-share context in one place.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/cart")}
                    className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4 text-left transition-colors hover:bg-[#f8fbff]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Checkout</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{totalCartItems} item{totalCartItems !== 1 ? "s" : ""} ready</p>
                    <p className="mt-1 text-sm text-muted-foreground">Review quantities and move from discovery into checkout without leaving the marketplace.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/orders")}
                    className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4 text-left transition-colors hover:bg-[#f8fbff]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Revenue</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatEthAmount(totalRevenueDistributed)} ETH distributed</p>
                    <p className="mt-1 text-sm text-muted-foreground">Keep an eye on distributions tied to the rights and campaign positions you hold.</p>
                  </button>
                </div>

                <div className="rounded-[1.8rem] border border-[#dbeafe] bg-white/88 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Investment Rights</p>
                      <h3 className="mt-2 text-2xl font-black text-foreground">Relist-ready positions and revenue distribution</h3>
                      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        The marketplace now surfaces artist investment campaigns beside products so collectors can discover rights-bearing positions, monitor owned units, and follow revenue distributions tied to those releases.
                      </p>
                    </div>
                    <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-[#eff6ff] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Live Raises</p>
                        <p className="mt-2 text-2xl font-black text-foreground">{campaignsLoading ? "..." : featuredCampaigns.length}</p>
                      </div>
                      <div className="rounded-[1.25rem] bg-[#eff6ff] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Owned Units</p>
                        <p className="mt-2 text-2xl font-black text-foreground">{hasApiSession ? totalOwnedUnits : "--"}</p>
                      </div>
                    </div>
                  </div>

                  {featuredCampaigns.length > 0 ? (
                    <div className="mt-5 grid gap-3 lg:grid-cols-3">
                      {featuredCampaigns.map((campaign) => {
                        const ownedUnits = investorPositions[campaign.id] || 0;
                        return (
                          <button
                            key={campaign.id}
                            type="button"
                            onClick={() => navigate(`/artists/${campaign.artist_id}`)}
                            className="rounded-[1.4rem] border border-[#dbeafe] bg-[#f8fbff] p-4 text-left transition-colors hover:bg-white"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#dbeafe] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1d4ed8]">
                                {campaign.rights_type || "creative_ip"}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
                                {campaign.status || "active"}
                              </span>
                              {ownedUnits > 0 && (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                  Relist-ready
                                </span>
                              )}
                            </div>
                            <h4 className="mt-3 text-lg font-semibold text-foreground">{campaign.title}</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {(campaign.artists?.name || campaign.artists?.handle || "Artist raise")} · {campaign.campaign_type || "revenue_share"}
                            </p>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-sm font-bold text-foreground">{formatEthAmount(Number(campaign.funding_target_eth || 0))}</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Target</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-sm font-bold text-foreground">{formatEthAmount(Number(campaign.unit_price_eth || 0))}</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Unit</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-sm font-bold text-foreground">{ownedUnits || Number(campaign.units_sold || 0)}</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{ownedUnits > 0 ? "Owned" : "Sold"}</p>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-muted-foreground">
                              {ownedUnits > 0
                                ? "Open the artist profile to manage your position and follow revenue distributions tied to this release."
                                : "Open the artist profile to invest, review rights terms, and track future revenue participation."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[1.4rem] border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-4 py-8 text-center text-sm text-muted-foreground">
                      {campaignsLoading
                        ? "Loading marketplace rights..."
                        : "No public investment campaigns are live yet. Product listings will continue to appear below."}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="h-11 rounded-full border border-black/8 bg-white px-4 text-sm"
                  >
                    <option value="newest">Sort</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>

                  {desktopCategories.map((option) => (
                    <button
                      key={`chip-${option}`}
                      type="button"
                      onClick={() => setCategory(option)}
                      className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                        category === option ? "bg-[#1d4ed8] text-white" : "bg-secondary/60 text-foreground"
                      }`}
                    >
                      {option}
                    </button>
                  ))}

                  {category !== "all" && (
                    <button
                      type="button"
                      onClick={() => setCategory("all")}
                      className="h-11 rounded-full bg-[#dbeafe] px-4 text-sm font-medium text-foreground"
                    >
                      Clear category
                    </button>
                  )}
                </div>

                {loading && (
                  <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center text-muted-foreground">
                    Loading marketplace listings...
                  </div>
                )}

                {error && (
                  <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center">
                    <p className="mb-4 text-destructive">Error loading products</p>
                    <Button onClick={() => window.location.reload()} variant="outline">
                      Retry
                    </Button>
                  </div>
                )}

                {!loading && !error && filteredByCategory.length > 0 ? (
                  <div className="rounded-[1.8rem] bg-white/70 p-4">
                    <ProductGrid products={filteredByCategory} />
                  </div>
                ) : (
                  !loading && !error && (
                    <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center">
                      <p className="mb-4 text-muted-foreground">No marketplace listings found</p>
                      <Button
                        onClick={() => {
                          setSearchQuery("");
                          setCategory("all");
                        }}
                        variant="outline"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Marketplace</h1>
                <p className="text-muted-foreground">Discover products, rights listings, and revenue-ready artist releases</p>
              </div>
              <Button
                onClick={() => navigate("/cart")}
                className="relative gap-2"
                variant="outline"
              >
                <ShoppingCart className="h-5 w-5" />
                Cart
                {totalCartItems > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {totalCartItems}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search marketplace listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <label className="sr-only" htmlFor="product-category">Filter by category</label>
              <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-44"
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All Categories" : option}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="product-sort">Sort products</label>
              <select
                id="product-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-44"
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 rounded-[1.8rem] border border-[#dbeafe] bg-[#f8fbff] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Rights Marketplace</p>
            <h2 className="mt-2 text-2xl font-black text-foreground">Investment positions live next to product drops</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Track relist-ready positions and revenue distributions while you browse physical and digital releases.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-lg font-black text-foreground">{campaignsLoading ? "..." : featuredCampaigns.length}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Raises</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-lg font-black text-foreground">{hasApiSession ? totalOwnedUnits : "--"}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Owned Units</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-lg font-black text-foreground">{formatEthAmount(totalRevenueDistributed)}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Revenue</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Loading marketplace listings...</p>
            </div>
          )}
          {error && (
            <div className="py-12 text-center">
              <p className="mb-4 text-destructive">Error loading products</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && filteredByCategory.length > 0 ? (
            <>
              <p className="mb-6 text-muted-foreground">
                {filteredByCategory.length} listing{filteredByCategory.length !== 1 ? "s" : ""} found
              </p>
              <ProductGrid products={filteredByCategory} />
            </>
          ) : (
            !loading && !error && (
              <div className="py-12 text-center">
                <p className="mb-4 text-muted-foreground">No marketplace listings found</p>
                <Button onClick={() => setSearchQuery("")} variant="outline">
                  Clear Filters
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
