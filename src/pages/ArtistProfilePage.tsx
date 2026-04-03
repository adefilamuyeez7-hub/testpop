import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame, Globe, Grid3X3, Heart, Loader2, Share2, Users } from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet, useSubscribeToArtistContract, useGetSubscriberCountFromArtistContract, useIsSubscribedToArtistContract } from "@/hooks/useContracts";
import { useResolvedArtistContract } from "@/hooks/useContractIntegrations";
import { toast } from "sonner";
import { recordArtistView } from "@/lib/analyticsStore";
import { useSupabaseArtistById, useSupabaseDropsByArtist } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { resolvePortfolioImage } from "@/lib/portfolio";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import {
  createIPInvestment,
  getIPCampaigns,
  getInvestorPositions,
  type IPCampaign,
} from "@/lib/db";

const artistFallbackArt =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop stop-color='%238988ea'/><stop offset='1' stop-color='%23c18cff'/></linearGradient></defs><rect width='640' height='640' rx='36' fill='url(%23g)'/><circle cx='320' cy='220' r='120' fill='%23f3d0ff' opacity='.88'/><path d='M188 484c34-78 82-126 132-126 56 0 104 46 132 126' fill='%232b2235' opacity='.78'/><circle cx='320' cy='238' r='92' fill='%233a313f'/></svg>";

const ArtistProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isConnected, address, connectWallet } = useWallet();
  const artistId = id ?? "";
  const invalidArtistId = !id;

  const { data: artist, loading: artistLoading, error: artistError } = useSupabaseArtistById(artistId);
  const { data: supabaseDrops, loading: dropsLoading } = useSupabaseDropsByArtist(artistId);

  const [lightboxImage, setLightboxImage] = useState<{ image: string; title: string; medium: string; year: string } | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [buySharesOpen, setBuySharesOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [raiseCampaigns, setRaiseCampaigns] = useState<IPCampaign[]>([]);
  const [raiseCampaignsLoading, setRaiseCampaignsLoading] = useState(false);
  const [investorPositions, setInvestorPositions] = useState<Record<string, number>>({});
  const [investingCampaignId, setInvestingCampaignId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<IPCampaign | null>(null);
  const [activeContentTab, setActiveContentTab] = useState<"portfolio" | "drops">("portfolio");
  const [investmentForm, setInvestmentForm] = useState({
    amountEth: "",
    units: "",
  });
  const [shareDetails, setShareDetails] = useState({
    productionName: "",
    productType: "music",
    description: "",
    targetAmount: "",
  });

  const transformedArtist = useMemo(() => {
    if (!artist) return null;

    const normalizedPortfolio = Array.isArray(artist.portfolio) ? artist.portfolio : [];
    const featuredPortfolioArt = resolvePortfolioImage(normalizedPortfolio[0]) || "";
    const avatar = resolveMediaUrl(artist.avatar_url) || featuredPortfolioArt || artistFallbackArt;
    const banner = resolveMediaUrl(artist.banner_url) || featuredPortfolioArt || avatar;

    return {
      id: artist.id,
      name: artist.name || "Untitled Artist",
      avatar,
      banner,
      bio: artist.bio || "This artist has not published a public bio yet.",
      tag: artist.tag || "artist",
      handle: artist.handle,
      wallet: artist.wallet,
      contractAddress: artist.contract_address || null,
      subscriptionPrice: artist.subscription_price ? String(artist.subscription_price) : "0.01",
      twitterUrl: artist.twitter_url,
      instagramUrl: artist.instagram_url,
      websiteUrl: artist.website_url,
      portfolio: normalizedPortfolio,
    };
  }, [artist]);

  const drops = useMemo(() => {
    if (!supabaseDrops || !Array.isArray(supabaseDrops)) return [];
    return supabaseDrops.map((drop) => ({
      id: drop.id,
      title: drop.title,
      artistId: drop.artist_id,
      priceEth: String(drop.price_eth || 0),
      maxBuy: drop.supply || 1,
      bought: drop.sold || 0,
      status: drop.status || "draft",
      type: drop.type || "drop",
      image: resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri) || transformedArtist?.banner || artistFallbackArt,
    }));
  }, [supabaseDrops, transformedArtist?.banner]);

  const effectiveContractAddress = useResolvedArtistContract(
    transformedArtist?.wallet,
    transformedArtist?.contractAddress
  );
  const hasApiSession = Boolean(getRuntimeApiToken());

  const {
    subscribe,
    isPending: isSubscribePending,
    isConfirming: isSubscribeConfirming,
    isSuccess: isSubscribeSuccess,
  } = useSubscribeToArtistContract(effectiveContractAddress);

  const { count: onchainSubscribers, isLoading: isSubscribersLoading } = useGetSubscriberCountFromArtistContract(effectiveContractAddress);

  const {
    isSubscribed,
    isLoading: isSubscribedLoading,
    refetch: refetchSubscriptionStatus,
  } = useIsSubscribedToArtistContract(effectiveContractAddress, address ?? null);

  useEffect(() => {
    if (transformedArtist?.id) {
      recordArtistView(transformedArtist.id);
    }
  }, [transformedArtist?.id]);

  useEffect(() => {
    if (!isSubscribeSuccess) return;
    toast.success("Successfully subscribed to artist!");
    const timer = window.setTimeout(() => {
      refetchSubscriptionStatus();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [isSubscribeSuccess, refetchSubscriptionStatus]);

  useEffect(() => {
    if (!artistId) {
      setRaiseCampaigns([]);
      return;
    }

    let cancelled = false;
    setRaiseCampaignsLoading(true);

    getIPCampaigns({ artistId })
      .then((campaigns) => {
        if (!cancelled) {
          setRaiseCampaigns(campaigns.filter((campaign) => campaign.status === "active" || campaign.status === "funded"));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load raise campaigns:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRaiseCampaignsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistId]);

  useEffect(() => {
    if (!address || !hasApiSession) {
      setInvestorPositions({});
      return;
    }

    let cancelled = false;
    getInvestorPositions(address)
      .then((positions) => {
        if (cancelled) return;
        const nextPositions = positions.reduce<Record<string, number>>((acc, position) => {
          acc[position.campaign_id] = (acc[position.campaign_id] || 0) + Number(position.units_purchased || 0);
          return acc;
        }, {});
        setInvestorPositions(nextPositions);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load investor positions:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, hasApiSession]);

  const visibleRaiseCampaigns = useMemo(
    () => raiseCampaigns.filter((campaign) => campaign.status === "active" || campaign.status === "funded"),
    [raiseCampaigns],
  );

  const portfolioPieces = useMemo(
    () =>
      transformedArtist
        ? transformedArtist.portfolio
            .map((piece) => ({
              id: piece.id,
              image: resolvePortfolioImage(piece) || transformedArtist.banner,
              title: piece.title,
              medium: piece.medium,
              year: piece.year,
            }))
            .filter((piece) => Boolean(piece.image))
        : [],
    [transformedArtist]
  );

  const featuredPortfolio = useMemo(
    () => ({
      id: portfolioPieces[0]?.id || "artist-feature",
      image: portfolioPieces[0]?.image || transformedArtist?.banner || artistFallbackArt,
      title: portfolioPieces[0]?.title || `${transformedArtist?.name || "Artist"} portfolio`,
      medium: portfolioPieces[0]?.medium || transformedArtist?.tag || "artist",
      year: portfolioPieces[0]?.year || "Now",
    }),
    [portfolioPieces, transformedArtist]
  );

  const portfolioSlides = useMemo(
    () => (portfolioPieces.length > 0 ? portfolioPieces : [featuredPortfolio]),
    [featuredPortfolio, portfolioPieces]
  );

  const publicLinks = useMemo(
    () =>
      transformedArtist
        ? [
            { label: "X / Twitter", href: transformedArtist.twitterUrl },
            { label: "Instagram", href: transformedArtist.instagramUrl },
            { label: "Website", href: transformedArtist.websiteUrl },
          ].filter((link) => Boolean(link.href))
        : [],
    [transformedArtist]
  );
  const isArtistOwner = !!address && !!transformedArtist?.wallet && address.toLowerCase() === transformedArtist.wallet.toLowerCase();
  const featuredDrop = drops[0] ?? null;

  useEffect(() => {
    setActiveContentTab((current) => {
      if (current === "portfolio" && portfolioPieces.length > 0) return current;
      if (current === "drops" && drops.length > 0) return current;
      if (portfolioPieces.length > 0) return "portfolio";
      if (drops.length > 0) return "drops";
      return "portfolio";
    });
  }, [drops.length, portfolioPieces.length]);

  if (invalidArtistId) {
    return (
      <div className="space-y-4 px-4 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">Invalid artist ID</p>
        <p className="text-sm text-muted-foreground">No artist ID provided in the URL.</p>
        <Button onClick={() => navigate("/artists")} className="rounded-full gradient-primary text-primary-foreground">
          Back to Artists
        </Button>
      </div>
    );
  }

  if (artistLoading) {
    return (
      <div className="space-y-4 px-4 py-10 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading artist profile...</p>
      </div>
    );
  }

  if (artistError) {
    return (
      <div className="space-y-4 px-4 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">Error loading artist</p>
        <p className="text-sm text-muted-foreground">There was an error fetching the artist data.</p>
        <p className="rounded bg-secondary p-2 text-xs text-muted-foreground">{artistError.message}</p>
        <Button onClick={() => navigate("/artists")} className="rounded-full gradient-primary text-primary-foreground">
          Back to Artists
        </Button>
      </div>
    );
  }

  if (!transformedArtist) {
    return (
      <div className="space-y-4 px-4 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">Artist not found</p>
        <p className="text-sm text-muted-foreground">This artist is not public yet or is no longer whitelisted.</p>
        <Button onClick={() => navigate("/artists")} className="rounded-full gradient-primary text-primary-foreground">
          Back to Artists
        </Button>
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!effectiveContractAddress) {
      toast.error("Artist contract not deployed yet. Please try again later.");
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribe(String(transformedArtist.subscriptionPrice ?? "0.01"));
      toast.success("Subscription transaction submitted. Waiting for on-chain confirmation...");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Subscription failed";
      toast.error(message);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Profile link copied");
  };

  const handleInvest = async () => {
    if (!selectedCampaign) {
      toast.error("Select a raise first.");
      return;
    }

    if (!isConnected) {
      await connectWallet();
      return;
    }

    const amountEth = Number(investmentForm.amountEth || 0);
    const units = Number(investmentForm.units || 0);
    if (amountEth <= 0 && units <= 0) {
      toast.error("Enter an ETH amount or number of units.");
      return;
    }

    setInvestingCampaignId(selectedCampaign.id);
    try {
      const created = await createIPInvestment({
        campaign_id: selectedCampaign.id,
        amount_eth: amountEth > 0 ? amountEth : undefined,
        units_purchased: units > 0 ? units : undefined,
      });

      if (!created) {
        throw new Error("Investment request failed");
      }

      setInvestorPositions((prev) => ({
        ...prev,
        [selectedCampaign.id]:
          (prev[selectedCampaign.id] || 0) + Number(created.units_purchased || units || 0),
      }));
      setRaiseCampaigns((prev) => prev.map((campaign) => (
        campaign.id === selectedCampaign.id
          ? {
              ...campaign,
              units_sold: Number(campaign.units_sold || 0) + Number(created.units_purchased || units || 0),
              metadata: {
                ...(campaign.metadata || {}),
                committed_amount_eth: Number(campaign.metadata?.committed_amount_eth || 0) + Number(created.amount_eth || amountEth || 0),
              },
            }
          : campaign
      )));
      setInvestOpen(false);
      setInvestmentForm({ amountEth: "", units: "" });
      toast.success("Investment commitment recorded. Payment settlement is still pending.");
    } catch (error) {
      console.error("Failed to invest in raise:", error);
      toast.error(error instanceof Error ? error.message : "Investment failed");
    } finally {
      setInvestingCampaignId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.20),transparent_30%),linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/80 bg-white/94 p-4 shadow-[0_38px_120px_rgba(37,99,235,0.10)] md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="rounded-full border border-[#dbe7ff] bg-white p-2.5 text-foreground transition-colors hover:bg-[#eef5ff]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={handleShare} className="rounded-full border border-[#dbe7ff] bg-white p-2.5 text-foreground transition-colors hover:bg-[#eef5ff]">
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[1.8rem] bg-[linear-gradient(180deg,#60a5fa_0%,#1d4ed8_100%)] p-5 text-white shadow-[0_24px_60px_rgba(37,99,235,0.28)]">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/18">+</span>
              About Me
            </div>

            <div className="mt-5 flex justify-center">
              <div className="relative flex h-52 w-52 items-center justify-center rounded-full border-[8px] border-white/80 bg-[radial-gradient(circle_at_center,#dbeafe_0%,#93c5fd_62%,transparent_63%)]">
                <img
                  src={transformedArtist.avatar}
                  alt={transformedArtist.name}
                  className="h-44 w-44 rounded-full object-cover grayscale"
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-2xl font-light leading-none text-white/90">I&apos;m,</p>
              <h1 className="mt-2 text-4xl font-black leading-[0.95] tracking-tight md:text-5xl">{transformedArtist.name}</h1>
              <p className="mt-4 text-sm text-white/78">
                {transformedArtist.handle ? `@${transformedArtist.handle}` : transformedArtist.tag}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/82">{transformedArtist.bio}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[1.3rem] bg-white/14 p-3 backdrop-blur-sm">
                <p className="text-2xl font-black">{isSubscribersLoading ? "..." : onchainSubscribers}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/74">Subscribers</p>
              </div>
              <div className="rounded-[1.3rem] bg-white/14 p-3 backdrop-blur-sm">
                <p className="text-2xl font-black">{drops.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/74">Projects</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleSubscribe}
                disabled={isSubscribing || isSubscribePending || isSubscribeConfirming || isSubscribed || isSubscribedLoading}
                className="w-full rounded-full bg-white text-[#1d4ed8] hover:bg-white/90"
              >
                {isConnected
                  ? isSubscribed
                    ? "Subscribed"
                    : isSubscribedLoading
                      ? "Checking..."
                      : isSubscribing || isSubscribePending
                        ? "Processing..."
                        : isSubscribeConfirming
                          ? "Confirming..."
                          : `Subscribe - ${transformedArtist.subscriptionPrice} ETH/mo`
                  : "Connect Wallet to Subscribe"}
              </Button>
                <Button
                  onClick={() => setBuySharesOpen(true)}
                  disabled={!isArtistOwner || onchainSubscribers < 100}
                  variant="outline"
                  className="w-full rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20"
                  title={
                    !isArtistOwner
                      ? "Only the artist can request an IP raise from their own profile"
                      : onchainSubscribers < 100
                        ? "Artist needs 100+ subscribers to request an IP raise"
                        : ""
                  }
                >
                  {!isArtistOwner ? "IP Raise Locked" : onchainSubscribers < 100 ? `Request Raise (${onchainSubscribers}/100)` : "Request IP Raise"}
                </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {publicLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-2 text-xs text-white/92 backdrop-blur-sm transition-colors hover:bg-white/22"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {link.label}
                </a>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-white/12 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/70">Investable IP</p>
                  <h2 className="mt-2 text-lg font-bold text-white">Approved Raises</h2>
                </div>
                <Badge className="bg-white/90 text-[#1d4ed8] hover:bg-white/90">
                  {visibleRaiseCampaigns.length} live
                </Badge>
              </div>

              {raiseCampaignsLoading ? (
                <div className="mt-4 flex items-center text-sm text-white/80">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading raises...
                </div>
              ) : visibleRaiseCampaigns.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/78">
                  No approved raises are live right now.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleRaiseCampaigns.slice(0, 2).map((campaign) => {
                    const committedAmount = Number(campaign.metadata?.committed_amount_eth || 0);
                    const targetAmount = Number(campaign.funding_target_eth || 0);
                    const progress = targetAmount > 0 ? Math.min(100, (committedAmount / targetAmount) * 100) : 0;
                    const ownedUnits = investorPositions[campaign.id] || 0;

                    return (
                      <div key={campaign.id} className="rounded-[1.3rem] bg-white/10 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{campaign.title}</p>
                            <p className="mt-1 text-xs text-white/70">{campaign.summary || campaign.description}</p>
                          </div>
                          <Badge className="border-none bg-white/85 text-[#1d4ed8] capitalize hover:bg-white/85">
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-white/72">
                          <span>{committedAmount.toFixed(2)} ETH committed</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-white/15">
                          <div className="h-2 rounded-full bg-white" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] text-white/72">
                            {ownedUnits > 0 ? `Your position: ${ownedUnits} units` : "No position yet"}
                          </p>
                          <Button
                            size="sm"
                            className="rounded-full bg-white text-[#1d4ed8] hover:bg-white/90"
                            disabled={isArtistOwner}
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setInvestOpen(true);
                            }}
                          >
                            {isArtistOwner ? "Creator View" : "Invest"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <Tabs value={activeContentTab} onValueChange={(value) => setActiveContentTab(value as "portfolio" | "drops")} className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_190px]">
              <div className="rounded-[1.8rem] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#dbeafe] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#1d4ed8] hover:bg-[#dbeafe]">
                        {transformedArtist.tag}
                      </Badge>
                      <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {activeContentTab === "portfolio" ? "Portfolio Mode" : "Drop Mode"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl xl:text-5xl">
                      {activeContentTab === "portfolio" ? "Portfolio" : "Live Drops"}
                    </h2>
                  </div>

                  <TabsList className="grid w-full max-w-[220px] grid-cols-2 rounded-[1.2rem] bg-[#eaf3ff] p-1">
                    <TabsTrigger value="portfolio" className="rounded-[0.9rem] text-xs font-semibold">
                      Portfolio
                    </TabsTrigger>
                    <TabsTrigger value="drops" className="rounded-[0.9rem] text-xs font-semibold">
                      Drops
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="mt-5">
                  <TabsContent value="portfolio" className="mt-0 space-y-4">
                    <div className="rounded-[1.8rem] bg-[#eaf3ff] p-3 shadow-[0_22px_45px_rgba(37,99,235,0.08)]">
                      <Carousel opts={{ loop: portfolioSlides.length > 1 }} className="mx-auto w-full">
                        <CarouselContent>
                          {portfolioSlides.map((piece) => (
                            <CarouselItem key={piece.id}>
                              <button
                                type="button"
                                onClick={() => setLightboxImage(piece)}
                                className="group relative block h-[260px] w-full overflow-hidden rounded-[1.4rem] sm:h-[340px]"
                              >
                                <img src={piece.image} alt={piece.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                                  <div className="rounded-[1.1rem] bg-white/88 px-4 py-2 text-left text-foreground backdrop-blur-sm">
                                    <p className="text-sm font-semibold">{piece.title}</p>
                                    <p className="text-xs text-muted-foreground">{`${piece.medium} - ${piece.year}`}</p>
                                  </div>
                                  <div className="rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm">
                                    {portfolioSlides.length > 1 ? "Open piece" : "Featured work"}
                                  </div>
                                </div>
                              </button>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        {portfolioSlides.length > 1 && (
                          <>
                            <CarouselPrevious className="left-3 top-auto bottom-3 h-10 w-10 translate-y-0 border-white/70 bg-white/85 text-foreground hover:bg-white" />
                            <CarouselNext className="right-3 top-auto bottom-3 h-10 w-10 translate-y-0 border-white/70 bg-white/85 text-foreground hover:bg-white" />
                          </>
                        )}
                      </Carousel>
                    </div>

                    {portfolioPieces.length === 0 ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">No portfolio pieces yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {portfolioPieces.map((piece) => (
                          <button
                            key={piece.id}
                            onClick={() => setLightboxImage(piece)}
                            className="group relative overflow-hidden rounded-2xl"
                          >
                            <img src={piece.image} alt={piece.title} className="aspect-square h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                              <p className="truncate text-sm font-semibold text-white">{piece.title}</p>
                              <p className="text-[11px] text-white/75">{`${piece.medium} - ${piece.year}`}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="text-center font-body text-xs text-muted-foreground">
                      <Grid3X3 className="mr-1 inline h-3 w-3" />
                      {portfolioPieces.length} pieces in collection
                    </p>
                  </TabsContent>

                  <TabsContent value="drops" className="mt-0 space-y-4">
                    {dropsLoading ? (
                      <div className="rounded-[1.5rem] bg-white/80 py-12 text-center text-sm text-muted-foreground">
                        Loading drops...
                      </div>
                    ) : drops.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-dashed border-[#dbe7ff] bg-white/80 py-12 text-center text-sm text-muted-foreground">
                        No drops yet.
                      </div>
                    ) : (
                      <>
                        {featuredDrop && (
                          <Link to={`/drops/${featuredDrop.id}`} className="group block overflow-hidden rounded-[1.8rem] bg-[#eaf3ff] p-3 shadow-[0_22px_45px_rgba(37,99,235,0.08)]">
                            <div className="relative overflow-hidden rounded-[1.4rem]">
                              <img src={featuredDrop.image} alt={featuredDrop.title} className="h-[260px] w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-[340px]" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                              <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
                                <div className="max-w-xl rounded-[1.1rem] bg-white/88 px-4 py-3 text-foreground backdrop-blur-sm">
                                  <p className="text-xs uppercase tracking-[0.24em] text-[#1d4ed8]">{featuredDrop.type}</p>
                                  <p className="mt-2 text-xl font-black">{featuredDrop.title}</p>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {featuredDrop.priceEth} ETH · {featuredDrop.bought}/{featuredDrop.maxBuy} collected
                                  </p>
                                </div>
                                <div className="rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm">
                                  Open drop
                                </div>
                              </div>
                            </div>
                          </Link>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {drops.map((drop) => (
                            <Link key={drop.id} to={`/drops/${drop.id}`} className="overflow-hidden rounded-2xl bg-card shadow-card">
                              <div className="aspect-square overflow-hidden">
                                <img src={drop.image} alt={drop.title} className="h-full w-full object-cover" />
                              </div>
                              <div className="p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-card-foreground">{drop.title}</p>
                                  <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{drop.type}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-primary" /> {drop.priceEth} ETH</span>
                                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-primary" /> {drop.bought}/{drop.maxBuy}</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[1.5rem] bg-[#eff6ff] p-4">
                  <p className="text-4xl font-black text-foreground">
                    {activeContentTab === "portfolio" ? portfolioPieces.length : drops.length}
                  </p>
                  <p className="mt-1 text-foreground/80">
                    {activeContentTab === "portfolio" ? "Portfolio Pieces" : "Live Drops"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-[#1d4ed8] p-4 text-white">
                  <p className="text-4xl font-black">{onchainSubscribers}</p>
                  <p className="mt-1 text-white/90">Collectors</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]">
                  <p className="text-4xl font-black text-foreground">{visibleRaiseCampaigns.length}</p>
                  <p className="mt-1 text-foreground/80">Approved Raises</p>
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </div>

      <Dialog open={investOpen} onOpenChange={setInvestOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card p-4 shadow-card">
          <DialogHeader>
            <DialogTitle>Invest In {selectedCampaign?.title || "Raise"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              Investments are currently recorded as commitments while payment settlement is finalized.
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Amount (ETH)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 h-9 rounded-lg"
                value={investmentForm.amountEth}
                onChange={(e) => setInvestmentForm((prev) => ({ ...prev, amountEth: e.target.value }))}
                placeholder="e.g. 1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Units</Label>
              <Input
                type="number"
                min="0"
                step="1"
                className="mt-1 h-9 rounded-lg"
                value={investmentForm.units}
                onChange={(e) => setInvestmentForm((prev) => ({ ...prev, units: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>
            {selectedCampaign && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-xs font-bold text-foreground">{selectedCampaign.funding_target_eth || 0} ETH</p>
                  <p className="text-[9px] text-muted-foreground">Target</p>
                </div>
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-xs font-bold text-foreground">{selectedCampaign.unit_price_eth || "--"}</p>
                  <p className="text-[9px] text-muted-foreground">Unit Price</p>
                </div>
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-xs font-bold text-foreground">{selectedCampaign.total_units || "--"}</p>
                  <p className="text-[9px] text-muted-foreground">Units</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              disabled={investingCampaignId === selectedCampaign?.id}
              onClick={handleInvest}
            >
              {investingCampaignId === selectedCampaign?.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Commit Investment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buySharesOpen} onOpenChange={setBuySharesOpen}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto rounded-2xl bg-card p-4 shadow-card">
          <DialogHeader>
            <DialogTitle>Request IP Raise for {transformedArtist.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Idea Name *</label>
              <Input
                placeholder='e.g., "Album 2024", "Film Production"'
                value={shareDetails.productionName}
                onChange={(e) => setShareDetails({ ...shareDetails, productionName: e.target.value })}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Project Type *</label>
              <select
                value={shareDetails.productType}
                onChange={(e) => setShareDetails({ ...shareDetails, productType: e.target.value })}
                className="h-9 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground"
              >
                <option value="music">Music</option>
                <option value="video">Video</option>
                <option value="film">Film</option>
                <option value="art">Art</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Raise Description *</label>
              <textarea
                placeholder="Describe your production and what the investment will fund..."
                value={shareDetails.description}
                onChange={(e) => setShareDetails({ ...shareDetails, description: e.target.value })}
                className="h-20 w-full resize-none rounded-lg border border-border bg-secondary p-2 text-sm text-foreground placeholder-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Target Raise (ETH) *</label>
              <Input
                type="number"
                placeholder="e.g., 10"
                value={shareDetails.targetAmount}
                onChange={(e) => setShareDetails({ ...shareDetails, targetAmount: e.target.value })}
                step="0.1"
                min="0"
                className="h-9 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuySharesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!shareDetails.productionName.trim() || !shareDetails.description.trim() || !shareDetails.targetAmount) {
                  toast.error("Please fill in all required fields");
                  return;
                }
                toast.success("Raise request drafted. Finish submission from Artist Studio for admin approval.");
                setShareDetails({ productionName: "", productType: "music", description: "", targetAmount: "" });
                setBuySharesOpen(false);
              }}
              className="gradient-primary text-primary-foreground"
            >
              Close Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-lg overflow-hidden rounded-2xl border-none bg-card p-0">
          {lightboxImage && (
            <>
              <img src={lightboxImage.image} alt={lightboxImage.title} className="aspect-square w-full object-cover" />
              <div className="p-4">
                <p className="font-bold text-foreground">{lightboxImage.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {`${lightboxImage.medium} - ${lightboxImage.year}`}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArtistProfilePage;

