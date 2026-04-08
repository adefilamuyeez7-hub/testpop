import { useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabasePublishedProducts } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";

function formatEthAmount(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0.00";
  return numeric >= 10 ? numeric.toFixed(1) : numeric.toFixed(2);
}

function formatLabel(value?: string | null) {
  return String(value || "").replace(/_/g, " ").trim();
}

const ReleasesPage = () => {
  const navigate = useNavigate();
  const { data: products, loading, error } = useSupabasePublishedProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const releaseTypes = useMemo(() => {
    const types = new Set(
      (products || [])
        .map((product) => product.product_type || product.category || "release")
        .filter(Boolean),
    );
    return ["all", ...Array.from(types).sort((left, right) => String(left).localeCompare(String(right)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (products || []).filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.description, product.category, product.product_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const productType = product.product_type || product.category || "release";
      const matchesType = typeFilter === "all" || productType === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [products, searchQuery, typeFilter]);

  const featuredProduct = filteredProducts[0] || products?.[0] || null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Releases</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse live creator releases, physical editions, hybrid collectibles, and gated products in one catalog.
                </p>
              </div>

              <div className="relative min-w-[260px] flex-1 lg:max-w-md">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search releases, formats, categories..."
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
                    ? products?.length || 0
                    : (products || []).filter((product) => (product.product_type || product.category || "release") === option).length}
                </span>
              </button>
            ))}

            <div className="rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-4 text-sm text-muted-foreground">
              Collectors can open a release, buy it onchain, and leave verified feedback once it reaches their collection.
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-6">
              {featuredProduct ? (
                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Featured Release</p>
                    <h2 className="text-4xl font-black leading-tight text-foreground">{featuredProduct.name || "Untitled Release"}</h2>
                    <p className="text-lg font-semibold text-foreground/80">
                      {formatLabel(featuredProduct.product_type || featuredProduct.category || "release")}
                    </p>
                    <p className="max-w-2xl text-sm leading-7 text-foreground/70">
                      {featuredProduct.description || "Open the release page to view art, shipping, ownership details, and verified collector feedback."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-white/90 text-[#1d4ed8] hover:bg-white/90">
                        {formatLabel(featuredProduct.category || "release")}
                      </Badge>
                      <Badge variant="outline" className="border-white/70 bg-white/55 uppercase">
                        {featuredProduct.status || "published"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => navigate(`/products/${featuredProduct.id}`)} className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
                        Open release
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/drops")} className="rounded-full bg-white/70">
                        Browse drops
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.8rem] border border-white/60 bg-white/65 shadow-sm">
                    {resolveMediaUrl(featuredProduct.image_url, featuredProduct.image_ipfs_uri) ? (
                      <img
                        src={resolveMediaUrl(featuredProduct.image_url, featuredProduct.image_ipfs_uri)}
                        alt={featuredProduct.name || "Release"}
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
                  <p className="mt-2 text-sm text-muted-foreground">Published creator releases will appear here as soon as they go live.</p>
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
            ) : filteredProducts.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredProducts.map((product) => {
                  const remainingStock = Number(product.stock || 0) > 0 ? Math.max(Number(product.stock || 0) - Number(product.sold || 0), 0) : null;
                  return (
                    <article key={product.id} className="rounded-[1.7rem] border border-[#dbeafe] bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
                      <div className="overflow-hidden rounded-[1.3rem] bg-[#f8fbff]">
                        {resolveMediaUrl(product.image_url, product.image_ipfs_uri) ? (
                          <img
                            src={resolveMediaUrl(product.image_url, product.image_ipfs_uri)}
                            alt={product.name || "Release"}
                            className="aspect-[4/3] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
                            No preview
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]">
                          {formatLabel(product.product_type || "release")}
                        </Badge>
                        <Badge variant="outline" className="uppercase">
                          {product.status || "published"}
                        </Badge>
                        {product.is_gated ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Gated</Badge> : null}
                      </div>

                      <h3 className="mt-4 text-xl font-black text-foreground">{product.name || "Untitled Release"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{formatLabel(product.category || "release")}</p>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {product.description || "Open the release to view full details, onchain checkout status, and verified collector feedback."}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{formatEthAmount(product.price_eth)} ETH</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Price</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{product.sold || 0}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sold</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{remainingStock === null ? "Open" : remainingStock}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{remainingStock === null ? "Access" : "Left"}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button onClick={() => navigate(`/products/${product.id}`)} className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
                          Open release
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/drops")} className="rounded-full">
                          Browse drops
                          <ArrowRight className="ml-2 h-4 w-4" />
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
