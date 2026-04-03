/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Loader2,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet, useSubscribeToArtistContract, useIsSubscribedToArtistContract } from "@/hooks/useContracts";
import { useResolvedArtistContract } from "@/hooks/useContractIntegrations";
import { recordPageVisit } from "@/lib/analyticsStore";
import { useSupabaseArtists } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { toast } from "sonner";

type ShowcaseArtist = {
  id: string;
  wallet?: string | null;
  contractAddress?: string | null;
  subscriptionPrice?: string | number | null;
  name: string;
  avatar: string;
  banner: string;
  tag: string;
  handle?: string | null;
  bio: string;
};

const artistFallbackArt =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop stop-color='%231d4ed8'/><stop offset='1' stop-color='%230f172a'/></linearGradient></defs><rect width='640' height='640' rx='36' fill='url(%23g)'/><circle cx='168' cy='162' r='74' fill='%23ffffff' opacity='.16'/><circle cx='504' cy='126' r='92' fill='%2338bdf8' opacity='.18'/><path d='M128 468c70-98 144-148 214-148 86 0 154 54 198 148' fill='%23ffffff' opacity='.15'/></svg>";

const truncateIdentity = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("@")) return value;
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const ArtistSubscribeButton = ({
  artist,
  isConnected,
  connectWallet,
  address,
  className = "",
}: {
  artist: ShowcaseArtist;
  isConnected: boolean;
  connectWallet: () => Promise<unknown>;
  address?: string | null;
  className?: string;
}) => {
  const effectiveContractAddress = useResolvedArtistContract(artist?.wallet, artist?.contractAddress);
  const {
    subscribe,
    isPending: isSubscribePending,
    isConfirming: isSubscribeConfirming,
    isSuccess: isSubscribeSuccess,
  } = useSubscribeToArtistContract(effectiveContractAddress);
  const { isSubscribed, isLoading: isSubscribedLoading, refetch: refetchSubscriptionStatus } =
    useIsSubscribedToArtistContract(effectiveContractAddress, address ?? null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!isSubscribeSuccess) {
      return;
    }

    toast.success("Subscribed successfully!");
    const timer = window.setTimeout(() => {
      refetchSubscriptionStatus();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isSubscribeSuccess, refetchSubscriptionStatus]);

  const handleSubscribe = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!effectiveContractAddress) {
      toast.error("Artist contract not available yet. Please try again later.");
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribe(String(artist.subscriptionPrice ?? "0.01"));
    } catch (error) {
      console.error("Subscribe error:", error);
      toast.error(error instanceof Error ? error.message : "Subscription failed");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      className={`h-11 rounded-full font-semibold transition-all ${className}`}
      disabled={
        isSubscribed ||
        isSubscribedLoading ||
        isSubscribing ||
        isSubscribePending ||
        isSubscribeConfirming
      }
    >
      {isSubscribed ? (
        <><CheckCircle2 className="mr-2 h-4 w-4" /> Subscribed</>
      ) : isSubscribedLoading ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking</>
      ) : isSubscribing || isSubscribePending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subscribing</>
      ) : isSubscribeConfirming ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming</>
      ) : (
        <><Star className="mr-2 h-4 w-4" /> Subscribe</>
      )}
    </Button>
  );
};

const ArtistsPage = () => {
  const { isConnected, connectWallet, address } = useWallet();
  const { data: supabaseArtists, loading, error } = useSupabaseArtists();
  const [currentCard, setCurrentCard] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [savedArtistIds, setSavedArtistIds] = useState<Record<string, boolean>>({});
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  useEffect(() => {
    recordPageVisit();
  }, []);

  const artists = useMemo<ShowcaseArtist[]>(
    () =>
      (supabaseArtists || [])
        .map((artist: any) => {
          const avatar = resolveMediaUrl(artist.avatar_url, artist.banner_url) || artistFallbackArt;
          const banner = resolveMediaUrl(artist.banner_url, artist.avatar_url) || avatar;
          return {
            id: artist.id,
            wallet: artist.wallet,
            contractAddress: artist.contract_address || null,
            subscriptionPrice: artist.subscription_price,
            name: artist.name || "Untitled Artist",
            avatar,
            banner,
            tag: artist.tag || "artist",
            handle: artist.handle || null,
            bio: artist.bio || "This artist has not added a public bio yet.",
          };
        })
        .filter((artist) => Boolean(artist.id)),
    [supabaseArtists]
  );

  useEffect(() => {
    if (currentCard >= artists.length && artists.length > 0) {
      setCurrentCard(0);
    }
  }, [artists.length, currentCard]);

  const nextCard = useCallback(() => {
    if (!artists.length) return;
    setCurrentCard((prev) => (prev + 1) % artists.length);
  }, [artists.length]);

  const prevCard = useCallback(() => {
    if (!artists.length) return;
    setCurrentCard((prev) => (prev - 1 + artists.length) % artists.length);
  }, [artists.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (isHorizontalSwipe.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalSwipe.current) {
      const threshold = 60;
      if (swipeOffset < -threshold) nextCard();
      if (swipeOffset > threshold) prevCard();
    }
    setSwipeOffset(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
  };

  const visibleArtists = useMemo(
    () =>
      artists.length
        ? Array.from({ length: Math.min(3, artists.length) }).map((_, idx) => artists[(currentCard + idx) % artists.length])
        : [],
    [artists, currentCard]
  );

  const featuredArtist = visibleArtists[0] ?? null;
  const stackedArtists = visibleArtists.slice(1);
  const discoveryArtists = useMemo(
    () =>
      artists.length <= 1
        ? []
        : Array.from({ length: Math.min(4, artists.length - 1) }).map((_, idx) => artists[(currentCard + idx + 1) % artists.length]),
    [artists, currentCard]
  );
  const creatorDeckCountLabel = artists.length === 1 ? "1 creator live" : `${artists.length} creators live`;

  const featuredIdentity = featuredArtist?.handle
    ? `@${featuredArtist.handle}`
    : truncateIdentity(featuredArtist?.wallet);

  const toggleSavedArtist = (artistId: string) => {
    setSavedArtistIds((current) => {
      const next = !current[artistId];
      toast.success(next ? "Artist saved to your shortlist." : "Removed from your shortlist.");
      return {
        ...current,
        [artistId]: next,
      };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-88px)] flex-col px-4">
        <div className="py-3">
          <h1 className="text-xl font-bold">Artists</h1>
          <p className="font-body text-sm text-muted-foreground">Loading from Supabase...</p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-88px)] flex-col px-4">
        <div className="py-3">
          <h1 className="text-xl font-bold">Artists</h1>
          <p className="font-body text-sm text-muted-foreground">Error loading artists</p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-500">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_26%),linear-gradient(180deg,#fbf7ef_0%,#f5efe3_34%,#e8eef9_100%)] md:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_30%),linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-4 md:px-0 md:py-0">
        <div className="md:hidden">
          <div className="space-y-4 pb-6">
            <div className="flex items-start justify-between gap-3 px-1 pt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Artists</p>
                <h1 className="mt-2 text-[1.9rem] font-black leading-none tracking-[-0.05em] text-slate-900">
                  Pick your next future icon.
                </h1>
                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">
                  Follow creators early, unlock drops, and track the artists building culture on Base.
                </p>
              </div>
              <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
                {creatorDeckCountLabel}
              </div>
            </div>

            {artists.length === 0 ? (
              <div className="rounded-[2rem] border border-white/80 bg-white/88 p-8 text-center text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">No artists are live yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Approved artists will appear here once they save a public profile from the studio.
                </p>
              </div>
            ) : featuredArtist ? (
              <>
                <div
                  className="relative pt-6"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {stackedArtists.map((artist, index) => (
                    <div
                      key={`stack-${artist.id}`}
                      className="pointer-events-none absolute inset-x-0 rounded-[2.15rem] border border-white/12 bg-[linear-gradient(180deg,rgba(88,79,68,0.55)_0%,rgba(34,31,29,0.86)_100%)] shadow-[0_20px_44px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                      style={{
                        top: `${(index + 1) * 16}px`,
                        left: `${(index + 1) * 14}px`,
                        right: `${(index + 1) * 14}px`,
                        height: index === 0 ? "min(29rem, 68vh)" : "min(26rem, 60vh)",
                        opacity: 0.82 - index * 0.18,
                      }}
                    >
                      <div className="flex h-full items-start justify-between p-4 text-white/55">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.26em]">{index === 0 ? "Up Next" : "On Deck"}</p>
                          <p className="mt-3 text-lg font-semibold text-white/72">{artist.name}</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]">
                          {artist.tag}
                        </div>
                      </div>
                    </div>
                  ))}

                  <article
                    className={`relative overflow-hidden rounded-[2.35rem] border border-white/12 bg-[linear-gradient(180deg,#171717_0%,#0e0e11_100%)] p-3 text-white shadow-[0_34px_90px_rgba(15,23,42,0.42)] ${isSwiping ? "" : "transition-transform duration-500 ease-out"}`}
                    style={{
                      transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.03}deg)`,
                    }}
                  >
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-white/70">
                        <Sparkles className="h-3 w-3 text-[#f6c453]" />
                        Featured Artist
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSavedArtist(featuredArtist.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80"
                        aria-label={savedArtistIds[featuredArtist.id] ? "Remove artist from shortlist" : "Save artist to shortlist"}
                      >
                        <Heart className={`h-4 w-4 ${savedArtistIds[featuredArtist.id] ? "fill-[#ff7a8b] text-[#ff7a8b]" : ""}`} />
                      </button>
                    </div>

                    <div className="relative overflow-hidden rounded-[1.85rem]">
                      <img src={featuredArtist.banner} alt={featuredArtist.name} className="h-[min(22rem,52vh)] w-full object-cover" />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.16)_0%,rgba(5,5,5,0.22)_45%,rgba(5,5,5,0.86)_100%)]" />
                      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/22 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/75 backdrop-blur-sm">
                          <div className="h-6 w-6 overflow-hidden rounded-full border border-white/10">
                            <img src={featuredArtist.avatar} alt={featuredArtist.name} className="h-full w-full object-cover" />
                          </div>
                          {featuredArtist.tag}
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-sm">
                          Base
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="rounded-[1.6rem] border border-white/10 bg-black/28 p-4 backdrop-blur-md">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-white/58">
                            {featuredIdentity || "Creator spotlight"}
                          </p>
                          <h2 className="mt-2 text-[clamp(1.75rem,8vw,2rem)] font-black leading-[0.92] tracking-[-0.05em]">
                            {featuredArtist.name}
                          </h2>
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/72">
                            {featuredArtist.bio}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_44px] gap-2">
                      <ArtistSubscribeButton
                        artist={featuredArtist}
                        isConnected={isConnected}
                        connectWallet={connectWallet}
                        address={address}
                        className="bg-[linear-gradient(135deg,#ffffff_0%,#f2f2f2_100%)] text-[#111111] shadow-[0_12px_24px_rgba(255,255,255,0.16)] hover:opacity-95"
                      />
                      <Button
                        variant="outline"
                        asChild
                        className="h-11 rounded-full border-white/12 bg-white/8 px-4 text-sm font-semibold text-white hover:bg-white/12"
                      >
                        <Link to={`/artists/${featuredArtist.id}`}>
                          <User className="mr-1.5 h-4 w-4" /> Profile
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        asChild
                        className="h-11 w-11 rounded-full border-white/12 bg-white/8 p-0 text-white hover:bg-white/12"
                      >
                        <Link to={`/artists/${featuredArtist.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3">
                        <p className="text-lg font-black">{artists.length}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/54">Creators</p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3">
                        <p className="text-sm font-semibold capitalize">{featuredArtist.tag}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/54">Discipline</p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3">
                        <p className="text-sm font-semibold">Base</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/54">Network</p>
                      </div>
                    </div>
                  </article>
                </div>

                {artists.length > 1 && (
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={prevCard} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                    <div className="flex gap-1.5">
                      {artists.map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setCurrentCard(index)}
                          className={`h-2 rounded-full transition-all duration-300 ${index === currentCard ? "w-8 bg-slate-900" : "w-2 bg-slate-300"}`}
                        />
                      ))}
                    </div>
                    <button onClick={nextCard} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm">
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <section className="rounded-[2rem] border border-white/80 bg-white/88 p-4 text-slate-900 shadow-[0_20px_54px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Artist Queue</p>
                      <h3 className="mt-2 text-xl font-bold">You might want next</h3>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {discoveryArtists.length} live
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {discoveryArtists.map((artist) => (
                      <Link
                        key={`discover-${artist.id}`}
                        to={`/artists/${artist.id}`}
                        className="flex items-center gap-3 rounded-[1.45rem] border border-slate-200/80 bg-[#f8fafc] p-3 transition-transform active:scale-[0.99]"
                      >
                        <div className="h-16 w-16 overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white">
                          <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{artist.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {artist.handle ? `@${artist.handle}` : artist.tag}
                          </p>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{artist.bio}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {artists.map((artist, index) => (
                      <button
                        key={`chip-${artist.id}`}
                        type="button"
                        onClick={() => setCurrentCard(index)}
                        className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                          index === currentCard
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {artist.name}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden min-h-[calc(100vh-88px)] flex-col bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_30%),linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] px-4 md:flex">
          <div className="py-3">
            <h1 className="text-xl font-bold">Artists</h1>
            <p className="font-body text-sm text-muted-foreground">Whitelisted creators building on Base</p>
          </div>

          <div
            className="relative flex flex-1 flex-col justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {artists.length === 0 && (
              <div className="w-full rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="text-lg font-semibold text-foreground">No artists are live yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Approved artists will appear here once they save a profile from the studio.
                </p>
              </div>
            )}

            {visibleArtists.map((artist, i) => {
              const isTop = i === 0;
              const scale = 1 - i * 0.04;
              const translateY = i * 16;
              const zIndex = 3 - i;
              const opacity = 1 - i * 0.12;
              const x = isTop ? swipeOffset : 0;
              const rotate = isTop ? swipeOffset * 0.025 : 0;
              const currentOpacity = isTop ? Math.max(0.5, 1 - Math.abs(swipeOffset) / 300) : opacity;

              return (
                <div
                  key={artist.id}
                  className="absolute left-0 right-0 mx-auto w-full"
                  style={{
                    transform: `translateX(${x}px) translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
                    zIndex,
                    opacity: currentOpacity,
                    transition: isSwiping ? "none" : "all 0.5s ease",
                  }}
                >
                  <div className="overflow-hidden rounded-3xl border border-[#dbe7ff] bg-white shadow-elevated">
                    <div className="relative h-64 overflow-hidden">
                      <img src={artist.banner} alt={artist.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                      <Badge className="absolute right-3 top-3 bg-background/80 text-[11px] font-semibold text-foreground backdrop-blur-sm">
                        {artist.tag}
                      </Badge>
                      <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                        <div className="flex items-end gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-3 border-background shadow-lg">
                            <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="pb-1">
                            <h2 className="text-xl font-bold leading-tight text-card-foreground">{artist.name}</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">{artist.tag}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{artist.bio}</p>

                      <div className="mb-4 mt-3 flex items-center gap-3">
                        <div className="flex-1 rounded-xl bg-[#eef5ff] p-2 text-center">
                          <p className="text-base font-bold text-foreground">{artists.length}</p>
                          <p className="text-[10px] text-muted-foreground">Artists</p>
                        </div>
                        <div className="flex-1 rounded-xl bg-[#eef5ff] p-2 text-center">
                          <p className="text-base font-bold text-foreground">Base</p>
                          <p className="text-[10px] text-muted-foreground">Chain</p>
                        </div>
                      </div>

                      {isTop && (
                        <div className="flex gap-2">
                          <ArtistSubscribeButton
                            artist={artist}
                            isConnected={isConnected}
                            connectWallet={connectWallet}
                            address={address}
                            className="gradient-secondary flex-1 text-secondary-foreground"
                          />
                          <Button variant="outline" className="h-11 rounded-full px-4" asChild>
                            <Link to={`/artists/${artist.id}`}>
                              <User className="mr-1.5 h-4 w-4" /> Profile
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {artists.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 bg-background/80 pb-2 backdrop-blur-sm">
                <button onClick={prevCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe]">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </button>
                <div className="flex gap-1.5">
                  {artists.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentCard(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${index === currentCard ? "w-7 bg-[#1d4ed8]" : "w-2 bg-[#bfd5ff]"}`}
                    />
                  ))}
                </div>
                <button onClick={nextCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe]">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistsPage;
