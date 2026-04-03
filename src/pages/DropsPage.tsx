import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Filter, Loader2, Search, Sparkles, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAnalyticsSnapshot, recordDropView, recordPageVisit } from "@/lib/analyticsStore";
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
  const [query, setQuery] = useState("");
  const [isSearchPending, startSearchTransition] = useTransition();
  const [recommendedOffset, setRecommendedOffset] = useState(0);
  const [featuredCarouselIndex, setFeaturedCarouselIndex] = useState(0);
  const [adminFeaturedSlides, setAdminFeaturedSlides] = useState<FeaturedCreatorSlide[]>([]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const { data: supabaseDrops, loading, error } = useSupabaseLiveDrops();
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

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
        sold: Number(drop.sold || 0),
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

  const dropViewCounts = useMemo(() => getAnalyticsSnapshot().dropViews, [allDrops]);
  const curatedDrops = useMemo(() => {
    return [...allDrops].sort((left, right) => {
      const leftScore = left.sold * 12 + (dropViewCounts[left.id] ?? 0) * 3;
      const rightScore = right.sold * 12 + (dropViewCounts[right.id] ?? 0) * 3;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return Number(right.priceEth || 0) - Number(left.priceEth || 0);
    });
  }, [allDrops, dropViewCounts]);

  const filtered = useMemo(() => {
    const byType = active === "all" ? curatedDrops : curatedDrops.filter((drop) => drop.type === active);

    if (!deferredQuery) {
      return byType;
    }

    return byType.filter((drop) =>
      [drop.title, drop.artist, drop.type, drop.assetType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(deferredQuery))
    );
  }, [active, curatedDrops, deferredQuery]);
  const rotatedCuratedDrops = useMemo(() => {
    if (curatedDrops.length === 0) {
      return [];
    }

    const safeOffset = recommendedOffset % curatedDrops.length;
    return [...curatedDrops.slice(safeOffset), ...curatedDrops.slice(0, safeOffset)];
  }, [curatedDrops, recommendedOffset]);
  const featuredDesktopDrop = curatedDrops[0] ?? null;
  const activeFeaturedSlide =
    adminFeaturedSlides.length > 0
      ? adminFeaturedSlides[featuredCarouselIndex % adminFeaturedSlides.length]
      : null;
  const hasDiscoveryFilters = active !== "all" || Boolean(query.trim());
  const mobileSourceDrops = hasDiscoveryFilters ? filtered : rotatedCuratedDrops;
  const mobileHeroDrop = mobileSourceDrops[0] ?? null;
  const mobileCollectionDrops = useMemo(
    () => mobileSourceDrops.filter((drop) => drop.id !== mobileHeroDrop?.id),
    [mobileHeroDrop?.id, mobileSourceDrops]
  );
  const mobileSectionTitle = deferredQuery
    ? "Search results"
    : active === "all"
    ? "Recommended for you"
    : `${filters.find((filter) => filter.value === active)?.label ?? "All"} picks`;
  const mobileCountCopy = loading && allDrops.length === 0
    ? "Loading live collections..."
    : error
    ? "Unable to load collections right now."
    : !hasDiscoveryFilters
    ? `${mobileSourceDrops.length} curated collections ranked by collector demand.`
    : `${mobileSourceDrops.length} ${mobileSourceDrops.length === 1 ? "collection" : "collections"} available${active !== "all" ? ` in ${active}` : ""}.`;

  useEffect(() => {
    recordPageVisit();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopViewport) {
      setAdminFeaturedSlides([]);
      setFeaturedCarouselIndex(0);
      return;
    }

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
  }, [isDesktopViewport]);

  return (
    <div>
      <div className="hidden md:block px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0f172a_0%,#172554_100%)] dark:shadow-[0_34px_90px_rgba(15,23,42,0.4)]">
          <div className="rounded-[1.8rem] bg-white/92 p-6 dark:bg-slate-950/78">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-8 dark:bg-[linear-gradient(135deg,#172554_0%,#1e3a8a_100%)]">
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
                              recordDropView(featuredDesktopDrop.id);
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
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm dark:bg-slate-950/80 dark:text-white"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFeaturedCarouselIndex((prev) => (prev + 1) % adminFeaturedSlides.length)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm dark:bg-slate-950/80 dark:text-white"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm dark:bg-slate-950/55 lg:col-span-2">
                        <img src={activeFeaturedSlide.primaryImage} alt={activeFeaturedSlide.artistName} className="h-56 w-full rounded-[1.2rem] object-cover" />
                      </div>
                      {activeFeaturedSlide.secondaryImage ? (
                        <div className="overflow-hidden rounded-[1.4rem] bg-white/65 p-2 shadow-sm dark:bg-slate-950/55 lg:col-span-2">
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
                            recordDropView(featuredDesktopDrop.id);
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
                        <div className="overflow-hidden rounded-[1.6rem] bg-white/65 p-3 shadow-sm dark:bg-slate-950/55 lg:col-span-2">
                          {featuredDesktopDrop.image ? (
                            <img src={featuredDesktopDrop.image} alt={featuredDesktopDrop.title} className="h-56 w-full rounded-[1.2rem] object-cover" />
                          ) : (
                            <div className="flex h-56 w-full items-center justify-center rounded-[1.2rem] bg-black/10 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60">
                              {featuredDesktopDrop.assetType}
                            </div>
                          )}
                        </div>
                        {curatedDrops.slice(1, 3).map((drop) => (
                          <Link
                            key={`desktop-drop-hero-${drop.id}`}
                            to={`/drops/${drop.id}`}
                            onClick={() => recordDropView(drop.id)}
                            className="overflow-hidden rounded-[1.4rem] bg-white/65 p-2 shadow-sm transition-transform hover:-translate-y-1 dark:bg-slate-950/55"
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

              {error ? (
                <div className="rounded-[1.8rem] border border-[#fecaca] bg-white/80 p-10 text-center dark:border-red-900/60 dark:bg-slate-950/75">
                  <p className="text-lg font-semibold text-foreground">Unable to load drops</p>
                  <p className="mt-2 text-sm text-red-500">{error.message}</p>
                </div>
              ) : loading && allDrops.length === 0 ? (
                <div className="grid gap-5 lg:grid-cols-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={`desktop-drop-skeleton-${index}`}
                      className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)] ring-1 ring-[#dbe7ff] dark:bg-slate-950/80 dark:ring-white/10"
                    >
                      <div className="aspect-[1.05] animate-pulse bg-[#e5eefc] dark:bg-slate-800" />
                      <div className="space-y-3 p-5">
                        <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#e5eefc] dark:bg-slate-800" />
                        <div className="h-4 w-1/3 animate-pulse rounded-full bg-[#eef4ff] dark:bg-slate-700" />
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-20 animate-pulse rounded-full bg-[#dbeafe] dark:bg-slate-700" />
                          <div className="h-4 w-14 animate-pulse rounded-full bg-[#eef4ff] dark:bg-slate-800" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : allDrops.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 p-10 text-center dark:bg-slate-950/55">
                  <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                  <p className="text-lg font-semibold text-foreground">No drops yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Published drops from approved artists will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  {curatedDrops.map((drop) => (
                    <Link
                      key={drop.id}
                      to={`/drops/${drop.id}`}
                      onClick={() => recordDropView(drop.id)}
                      className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)] ring-1 ring-[#dbe7ff] transition-transform hover:-translate-y-1 dark:bg-slate-950/80 dark:ring-white/10"
                    >
                      <div className="relative aspect-[1.05] overflow-hidden bg-secondary dark:bg-slate-900">
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
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{drop.sold} collected</span>
                            {drop.status === "live" && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> {drop.endsIn}
                              </span>
                            )}
                          </span>
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
        <div className="overflow-hidden rounded-[2.4rem] bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)] px-4 pb-5 pt-5 shadow-[0_24px_60px_rgba(37,99,235,0.18)] ring-1 ring-[#bfdbfe] dark:bg-[linear-gradient(180deg,#0f172a_0%,#172554_100%)] dark:shadow-[0_28px_70px_rgba(15,23,42,0.45)] dark:ring-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[15rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1d4ed8]/72 dark:text-sky-200/72">
                Digital Drops
              </p>
              <h1 className="mt-2 text-[2rem] font-black leading-[1.02] tracking-[-0.04em] text-slate-950 dark:text-white">
                Discover your next digital collection
              </h1>
            </div>

            <button
              type="button"
              onClick={() => {
                if (mobileHeroDrop) {
                  recordDropView(mobileHeroDrop.id);
                  navigate(`/drops/${mobileHeroDrop.id}`);
                }
              }}
              aria-label={mobileHeroDrop ? `Open ${mobileHeroDrop.title}` : "Featured drop"}
              className="mt-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_12px_24px_rgba(37,99,235,0.16)] ring-1 ring-[#bfdbfe] dark:bg-slate-900 dark:ring-white/10"
            >
              {mobileHeroDrop?.artistAvatar ? (
                <img
                  src={mobileHeroDrop.artistAvatar}
                  alt={mobileHeroDrop.artist}
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : mobileHeroDrop?.image ? (
                <img
                  src={mobileHeroDrop.image}
                  alt={mobileHeroDrop.title}
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </button>
          </div>

          <div className="mt-5 rounded-full bg-white/95 px-4 py-3 shadow-[0_12px_26px_rgba(37,99,235,0.14)] ring-1 ring-[#bfdbfe] dark:bg-slate-950/90 dark:ring-white/10">
            <label className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <Search className="h-4 w-4" />
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  startSearchTransition(() => {
                    setQuery(nextQuery);
                  });
                }}
                placeholder="Search drops, artists, auctions..."
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear drop search"
                  className="rounded-full p-1 text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-slate-950 dark:text-white">
              {mobileSectionTitle}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (hasDiscoveryFilters) {
                  setActive("all");
                  setQuery("");
                  setRecommendedOffset(0);
                  return;
                }

                if (rotatedCuratedDrops.length > 1) {
                  setRecommendedOffset((current) => (current + 1) % rotatedCuratedDrops.length);
                }
              }}
              className="rounded-full bg-white/90 p-2 text-[#1d4ed8] shadow-sm ring-1 ring-[#bfdbfe] transition-colors hover:bg-white dark:bg-slate-900/90 dark:text-sky-200 dark:ring-white/10"
              aria-label={
                hasDiscoveryFilters
                  ? "Reset drop filters"
                  : rotatedCuratedDrops.length > 1
                  ? "Show next curated recommendation"
                  : "Browse featured drop"
              }
            >
              {hasDiscoveryFilters ? <X className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          <p className="mt-2 text-sm text-slate-700/70 dark:text-slate-300/70">
            {mobileCountCopy}
            {isSearchPending ? " Updating..." : ""}
          </p>

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
                        ? "border-[#93c5fd] bg-white text-slate-950 shadow-[0_12px_24px_rgba(37,99,235,0.14)] dark:border-sky-400/40 dark:bg-slate-950 dark:text-white"
                        : "border-[#bfdbfe] bg-white/65 text-slate-700 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-200"
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

          {error ? (
            <div className="mt-5 rounded-[1.8rem] border border-[#fecaca] bg-white/80 p-8 text-center dark:border-red-900/60 dark:bg-slate-950/75">
              <p className="text-lg font-semibold text-foreground">Unable to load drops</p>
              <p className="mt-2 text-sm text-red-500">{error.message}</p>
            </div>
          ) : loading && allDrops.length === 0 ? (
            <div className="mt-5 -mr-4 flex gap-4 overflow-x-auto pb-2 pr-4 no-scrollbar">
              {[0, 1].map((index) => (
                <div
                  key={`mobile-drop-skeleton-${index}`}
                  className="min-w-[16.5rem] flex-shrink-0 overflow-hidden rounded-[1.9rem] bg-white/90 shadow-[0_18px_36px_rgba(37,99,235,0.12)] ring-1 ring-[#bfdbfe] dark:bg-slate-950/75 dark:ring-white/10"
                >
                  <div className="aspect-[0.9] animate-pulse bg-[#dbeafe] dark:bg-slate-800" />
                  <div className="space-y-3 p-4">
                    <div className="h-8 w-3/4 animate-pulse rounded-2xl bg-[#dbeafe] dark:bg-slate-800" />
                    <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/80 dark:bg-slate-700" />
                    <div className="flex items-center justify-between pt-1">
                      <div className="h-4 w-24 animate-pulse rounded-full bg-white/80 dark:bg-slate-700" />
                      <div className="h-4 w-12 animate-pulse rounded-full bg-white/70 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : mobileCollectionDrops.length === 0 ? (
            <div className="mt-5 rounded-[1.8rem] border border-dashed border-[#93c5fd] bg-white/80 p-8 text-center dark:border-white/10 dark:bg-slate-950/65">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-lg font-semibold text-foreground">
                {mobileHeroDrop ? "No more drops in this view" : "No drops yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {mobileHeroDrop
                  ? "Try another filter or cycle the recommendations for more collections."
                  : "Published drops from approved artists will appear here."}
              </p>
            </div>
          ) : (
            <div className="mt-5 -mr-4 flex gap-4 overflow-x-auto pb-2 pr-4 no-scrollbar">
              {mobileCollectionDrops.map((drop, index) => (
                <Link
                  key={drop.id}
                  to={`/drops/${drop.id}`}
                  onClick={() => recordDropView(drop.id)}
                  className="group min-w-[16.5rem] flex-shrink-0 animate-fade-in overflow-hidden rounded-[1.9rem] bg-white/92 shadow-[0_18px_36px_rgba(37,99,235,0.12)] ring-1 ring-[#bfdbfe] dark:bg-slate-950/75 dark:ring-white/10"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="relative aspect-[0.9] overflow-hidden bg-[#dbeafe] dark:bg-slate-900">
                    {drop.assetType === "image" && drop.image ? (
                      <img
                        src={drop.image}
                        alt={drop.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={index < 2 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    ) : drop.assetType === "video" && (drop.previewUri || drop.image) ? (
                      <img
                        src={drop.previewUri || drop.image}
                        alt={drop.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={index < 2 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                        {drop.assetType}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.32)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.58)_100%)]" />

                    <div className="absolute left-3 top-3">
                      <div className="rounded-full bg-white/92 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1d4ed8] shadow-sm dark:bg-slate-950/85 dark:text-sky-200">
                        {index === 0 && !hasDiscoveryFilters ? "Top pick" : drop.status === "live" ? "Live now" : drop.type}
                      </div>
                    </div>

                    <div className="absolute right-3 top-3">
                      <div className="rounded-full bg-white/92 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-sm dark:bg-slate-950/85 dark:text-slate-100">
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
                      <div>
                        <p className="text-sm font-semibold text-foreground">{Number(drop.priceEth || 0).toFixed(2)} ETH</p>
                        <p className="mt-1 text-[11px] text-foreground/55">{drop.sold} collected</p>
                      </div>
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
