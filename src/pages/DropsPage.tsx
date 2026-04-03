import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Filter, Loader2, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recordPageVisit } from "@/lib/analyticsStore";
import { useSupabaseLiveDrops } from "@/hooks/useSupabase";
import { type AssetType } from "@/lib/assetTypes";
import { resolveMediaUrl } from "@/lib/pinata";
import {
  getFeaturedCreatorsUpdateEventName,
  loadFeaturedCreatorSlides,
  type FeaturedCreatorSlide,
} from "@/lib/featuredCreators";

const filters = [
  { label: "All", value: "all" },
  { label: "Auction", value: "auction" },
  { label: "Drop", value: "drop" },
  { label: "Campaign", value: "campaign" },
] as const;

const DropsPage = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<(typeof filters)[number]["value"]>("all");
  const [featuredCarouselIndex, setFeaturedCarouselIndex] = useState(0);
  const [adminFeaturedSlides, setAdminFeaturedSlides] = useState<FeaturedCreatorSlide[]>([]);
  const { data: supabaseDrops, loading, error } = useSupabaseLiveDrops();

  const allDrops = useMemo(() => {
    if (!supabaseDrops || supabaseDrops.length === 0) return [];
    return supabaseDrops.map((drop) => {
      const artist = drop.artists && !Array.isArray(drop.artists) ? drop.artists : null;
      return {
        id: drop.id,
        title: drop.title,
        artist: artist?.name || "Unknown Artist",
        artistAvatar: artist?.avatar_url || "",
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
  const featuredDesktopDrop = allDrops[0] ?? null;
  const mobileHeroDrop = filtered[0] ?? allDrops[0] ?? null;
  const mobileCollectionDrops = filtered.length > 0 ? filtered : allDrops;
  const activeFeaturedSlide =
    adminFeaturedSlides.length > 0
      ? adminFeaturedSlides[featuredCarouselIndex % adminFeaturedSlides.length]
      : null;

  useEffect(() => {
    recordPageVisit();
  }, []);

  useEffect(() => {
    const syncFeaturedSlides = () => {
      setAdminFeaturedSlides(loadFeaturedCreatorSlides());
      setFeaturedCarouselIndex(0);
    };

    syncFeaturedSlides();
    const eventName = getFeaturedCreatorsUpdateEventName();
    window.addEventListener(eventName, syncFeaturedSlides);

    return () => {
      window.removeEventListener(eventName, syncFeaturedSlides);
    };
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
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-8">
                {activeFeaturedSlide ? (
                  <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Featured Drop Deck</p>
                      <h1 className="max-w-2xl text-4xl font-black leading-tight text-foreground">
                        {activeFeaturedSlide.title}
                      </h1>
                      <p className="text-lg font-semibold text-foreground/80">{activeFeaturedSlide.artistName}</p>
                      <p className="max-w-xl text-sm leading-7 text-foreground/70">
                        {activeFeaturedSlide.subtitle || "Highlight upcoming drops, live releases, or hand-picked campaigns from admin."}
                      </p>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => {
                            if (activeFeaturedSlide.profilePath) {
                              navigate(activeFeaturedSlide.profilePath);
                            } else if (featuredDesktopDrop) {
                              navigate(`/drops/${featuredDesktopDrop.id}`);
                            }
                          }}
                          className="h-11 rounded-full bg-[#1d4ed8] px-6 text-white hover:bg-[#1e40af]"
                        >
                          Open feature
                        </Button>
                        {adminFeaturedSlides.length > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFeaturedCarouselIndex((prev) => (prev - 1 + adminFeaturedSlides.length) % adminFeaturedSlides.length)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFeaturedCarouselIndex((prev) => (prev + 1) % adminFeaturedSlides.length)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm lg:col-span-2">
                        <img src={activeFeaturedSlide.primaryImage} alt={activeFeaturedSlide.artistName} className="h-56 w-full rounded-[1.2rem] object-cover" />
                      </div>
                      {activeFeaturedSlide.secondaryImage ? (
                        <div className="overflow-hidden rounded-[1.4rem] bg-white/65 p-2 shadow-sm lg:col-span-2">
                          <img
                            src={activeFeaturedSlide.secondaryImage}
                            alt={`${activeFeaturedSlide.artistName} detail`}
                            className="h-28 w-full rounded-[1rem] object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Desktop Drops</p>
                      <h1 className="max-w-2xl text-4xl font-black leading-tight text-foreground">
                        Live drops, auctions, and campaigns in one desktop marketplace
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-foreground/70">
                        Browse active creative releases and feature upcoming drops from the admin carousel.
                      </p>
                      <Button
                        onClick={() => {
                          if (featuredDesktopDrop) {
                            navigate(`/drops/${featuredDesktopDrop.id}`);
                          }
                        }}
                        className="h-11 rounded-full bg-[#1d4ed8] px-6 text-white hover:bg-[#1e40af]"
                      >
                        Explore drops
                      </Button>
                    </div>

                    {featuredDesktopDrop ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm lg:col-span-2">
                          {featuredDesktopDrop.image ? (
                            <img src={featuredDesktopDrop.image} alt={featuredDesktopDrop.title} className="h-56 w-full rounded-[1.2rem] object-cover" />
                          ) : (
                            <div className="flex h-56 w-full items-center justify-center rounded-[1.2rem] bg-black/10 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60">
                              {featuredDesktopDrop.assetType}
                            </div>
                          )}
                        </div>
                        {allDrops.slice(1, 3).map((drop) => (
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
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">All Drops</p>
                  <h2 className="mt-2 text-3xl font-black text-foreground">Fresh releases</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Curated with the admin featured deck and all public drops below.
                </p>
              </div>

              {allDrops.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 p-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                  <p className="text-lg font-semibold text-foreground">No drops yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Published drops from approved artists will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  {allDrops.map((drop) => (
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

      <div className="px-4 pt-4 md:hidden">
        <div className="overflow-hidden rounded-[2.4rem] bg-[linear-gradient(180deg,#f7f3eb_0%,#f2ede3_100%)] px-4 pb-5 pt-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[15rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/45">
                Digital Drops
              </p>
              <h1 className="mt-2 text-[2rem] font-black leading-[1.02] tracking-[-0.04em] text-foreground">
                Discover your next digital collection
              </h1>
            </div>

            <div className="mt-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
              {mobileHeroDrop?.artistAvatar ? (
                <img
                  src={mobileHeroDrop.artistAvatar}
                  alt={mobileHeroDrop.artist}
                  className="h-full w-full object-cover"
                />
              ) : mobileHeroDrop?.image ? (
                <img
                  src={mobileHeroDrop.image}
                  alt={mobileHeroDrop.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </div>
          </div>

          <div className="mt-5 rounded-full bg-white/92 px-4 py-3 shadow-[0_12px_26px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>Start your collection search</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-foreground">
              Recommended for you
            </h2>
            <div className="rounded-full bg-white/80 p-2 text-foreground/70 shadow-sm ring-1 ring-black/5">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {filters.map((filter) => {
              const isActive = active === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActive(filter.value)}
                  className={`rounded-[1.25rem] border px-4 py-4 text-left transition-all ${
                    isActive
                      ? "border-foreground bg-white text-foreground shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                      : "border-black/6 bg-white/55 text-foreground/75"
                  }`}
                >
                  <p className="text-sm font-semibold">{filter.label}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground/45">
                    {filter.value === "all" ? "Curated" : filter.value}
                  </p>
                </button>
              );
            })}
          </div>

          {mobileCollectionDrops.length === 0 ? (
            <div className="mt-5 rounded-[1.8rem] border border-dashed border-black/10 bg-white/70 p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-lg font-semibold text-foreground">No drops yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Published drops from approved artists will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-5 -mr-4 flex gap-4 overflow-x-auto pb-2 pr-4 no-scrollbar">
              {mobileCollectionDrops.map((drop, index) => (
                <Link
                  key={drop.id}
                  to={`/drops/${drop.id}`}
                  className="group min-w-[16.5rem] flex-shrink-0 animate-fade-in overflow-hidden rounded-[1.9rem] bg-[rgba(235,244,240,0.92)] shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-black/5"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="relative aspect-[0.9] overflow-hidden bg-[#dde8e3]">
                    {drop.assetType === "image" && drop.image ? (
                      <img
                        src={drop.image}
                        alt={drop.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : drop.assetType === "video" && (drop.previewUri || drop.image) ? (
                      <img
                        src={drop.previewUri || drop.image}
                        alt={drop.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                        {drop.assetType}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.28)_100%)]" />

                    <div className="absolute left-3 top-3">
                      <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-sm">
                        {drop.status === "live" ? "Live now" : drop.type}
                      </div>
                    </div>

                    <div className="absolute right-3 top-3">
                      <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-sm">
                        {drop.type}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    <p className="line-clamp-2 text-[1.55rem] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
                      {drop.title}
                    </p>
                    <p className="text-sm text-foreground/65">{drop.artist}</p>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm font-semibold text-foreground">From ${Number(drop.priceEth || 0).toFixed(2)} / mint</p>
                      {drop.status === "live" && (
                        <span className="flex items-center gap-1 text-[11px] text-foreground/55">
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
  );
};

export default DropsPage;
