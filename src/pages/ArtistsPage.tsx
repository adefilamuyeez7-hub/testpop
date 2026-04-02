/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, User, Users, Sparkles, Star, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet, useSubscribeToArtistContract, useIsSubscribedToArtistContract } from "@/hooks/useContracts";
import { useResolvedArtistContract } from "@/hooks/useContractIntegrations";
import { recordPageVisit } from "@/lib/analyticsStore";
import { useSupabaseArtists } from "@/hooks/useSupabase";
import { toast } from "sonner";

const ArtistSubscribeButton = ({ artist, isConnected, connectWallet, address }: any) => {
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
      className={`h-11 rounded-full flex-1 font-semibold transition-all ${
        isSubscribed ? "gradient-primary text-primary-foreground" : "gradient-secondary text-secondary-foreground"
      }`}
      disabled={
        isSubscribed ||
        isSubscribedLoading ||
        isSubscribing ||
        isSubscribePending ||
        isSubscribeConfirming
      }
    >
      {isSubscribed ? (
        <><CheckCircle2 className="h-4 w-4 mr-2" /> Subscribed</>
      ) : isSubscribedLoading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking</>
      ) : isSubscribing || isSubscribePending ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subscribing</>
      ) : isSubscribeConfirming ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming</>
      ) : (
        <><Star className="h-4 w-4 mr-2" /> Subscribe</>
      )}
    </Button>
  );
};

const ArtistsPage = () => {
  const { isConnected, connectWallet, address } = useWallet();
  const { data: supabaseArtists, loading, error } = useSupabaseArtists();
  const [artists, setArtists] = useState([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  useEffect(() => {
    recordPageVisit();
  }, []);

  // Update artists from Supabase when data loads
  useEffect(() => {
    if (supabaseArtists && supabaseArtists.length > 0) {
      setArtists(supabaseArtists.map((artist: any) => ({
        id: artist.id,
        wallet: artist.wallet,
        contractAddress: artist.contract_address || null,
        subscriptionPrice: artist.subscription_price,
        name: artist.name || "Untitled Artist",
        avatar: artist.avatar_url || artist.banner_url || "",
        tag: artist.tag || "artist",
        drops: 0, // Will be fetched separately if needed
        bio: artist.bio || "This artist has not added a public bio yet.",
      })));
    }
  }, [supabaseArtists]);

  // Reset current card if it's out of bounds
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

  const visibleArtists = artists.length
    ? Array.from({ length: Math.min(3, artists.length) }).map((_, idx) => artists[(currentCard + idx) % artists.length])
    : [];

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-88px)] px-4">
        <div className="py-3">
          <h1 className="text-xl font-bold">Artists</h1>
          <p className="text-sm text-muted-foreground font-body">Loading from Supabase...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[calc(100vh-88px)] px-4">
        <div className="py-3">
          <h1 className="text-xl font-bold">Artists</h1>
          <p className="text-sm text-muted-foreground font-body">Error loading artists</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_30%),linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] px-4">
      <div className="py-3">
        <h1 className="text-xl font-bold">Artists</h1>
        <p className="text-sm text-muted-foreground font-body">Whitelisted creators building on Base</p>
      </div>

      <div
        className="flex-1 flex flex-col justify-center relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {artists.length === 0 && (
          <div className="w-full rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-lg font-semibold text-foreground">No artists are live yet</p>
            <p className="text-sm text-muted-foreground mt-2">
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
              className="absolute w-full left-0 right-0 mx-auto"
              style={{
                transform: `translateX(${x}px) translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
                zIndex,
                opacity: currentOpacity,
                transition: isSwiping ? "none" : "all 0.5s ease",
              }}
            >
              <div className="rounded-3xl bg-white shadow-elevated overflow-hidden border border-[#dbe7ff]">
                {/* Bigger hero image — was h-48, now h-64 */}
                <div className="relative h-64 overflow-hidden">
                  <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  <Badge className="absolute top-3 right-3 bg-background/80 text-foreground text-[11px] backdrop-blur-sm font-semibold">
                    {artist.tag}
                  </Badge>
                  {/* Floating name over image bottom */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                    <div className="flex items-end gap-3">
                      <div className="h-16 w-16 rounded-2xl overflow-hidden border-3 border-background shadow-lg shrink-0">
                        <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="pb-1">
                        <h2 className="text-xl font-bold text-card-foreground leading-tight">{artist.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{artist.tag}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{artist.bio}</p>

                  <div className="flex items-center gap-3 mt-3 mb-4">
                    <div className="flex-1 text-center p-2 rounded-xl bg-[#eef5ff]">
                      <p className="text-base font-bold text-foreground">{artist.drops}</p>
                      <p className="text-[10px] text-muted-foreground">Drops</p>
                    </div>
                    <div className="flex-1 text-center p-2 rounded-xl bg-[#eef5ff]">
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
                      />
                      <Button variant="outline" className="rounded-full h-11 px-4" asChild>
                        <Link to={`/artists/${artist.id}`}>
                          <User className="h-4 w-4 mr-1.5" /> Profile
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Nav controls */}
        {artists.length > 0 && <div className="absolute left-0 right-0 bottom-0 pb-2 flex items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
          <button onClick={prevCard} className="h-10 w-10 rounded-full bg-[#dbeafe] flex items-center justify-center">
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
          <button onClick={nextCard} className="h-10 w-10 rounded-full bg-[#dbeafe] flex items-center justify-center">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>}
      </div>
    </div>
  );
};

export default ArtistsPage;
