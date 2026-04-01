import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Heart, User, Loader2, Sparkles, ShoppingCart, Gavel, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet, useSubscribeToArtistContract, useIsSubscribedToArtistContract } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import { usePlaceBid } from "@/hooks/useContracts";
import { useResolvedArtistContract } from "@/hooks/useContractIntegrations";
import { recordPageVisit, recordDropView } from "@/lib/analyticsStore";
import { useSupabaseArtists, useSupabaseLiveDrops } from "@/hooks/useSupabase";
import { useToast } from "@/hooks/use-toast";
import { parseEther } from "viem";
import { useCollectionStore } from "@/stores/collectionStore";

const SubscribeButtonWrapper = ({ artist, isConnected, connectWallet, address, toast }: any) => {
  const effectiveContractAddress = useResolvedArtistContract(artist?.wallet, artist?.contractAddress);
  const { subscribe, isPending: isSubscribePending, isConfirming: isSubscribeConfirming, isSuccess: isSubscribeSuccess } = useSubscribeToArtistContract(effectiveContractAddress);
  const { isSubscribed, isLoading: isSubscribedLoading, refetch: refetchSubscriptionStatus } =
    useIsSubscribedToArtistContract(effectiveContractAddress, address ?? null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!isSubscribeSuccess) {
      return;
    }

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
      toast({
        title: "Error",
        description: "Artist contract not deployed yet. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    const subscriptionPrice = String(artist.subscriptionPrice ?? "0.01");

    setIsSubscribing(true);
    try {
      console.log("🎨 Subscribing to artist contract:", effectiveContractAddress);
      const txHash = await subscribe(subscriptionPrice);
      setIsSubscribing(false);
      
      if (txHash) {
        toast({
          title: "Success",
          description: "Subscription confirmed! Artist gets 70%, team gets 30%.",
        });
        console.log("✅ Subscription submitted:", txHash);
      }
    } catch (err: any) {
      setIsSubscribing(false);
      const message = err?.message || "Subscription failed";
      console.error("❌ Subscription error:", message);
      
      // Better error messaging
      let displayMsg = message;
      if (message.includes("network fee") || message.includes("gas estimation")) {
        displayMsg = "Network fee unavailable. Try:\n1. Switch to Base Sepolia in MetaMask\n2. Refresh the page\n3. Try again soon";
      } else if (message.includes("Invalid artist address")) {
        displayMsg = "Invalid artist wallet address";
      } else if (message.includes("denied")) {
        displayMsg = "Transaction cancelled in wallet";
      } else if (message.includes("insufficient funds")) {
        displayMsg = "Insufficient balance for subscription + gas";
      }
      
      toast({
        title: "Error",
        description: displayMsg,
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      size="default"
      onClick={handleSubscribe}
      disabled={isSubscribing || isSubscribePending || isSubscribeConfirming || isSubscribed || isSubscribedLoading}
      className="flex-1 rounded-full gradient-primary text-primary-foreground font-bold text-sm h-11"
    >
      {isSubscribed ? (
        "Subscribed ✓"
      ) : isSubscribedLoading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
      ) : isSubscribing || isSubscribePending ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subscribing...</>
      ) : isSubscribeConfirming ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming...</>
      ) : (
        <><Heart className="h-4 w-4 mr-1.5" /> Subscribe</>
      )}
    </Button>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { isConnected, connectWallet, address } = useWallet();
  const { data: supabaseArtists, loading, error } = useSupabaseArtists();
  const { data: supabaseLiveDrops, loading: dropsLoading, error: dropsError, refetch: refetchDrops } = useSupabaseLiveDrops();
  const { placeBid, isPending: isBidding, error: bidError } = usePlaceBid();
  const { toast } = useToast();
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [liveDrops, setLiveDrops] = useState([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [currentDropCard, setCurrentDropCard] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [dropSwipeOffset, setDropSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDropSwiping, setIsDropSwiping] = useState(false);
  const [mintingDropId, setMintingDropId] = useState<string | null>(null);
  const [collectingDrop, setCollectingDrop] = useState<any | null>(null);
  const [flippingDropId, setFlippingDropId] = useState<string | null>(null);
  const [biddingDropId, setBiddingDropId] = useState<string | null>(null);
  
  // Mint state for per-artist contracts
  const { mint: mintArtist, mintedTokenId: mintedArtistTokenId, isPending: isMintingArtist, error: mintErrorArtist, isSuccess: isMintSuccessArtist } = useMintArtist();
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const dropTouchStartX = useRef(0);
  const dropTouchStartY = useRef(0);
  const isDropHorizontalSwipe = useRef<boolean | null>(null);

  useEffect(() => {
    recordPageVisit();
  }, []);

  // Update featured artists from Supabase when data loads
  useEffect(() => {
    if (supabaseArtists && supabaseArtists.length > 0) {
      setFeaturedArtists(supabaseArtists.map((artist: any) => ({
        id: artist.id,
        wallet: artist.wallet,
        contractAddress: artist.contract_address || null,
        subscriptionPrice: artist.subscription_price,
        name: artist.name || "Untitled Artist",
        avatar: artist.avatar_url || artist.banner_url || "",
        tag: artist.tag || "artist",
        bio: artist.bio || "This artist has not published a public bio yet.",
        cover: artist.banner_url || artist.avatar_url || "",
      })));
    }
  }, [supabaseArtists]);

  // Update live drops from Supabase when data loads
  useEffect(() => {
    if (supabaseLiveDrops && supabaseLiveDrops.length > 0) {
      setLiveDrops(supabaseLiveDrops.map((drop) => {
        const artist = drop.artists && !Array.isArray(drop.artists) ? drop.artists : null;
        const normalizedType = (drop.type || "drop").toLowerCase() as "drop" | "auction" | "campaign";
        // Campaign drops are app-driven right now, so they do not require onchain contract IDs.
        if (
          normalizedType !== "campaign" &&
          (
            drop.contract_drop_id === null ||
            drop.contract_drop_id === undefined ||
            !drop.contract_address
          )
        ) {
          console.warn(`⚠️ Drop "${drop.title}" missing contract_address or contract_drop_id - skipping`);
          return null;
        }
        return {
          id: drop.id,
          contractAddress: drop.contract_address,
          contractDropId: drop.contract_drop_id, // The actual on-chain drop ID (number)
          title: drop.title,
          artist: artist?.name || "Unknown Artist",
          priceEth: drop.price_eth ? parseFloat(drop.price_eth).toFixed(3) : "0",
          image: drop.image_url || "",
          previewUri: drop.preview_uri || "",
          deliveryUri: drop.delivery_uri || "",
          assetType: drop.asset_type || "image",
          type: normalizedType,
          status: drop.status as "live" | "draft" | "ended",
          endsIn: drop.ends_at ? `${Math.max(0, Math.floor((new Date(drop.ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h` : "--",
        };
      }).filter((drop): drop is NonNullable<typeof drop> => drop !== null));
    }
  }, [supabaseLiveDrops]);

  const nextCard = useCallback(() => {
    if (!featuredArtists.length) return;
    setCurrentCard((prev) => (prev + 1) % featuredArtists.length);
  }, [featuredArtists.length]);

  const prevCard = useCallback(() => {
    if (!featuredArtists.length) return;
    setCurrentCard((prev) => (prev - 1 + featuredArtists.length) % featuredArtists.length);
  }, [featuredArtists.length]);

  const nextDropCard = useCallback(() => {
    if (!liveDrops.length) return;
    setCurrentDropCard((prev) => (prev + 1) % Math.max(1, liveDrops.length - 1));
  }, [liveDrops.length]);

  const prevDropCard = useCallback(() => {
    if (!liveDrops.length) return;
    setCurrentDropCard((prev) => (prev - 1 + Math.max(1, liveDrops.length - 1)) % Math.max(1, liveDrops.length - 1));
  }, [liveDrops.length]);


  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Determine swipe direction on first significant move
    if (isHorizontalSwipe.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }

    if (isHorizontalSwipe.current) {
      setSwipeOffset(deltaX);
    }
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (isHorizontalSwipe.current) {
      const threshold = 60;
      if (swipeOffset < -threshold) {
        nextCard();
      } else if (swipeOffset > threshold) {
        prevCard();
      }
    }
    setSwipeOffset(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
  }, [swipeOffset, nextCard, prevCard]);

  // Drops carousel touch handlers (2-card per view)
  const handleDropTouchStart = useCallback((e: React.TouchEvent) => {
    dropTouchStartX.current = e.touches[0].clientX;
    dropTouchStartY.current = e.touches[0].clientY;
    isDropHorizontalSwipe.current = null;
    setIsDropSwiping(true);
  }, []);

  const handleDropTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDropSwiping) return;
    const deltaX = e.touches[0].clientX - dropTouchStartX.current;
    const deltaY = e.touches[0].clientY - dropTouchStartY.current;

    if (isDropHorizontalSwipe.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isDropHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }

    if (isDropHorizontalSwipe.current) {
      setDropSwipeOffset(deltaX);
    }
  }, [isDropSwiping]);

  const handleDropTouchEnd = useCallback(() => {
    if (isDropHorizontalSwipe.current) {
      const threshold = 60;
      if (dropSwipeOffset < -threshold) {
        nextDropCard();
      } else if (dropSwipeOffset > threshold) {
        prevDropCard();
      }
    }
    setDropSwipeOffset(0);
    setIsDropSwiping(false);
    isDropHorizontalSwipe.current = null;
  }, [dropSwipeOffset, nextDropCard, prevDropCard]);

  // Handle collecting a drop
  const handleCollectDrop = async (drop: any) => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    try {
      // Validate drop has required contract fields
      if (
        drop.contractDropId === null ||
        drop.contractDropId === undefined ||
        !drop.contractAddress
      ) {
        throw new Error("This drop is not properly deployed on-chain yet");
      }
      
      // Reset any previous state before starting new mint attempt
      setMintingDropId(drop.id);
      setCollectingDrop(drop);
      recordDropView(drop.id);
      const priceWei = parseEther(drop.priceEth);
      
      console.log(`🛒 Minting contract drop #${drop.contractDropId} on ${drop.contractAddress} for ${drop.priceEth} ETH (${priceWei} wei)...`, {
        contractAddress: drop.contractAddress,
        contractDropId: drop.contractDropId,
        databaseId: drop.id,
        priceWei: priceWei.toString(),
      });
      
      mintArtist(drop.contractDropId, priceWei, drop.contractAddress);
      toast({
        title: "Collect Submitted",
        description: `Collecting "${drop.title}" for ${drop.priceEth} ETH...`,
      });
    } catch (err) {
      console.error("❌ Mint error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to collect drop",
        variant: "destructive",
      });
      setMintingDropId(null);
      setCollectingDrop(null);
      setFlippingDropId(null);
      setCollectingDrop(null);
    }
  };

  // Listen for mint errors and clear state
  useEffect(() => {
    if (mintErrorArtist && mintingDropId) {
      console.error("❌ Transaction error:", mintErrorArtist);
      const errMsg = mintErrorArtist.message || "Transaction was rejected";
      
      // Better error messaging
      let displayMsg = errMsg;
      if (errMsg.includes("insufficient funds")) {
        displayMsg = "Insufficient balance for mint + gas fees";
      } else if (errMsg.includes("network fee") || errMsg.includes("gas")) {
        displayMsg = "Network congested. Try refreshing and trying again.";
      } else if (errMsg.includes("denied")) {
        displayMsg = "Transaction cancelled in your wallet";
      }
      
      toast({
        title: "Transaction Failed",
        description: displayMsg,
        variant: "destructive",
      });
      setMintingDropId(null);
    }
  }, [mintErrorArtist, mintingDropId, toast]);

  // Refetch drops after successful mint
  useEffect(() => {
    if (isMintSuccessArtist && mintingDropId && collectingDrop && address) {
      console.log("✅ Mint succeeded! Refetching drops...");
      const collectedItem = {
        id: collectingDrop.id,
        ownerWallet: address,
        title: collectingDrop.title,
        artist: collectingDrop.artist,
        imageUrl: collectingDrop.image,
        previewUri: collectingDrop.previewUri,
        deliveryUri: collectingDrop.deliveryUri,
        assetType: collectingDrop.assetType,
        mintedTokenId: mintedArtistTokenId,
        contractAddress: collectingDrop.contractAddress,
        contractDropId: collectingDrop.contractDropId,
        collectedAt: new Date().toISOString(),
      };
      addCollectedDrop(collectedItem);
      setFlippingDropId(collectingDrop.id);
      toast({
        title: "Collected",
        description: "This piece has been added to your collection.",
      });
      
      // Refetch to show updated inventory
      refetchDrops()?.catch(err => {
        console.warn("Failed to refetch drops:", err);
        // Don't show error to user - they already have success message
      });
      
      window.setTimeout(() => {
        navigate("/collection", {
          state: {
            highlightDropId: collectingDrop.id,
            fromDeckCollect: true,
            collectedItem,
          },
        });
        setMintingDropId(null);
        setCollectingDrop(null);
        setFlippingDropId(null);
      }, 700);
    }
  }, [addCollectedDrop, address, collectingDrop, isMintSuccessArtist, mintedArtistTokenId, mintingDropId, navigate, toast, refetchDrops]);

  // Listen for bid errors and clear state
  useEffect(() => {
    if (bidError && biddingDropId) {
      console.error("❌ Bid transaction error:", bidError);
      toast({
        title: "Bid Failed",
        description: bidError.message || "Bid transaction was rejected",
        variant: "destructive",
      });
      setBiddingDropId(null);
    }
  }, [bidError, biddingDropId, toast]);

  // Handle bidding on a drop
  const handleBidOnDrop = async (drop: any) => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    try {
      setBiddingDropId(drop.id);
      recordDropView(drop.id);
      console.log(`🏷️ Bidding on campaign ${drop.id} for ${drop.priceEth} ETH on Base mainnet...`);
      placeBid(parseInt(drop.id), drop.priceEth);
      toast({
        title: "Bid Submitted",
        description: `Bidding ${drop.priceEth} ETH on "${drop.title}"...`,
      });
    } catch (err) {
      console.error("❌ Bid error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to place bid",
        variant: "destructive",
      });
      setBiddingDropId(null);
    }
  };

  // Show 2 cards per view for drops
  const getVisibleDropCards = () => {
    if (!liveDrops.length) return [];
    const cards = [];
    for (let i = 0; i < 2; i++) {
      const index = (currentDropCard + i) % liveDrops.length;
      cards.push({ ...liveDrops[index], stackIndex: i });
    }
    return cards;
  };

  // Show 3 cards in the deck (current, next, next+1)
  const getVisibleCards = () => {
    if (!featuredArtists.length) return [];
    const cards = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentCard + i) % featuredArtists.length;
      cards.push({ ...featuredArtists[index], stackIndex: i });
    }
    return cards;
  };

  const visibleCards = getVisibleCards();
  const visibleDropCards = getVisibleDropCards();

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] px-4 overflow-y-auto">  {/* topbar+bottomnav approx 88px */}
      {/* Hero */}
      <section className="py-4">
        <h1 className="text-3xl font-bold text-foreground">Collect. Support. Own.</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Art drops, POAP campaigns & IP investment — all on-chain.
        </p>
      </section>

      {/* Live Drops — 2-card carousel */}
      {!dropsLoading && !dropsError && liveDrops.length > 0 && (
        <section className="py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Live Drops</h2>
            <Link to="/drops" className="text-xs text-primary font-medium">See all</Link>
          </div>

          {/* 2-Card Carousel */}
          <div
            className="relative w-full touch-pan-y"
            onTouchStart={handleDropTouchStart}
            onTouchMove={handleDropTouchMove}
            onTouchEnd={handleDropTouchEnd}
          >
            <div className="grid grid-cols-2 gap-3">
              {visibleDropCards.map((drop, i) => {
                const isLeft = i === 0;
                const swipeX = isLeft ? dropSwipeOffset : 0;
                const swipeOpacity = isLeft ? Math.max(0.5, 1 - Math.abs(dropSwipeOffset) / 300) : 1;

                return (
                  <div
                    key={`${drop.id}-${i}`}
                    className={`${isDropSwiping && isLeft ? '' : 'transition-all duration-500 ease-out'}`}
                    style={{
                      transform: flippingDropId === drop.id
                        ? "translateX(0) rotateY(180deg) scale(0.88)"
                        : `translateX(${swipeX}px)`,
                      opacity: flippingDropId === drop.id ? 0.2 : swipeOpacity,
                    }}
                  >
                    <div className="rounded-2xl bg-card shadow-card overflow-hidden transition-all duration-700 [transform-style:preserve-3d]">
                      {/* Drop Image */}
                      <div className="relative aspect-square overflow-hidden">
                        {drop.assetType === "image" && drop.image ? (
                          <img
                            src={drop.image}
                            alt={drop.title}
                            className="w-full h-full object-cover"
                          />
                        ) : drop.assetType === "video" && (drop.previewUri || drop.image) ? (
                          <img
                            src={drop.previewUri || drop.image}
                            alt={drop.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-white text-xs font-semibold uppercase tracking-[0.2em]">
                            {drop.assetType || "digital"}
                          </div>
                        )}
                        <Badge className="absolute top-2 left-2 bg-background/80 text-foreground backdrop-blur-sm text-[10px]">
                          {drop.type === "drop" ? "collect" : drop.type}
                        </Badge>
                        {drop.status === "live" && (
                          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>

                      {/* Drop Info */}
                      <div className="p-3">
                        <p className="font-semibold text-sm truncate text-card-foreground">{drop.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{drop.artist}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-primary">{drop.priceEth} ETH</span>
                          {drop.status === "live" && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> {drop.endsIn}
                            </span>
                          )}
                        </div>

                        {/* Collect/Bid Buttons */}
                        <div className="flex gap-2 mt-3">
                          {drop.type === "auction" ? (
                            <Button
                              size="sm"
                              onClick={() => handleBidOnDrop(drop)}
                              disabled={isBidding || biddingDropId === drop.id}
                              className="flex-1 h-8 rounded-full gradient-primary text-primary-foreground font-semibold text-xs"
                            >
                              {biddingDropId === drop.id ? (
                                <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Bidding...</>
                              ) : (
                                <><Gavel className="h-3 w-3 mr-1" /> Bid</>
                              )}
                            </Button>
                          ) : drop.type === "campaign" ? (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/drops/${drop.id}`)}
                              className="flex-1 h-8 rounded-full gradient-primary text-primary-foreground font-semibold text-xs"
                            >
                              View
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleCollectDrop(drop)}
                              disabled={isMintingArtist || mintingDropId === drop.id}
                              className="flex-1 h-8 rounded-full gradient-primary text-primary-foreground font-semibold text-xs"
                            >
                              {mintingDropId === drop.id ? (
                                <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Collecting...</>
                              ) : (
                                <><ShoppingCart className="h-3 w-3 mr-1" /> Collect</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Slide Controls */}
          {liveDrops.length > 2 && (
            <div className="flex items-center justify-center gap-4 py-2 mt-3">
              <button
                onClick={prevDropCard}
                className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ArrowRight className="h-4 w-4 text-secondary-foreground rotate-180" />
              </button>
              <div className="flex gap-1.5">
                {Array.from({ length: Math.max(1, liveDrops.length - 1) }).map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setCurrentDropCard(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentDropCard ? "w-7 bg-primary" : "w-2 bg-border"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextDropCard}
                className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ArrowRight className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Featured Artists — Card Deck */}
      <section className="py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Featured Artists</h2>
          <Link to="/artists" className="text-xs text-primary font-medium">See all</Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <p className="text-red-500 text-sm">{error.message}</p>
            </div>
          </div>
        )}

        {!loading && !error && featuredArtists.length === 0 && (
          <div className="w-full rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-lg font-semibold text-foreground">No whitelisted artists live yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Artists will appear here once a whitelisted creator saves a public profile and publishes work.
            </p>
          </div>
        )}

        {/* Card Deck */}
        {!loading && !error && featuredArtists.length > 0 && (
          <>
            <div
              className="relative h-[420px] w-full flex items-center justify-center touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {visibleCards.map((artist, i) => {
                const isTop = i === 0;
                const scale = 1 - i * 0.04;
                const translateY = i * 14;
                const zIndex = 3 - i;
                const opacity = 1 - i * 0.12;
                const swipeX = isTop ? swipeOffset : 0;
                const rotation = isTop ? swipeOffset * 0.05 : 0;
                const swipeOpacity = isTop ? Math.max(0.5, 1 - Math.abs(swipeOffset) / 300) : opacity;

                return (
                  <div
                    key={`${artist.id}-${i}`}
                    className={`absolute w-[92%] max-w-sm ${isSwiping && isTop ? '' : 'transition-all duration-500 ease-out'}`}
                    style={{
                      transform: `translateX(${swipeX}px) translateY(${translateY}px) scale(${scale}) rotate(${rotation}deg)`,
                      zIndex,
                      opacity: isTop ? swipeOpacity : opacity,
                    }}
                  >
                    <div className="rounded-2xl bg-card shadow-elevated overflow-hidden border border-border">
                      {/* Cover Image */}
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={artist.cover}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                        <Badge className="absolute top-3 right-3 bg-background/80 text-foreground text-[11px] backdrop-blur-sm font-semibold">
                          {artist.tag}
                        </Badge>
                      </div>

                      {/* Artist Info */}
                      <div className="p-5 -mt-8 relative">
                        <div className="flex items-end gap-3 mb-3">
                          <div className="h-16 w-16 rounded-full border-[3px] border-card overflow-hidden shadow-card flex-shrink-0">
                            <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <p className="font-bold text-lg text-card-foreground truncate">{artist.name}</p>
                            <p className="text-xs text-muted-foreground">{artist.tag}</p>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground font-body mb-5 line-clamp-2">{artist.bio}</p>

                        {/* Action Buttons — only on top card */}
                        {isTop && (
                          <div className="flex gap-2">
                            <SubscribeButtonWrapper artist={artist} isConnected={isConnected} connectWallet={connectWallet} address={address} toast={toast} />
                            <Button
                              variant="outline"
                              size="default"
                              className="rounded-full text-sm h-11 font-semibold"
                              asChild
                            >
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
            </div>

            {/* Swipe Controls */}
            <div className="flex items-center justify-center gap-4 py-2 mt-4">
              <button
                onClick={prevCard}
                className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ArrowRight className="h-4 w-4 text-secondary-foreground rotate-180" />
              </button>
              <div className="flex gap-1.5">
                {featuredArtists.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setCurrentCard(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentCard ? "w-7 bg-primary" : "w-2 bg-border"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextCard}
                className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ArrowRight className="h-4 w-4 text-secondary-foreground" />
              </button>
            </div>
          </>
        )}
      </section>

      {/* Spacer */}
      <div className="h-8" />
    </div>
  );
};

export default Index;
