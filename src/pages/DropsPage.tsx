import { Badge } from "@/components/ui/badge";
import { Clock, Filter, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { recordPageVisit } from "@/lib/analyticsStore";
import { useSupabaseLiveDrops } from "@/hooks/useSupabase";
import { type AssetType } from "@/lib/assetTypes";

const filters = ["All", "Auction", "Drop", "Campaign"];

const DropsPage = () => {
  const [active, setActive] = useState("All");
  const { data: supabaseDrops, loading, error } = useSupabaseLiveDrops();
  const allDrops = useMemo(() => {
    if (!supabaseDrops || supabaseDrops.length === 0) return [];
    return supabaseDrops
      .map(drop => {
        const artist = drop.artists && !Array.isArray(drop.artists) ? drop.artists : null;
        return {
          id: drop.id,
          title: drop.title,
          artist: artist?.name || "Unknown Artist",
          priceEth: drop.price_eth ? parseFloat(drop.price_eth).toFixed(4) : "0",
          image: drop.image_url || "",
          previewUri: drop.preview_uri,
          deliveryUri: drop.delivery_uri || "",
          type: (drop.type || "drop").toLowerCase() as "drop" | "auction" | "campaign",
          status: drop.status as "live" | "draft" | "ended",
          endsIn: drop.ends_at ? `${Math.max(0, Math.floor((new Date(drop.ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h` : "--",
          assetType: (drop.asset_type || "image") as AssetType,
        };
      });
  }, [supabaseDrops]);
  const filtered = active === "All" ? allDrops : allDrops.filter((drop) => drop.type === active);

  useEffect(() => {
    recordPageVisit();
  }, []);

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Art Drops</h1>
          <button className="p-2 rounded-full bg-secondary">
            <Filter className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Art Drops</h1>
          <button className="p-2 rounded-full bg-secondary">
            <Filter className="h-4 w-4 text-secondary-foreground" />
          </button>
        </div>
        <div className="text-red-500 text-sm">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Art Drops</h1>
        <button className="p-2 rounded-full bg-secondary">
          <Filter className="h-4 w-4 text-secondary-foreground" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActive(filter)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              active === filter ? "gradient-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">No drops yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Published drops from approved artists will appear here.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((drop, index) => (
          <Link
            key={drop.id}
            to={`/drops/${drop.id}`}
            className="rounded-2xl bg-card shadow-card overflow-hidden animate-fade-in group"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="relative aspect-square overflow-hidden bg-secondary">
              {drop.assetType === 'image' && drop.image ? (
                <img
                  src={drop.image}
                  alt={drop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : drop.assetType === 'video' && (drop.previewUri || drop.image) ? (
                <img
                  src={drop.previewUri || drop.image}
                  alt={drop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 text-white text-xs font-semibold uppercase tracking-[0.2em]">
                  {drop.assetType}
                </div>
              )}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                <Badge className="bg-background/80 text-foreground backdrop-blur-sm text-[10px]">
                  {drop.type}
                </Badge>
                {drop.assetType && drop.assetType !== 'image' && (
                  <Badge className="bg-primary/80 text-primary-foreground backdrop-blur-sm text-[10px] capitalize">
                    {drop.assetType}
                  </Badge>
                )}
              </div>
              {drop.status === "live" && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
            </div>
            <div className="p-3">
              <p className="font-semibold text-sm truncate text-card-foreground">{drop.title}</p>
              <p className="text-xs text-muted-foreground">{drop.artist}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-primary">{drop.priceEth} ETH</span>
                {drop.status === "live" && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
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
  );
};

export default DropsPage;
