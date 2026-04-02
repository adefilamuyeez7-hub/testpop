/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ProductGrid } from "@/components/ProductCard";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { useSupabasePublishedProducts } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { extractContractProductId, extractProductMetadataUri } from "@/lib/productMetadata";

function mapSupabaseProductToStoreProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    image: resolveMediaUrl(p.image_url, p.image_ipfs_uri),
    price: BigInt(Math.floor(parseFloat(p.price_eth) * 1e18)),
    creator: p.creator_wallet || "0x0",
    description: p.description || "",
    stock: p.stock || 0,
    sold: p.sold || 0,
    category: p.category || "Other",
    contractProductId: extractContractProductId(p.metadata),
    metadataUri: extractProductMetadataUri(p.metadata),
  };
}

export function ProductsPage() {
  const navigate = useNavigate();
  const setProducts = useProductStore((state) => state.setProducts);
  const totalCartItems = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );
  const { data: supabaseProducts, loading, error } = useSupabasePublishedProducts();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    if (supabaseProducts && supabaseProducts.length > 0) {
      setProducts(supabaseProducts.map(mapSupabaseProductToStoreProduct));
      return;
    }

    setProducts([]);
  }, [supabaseProducts, setProducts]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-6">
            <div className="flex items-center gap-4 border-b border-black/6 pb-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">SHOP</h1>
                <p className="text-sm text-muted-foreground">Discover your favorite creative goods</p>
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
                    <span className="text-xs text-muted-foreground">Shop</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-8">
                  <div className="absolute left-6 top-5 h-20 w-20 rounded-full bg-black/8 blur-2xl" />
                  <div className="absolute bottom-4 right-6 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />
                  <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Desktop Shop</p>
                      <h2 className="max-w-2xl text-4xl font-black leading-tight text-foreground">
                        New arrivals from digital creators and collectible product drops
                      </h2>
                      <p className="max-w-xl text-sm leading-7 text-foreground/70">
                        Explore curated merchandise, digital goods, and creative products from artists building inside POPUP.
                      </p>
                      <Button
                        onClick={() => {
                          if (heroDesktopProduct) {
                            navigate(`/products/${heroDesktopProduct.id}`);
                          }
                        }}
                        className="h-11 rounded-full bg-[#1d4ed8] px-6 text-white hover:bg-[#1e40af]"
                      >
                        Shop now
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
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Shop</p>
                    <h3 className="mt-2 text-3xl font-black text-foreground">New arrivals</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filteredByCategory.length} product{filteredByCategory.length !== 1 ? "s" : ""} found
                  </p>
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
                    Loading products from Supabase...
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
                      <p className="mb-4 text-muted-foreground">No products found</p>
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
                <p className="text-muted-foreground">Discover exclusive artist merchandise and collectibles</p>
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
                  placeholder="Search products..."
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
          {loading && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Loading products from Supabase...</p>
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
                {filteredByCategory.length} product{filteredByCategory.length !== 1 ? "s" : ""} found
              </p>
              <ProductGrid products={filteredByCategory} />
            </>
          ) : (
            !loading && !error && (
              <div className="py-12 text-center">
                <p className="mb-4 text-muted-foreground">No products found</p>
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
