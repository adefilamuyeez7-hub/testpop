import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Filter, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recordPageVisit } from "@/lib/analyticsStore";
import { useSupabaseLiveDrops } from "@/hooks/useSupabase";
import { type AssetType } from "@/lib/assetTypes";
import { resolveMediaUrl } from "@/lib/pinata";

const filters = [
  { label: "All", value: "all" },
  { label: "Auction", value: "auction" },
  { label: "Drop", value: "drop" },
  { label: "Campaign", value: "campaign" },
] as const;

const DropsPage = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<(typeof filters)[number]["value"]>("all");
  const { data: supabaseDrops, loading, error } = useSupabaseLiveDrops();

  const allDrops = useMemo(() => {
    if (!supabaseDrops || supabaseDrops.length === 0) return [];
    return supabaseDrops.map((drop) => {
      const artist = drop.artists && !Array.isArray(drop.artists) ? drop.artists : null;
      return {
        id: drop.id,
        title: drop.title,
        artist: artist?.name || "Unknown Artist",
        priceEth: drop.price_eth ? parseFloat(drop.price_eth).toFixed(4) : "0",
        image: resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri),
        previewUri: resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri),
        deliveryUri: drop.delivery_uri || "",
        type: (drop.type || "drop").toLowerCase() as "drop" | "auction" | "campaign",
        status: drop.status as "live" | "draft" | "ended",
        endsIn: drop.ends_at
          ? `${Math.max(0, Math.floor((new Date(drop.ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h`
          : "--",
        assetType: (drop.asset_type || "image") as AssetType,
      };
    });
  }, [supabaseDrops]);

  const filtered = active === "all" ? allDrops : allDrops.filter((drop) => drop.type === active);

  useEffect(() => {
    recordPageVisit();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Art Drops</h1>
          <button className="rounded-full bg-secondary p-2">
            <Filter className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Art Drops</h1>
          <button className="rounded-full bg-secondary p-2">
            <Filter className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>
        <div className="text-sm text-red-500">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden md:block px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-6">
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="space-y-3">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActive(filter.value)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition-colors ${
                      active === filter.value ? "bg-[#dbeafe] text-foreground" : "bg-secondary/60 text-foreground"
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className="text-xs uppercase text-muted-foreground">{filter.value}</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-8">
                  <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Desktop Drops</p>
                      <h1 className="max-w-2xl text-4xl font-black leading-tight text-foreground">
                        Live drops, auctions, and campaigns in one desktop marketplace
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-foreground/70">
                        Browse active creative releases, filter by drop type, and open each release for collection, bidding, or campaign access.
                      </p>
                      <Button
                        onClick={() => {
                          const firstDrop = filtered[0];
                          if (firstDrop) {
                            navigate(`/drops/${firstDrop.id}`);
                          }
                        }}
                        className="h-11 rounded-full bg-[#1d4ed8] px-6 text-white hover:bg-[#1e40af]"
                      >
                        Explore drops
                      </Button>
                    </div>

                    {filtered[0] ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm lg:col-span-2">
                          {filtered[0].image ? (
                            <img src={filtered[0].image} alt={filtered[0].title} className="h-56 w-full rounded-[1.2rem] object-cover" />
                          ) : (
                            <div className="flex h-56 w-full items-center justify-center rounded-[1.2rem] bg-black/10 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60">
                              {filtered[0].assetType}
                            </div>
                          )}
                        </div>
                        {filtered.slice(1, 3).map((drop) => (
                          <Link
                            key={`desktop-drop-hero-${drop.id}`}
                            to={`/drops/${drop.id}`}
                            className="overflow-hidden rounded-[1.4rem] bg-white/65 p-2 shadow-sm transition-transform hover:-translate-y-1"
                          >
                            {drop.image ? (
                              <img src={drop.image} alt={drop.title} className="h-24 w-full rounded-[1rem] object-cover" />
                            ) : (
                              <div className="flex h-24 w-full items-center justify-center rounded-[1rem] bg-black/10 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
                                {drop.assetType}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Live Drops</p>
                    <h2 className="mt-2 text-3xl font-black text-foreground">Fresh releases</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {filters.map((filter) => (
                      <button
                        key={`desktop-filter-${filter.value}`}
                        type="button"
                        onClick={() => setActive(filter.value)}
                        className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                          active === filter.value ? "bg-[#1d4ed8] text-white" : "bg-secondary/60 text-foreground"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 p-10 text-center">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                    <p className="text-lg font-semibold text-foreground">No drops yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Published drops from approved artists will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-3">
                    {filtered.map((drop) => (
                      <Link
                        key={drop.id}
                        to={`/drops/${drop.id}`}
                        className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)] ring-1 ring-[#dbe7ff] transition-transform hover:-translate-y-1"
                      >
                        <div className="relative aspect-[1.05] overflow-hidden bg-secondary">
                          {drop.assetType === "image" && drop.image ? (
                            <img src={drop.image} alt={drop.title} className="h-full w-full object-cover" />
                          ) : drop.assetType === "video" && (drop.previewUri || drop.image) ? (
                            <img src={drop.previewUri || drop.image} alt={drop.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                              {drop.assetType}
                            </div>
                          )}
                          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
                            <Badge className="bg-background/80 text-[10px] text-foreground backdrop-blur-sm">
                              {drop.type}
                            </Badge>
                            {drop.assetType && drop.assetType !== "image" && (
                              <Badge className="bg-primary/80 text-[10px] capitalize text-primary-foreground backdrop-blur-sm">
                                {drop.assetType}
                              </Badge>
                            )}
                          </div>
                          {drop.status === "live" && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                        </div>
                        <div className="p-5">
                          <p className="truncate text-lg font-semibold text-card-foreground">{drop.title}</p>
                          <p className="text-sm text-muted-foreground">{drop.artist}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm font-bold text-primary">{drop.priceEth} ETH</span>
                            {drop.status === "live" && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /> {drop.endsIn}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4 md:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Art Drops</h1>
          <button className="rounded-full bg-secondary p-2">
            <Filter className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActive(filter.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                active === filter.value ? "gradient-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="text-lg font-semibold text-foreground">No drops yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Published drops from approved artists will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((drop, index) => (
              <Link
                key={drop.id}
                to={`/drops/${drop.id}`}
                className="group animate-fade-in overflow-hidden rounded-2xl bg-card shadow-card"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="relative aspect-square overflow-hidden bg-secondary">
                  {drop.assetType === "image" && drop.image ? (
                    <img
                      src={drop.image}
                      alt={drop.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : drop.assetType === "video" && (drop.previewUri || drop.image) ? (
                    <img
                      src={drop.previewUri || drop.image}
                      alt={drop.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      {drop.assetType}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <Badge className="bg-background/80 text-[10px] text-foreground backdrop-blur-sm">
                      {drop.type}
                    </Badge>
                    {drop.assetType && drop.assetType !== "image" && (
                      <Badge className="bg-primary/80 text-[10px] capitalize text-primary-foreground backdrop-blur-sm">
                        {drop.assetType}
                      </Badge>
                    )}
                  </div>
                  {drop.status === "live" && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-card-foreground">{drop.title}</p>
                  <p className="text-xs text-muted-foreground">{drop.artist}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{drop.priceEth} ETH</span>
                    {drop.status === "live" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {drop.endsIn}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DropsPage;
