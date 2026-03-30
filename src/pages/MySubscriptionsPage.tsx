import { useState, useEffect } from "react";
import { ArrowLeft, Heart, Users, Flame } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { getAllArtists } from "@/lib/artistStore";
import { trackSubscriptionsView, trackCampaignInteraction } from "@/lib/analyticsStore";
import { toggleArtistFavorite, isArtistFavorited, getFavorites } from "@/lib/favoritesStore";
import { createPublicClient, http, getAddress } from "viem";
import { ART_DROP_ADDRESS } from "@/lib/contracts/artDrop";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

const MySubscriptionsPage = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const [sortBy, setSortBy] = useState("recent"); // recent, favorite
  const [favoriteArtists, setFavoriteArtists] = useState<Set<string>>(new Set());

  // Track view
  useEffect(() => {
    if (isConnected && address) {
      trackSubscriptionsView(address);
    }
  }, [isConnected, address]);

  // Load favorites
  useEffect(() => {
    if (isConnected && address) {
      const favs = getFavorites(address);
      setFavoriteArtists(new Set(favs.favoriteArtists));
    }
  }, [isConnected, address]);

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setSubscriptions([]);
      return;
    }

    let active = true;

    const fetchSubscriptions = async () => {
      setSubscriptionsLoading(true);
      try {
        const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
        const logs = await publicClient.getLogs({
          address: ART_DROP_ADDRESS,
          event: {
            type: "event",
            name: "ArtistSubscribed",
            inputs: [
              { name: "artist", type: "address", indexed: true },
              { name: "subscriber", type: "address", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
              { name: "artistShare", type: "uint256", indexed: false },
              { name: "adminShare", type: "uint256", indexed: false },
            ],
          },
          args: {
            subscriber: getAddress(address),
          },
          fromBlock: "earliest",
          toBlock: "latest",
        });

        if (!active) return;

        const artistAddresses = Array.from(new Set(logs.map((log) => (log.args as any).artist.toLowerCase())));

        const artists = getAllArtists();

        const matched = artists.filter((artist) =>
          artistAddresses.includes((artist.wallet || "").toLowerCase())
        );

        if (!active) return;
        setSubscriptions(matched);
      } catch (err) {
        console.error("Error fetching subscriptions:", err);
        if (active) setSubscriptions([]);
      } finally {
        if (active) setSubscriptionsLoading(false);
      }
    };

    fetchSubscriptions();

    return () => { active = false; };
  }, [isConnected, address]);

  const handleFavoriteToggle = (artistWallet: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!address) return;

    const isFavorited = isArtistFavorited(address, artistWallet);
    toggleArtistFavorite(address, artistWallet);

    // Update local state
    setFavoriteArtists((prev) => {
      const newSet = new Set(prev);
      if (isFavorited) {
        newSet.delete(artistWallet.toLowerCase());
      } else {
        newSet.add(artistWallet.toLowerCase());
      }
      return newSet;
    });

    trackCampaignInteraction(address, `favorite_artist_${artistWallet}`);
  };

  // Sort subscriptions
  const sortedSubscriptions = useMemo(() => {
    const sorted = [...subscriptions];
    if (sortBy === "favorite") {
      sorted.sort(
        (a, b) =>
          Number(favoriteArtists.has(b.wallet?.toLowerCase() || "")) -
          Number(favoriteArtists.has(a.wallet?.toLowerCase() || ""))
      );
    }
    return sorted;
  }, [subscriptions, sortBy, favoriteArtists]);

  if (!isConnected) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground">Connect to see your subscriptions</p>
        <Button onClick={() => navigate(-1)} className="rounded-full gradient-primary text-primary-foreground">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">Subscriptions</h1>
      </div>

      {/* Sort tabs */}
      <div className="px-4 flex gap-2">
        {["recent", "favorite"].map((f) => (
          <button
            key={f}
            onClick={() => setSortBy(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              sortBy === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Subscriptions list */}
      {sortedSubscriptions.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">
            You haven't subscribed to any artists yet.
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Visit artist profiles to support them!
          </p>
          <Button
            onClick={() => navigate("/artists")}
            variant="outline"
            className="mt-4 rounded-full"
          >
            Browse Artists
          </Button>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {sortedSubscriptions.map((artist) => {
            const isFavorited = favoriteArtists.has(artist.wallet?.toLowerCase() || "");
            return (
            <Link
              key={artist.id}
              to={`/artists/${artist.id}`}
              className="p-3 rounded-xl bg-card shadow-card hover:shadow-elevated transition-shadow flex items-start gap-3 group"
            >
              <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={artist.avatar}
                  alt={artist.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{artist.name}</p>
                <p className="text-xs text-muted-foreground">@{artist.handle}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-[10px]">{artist.tag}</Badge>
                </div>
              </div>
              <button
                onClick={(e) => handleFavoriteToggle(artist.wallet || "", e)}
                className="ml-auto flex-shrink-0 p-1.5 rounded-full hover:bg-secondary/50 transition-colors"
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${
                    isFavorited
                      ? "fill-red-500 text-red-500"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
              </button>
            </Link>
            );
          })}
        </div>
      )}

      {sortedSubscriptions.length > 0 && (
        <div className="text-center pb-4 text-xs text-muted-foreground font-body px-4">
          <p>Supporting {sortedSubscriptions.length} artist{sortedSubscriptions.length !== 1 ? "s" : ""}</p>
        </div>
      )}
    </div>
  );
};

export default MySubscriptionsPage;
