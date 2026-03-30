import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Grid3X3, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { trackCollectionView } from "@/lib/analyticsStore";
import { ImageViewer, VideoViewer, AudioPlayer, PdfReader, EpubReader, DownloadPanel } from "@/components/collection";
import { supabase } from "@/lib/db";

interface CollectedDrop {
  id: string;
  title: string;
  artist: string;
  image_url?: string;
  preview_uri?: string;
  delivery_uri?: string;
  asset_type?: "image" | "video" | "audio" | "pdf" | "epub";
  is_gated?: boolean;
  created_at: string;
}

const MyCollectionPage = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const [filter, setFilter] = useState("all");
  const [collection, setCollection] = useState<CollectedDrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CollectedDrop | null>(null);
  const [viewerType, setViewerType] = useState<"image" | "video" | "audio" | "pdf" | "epub" | null>(null);

  // Track analytics view
  useEffect(() => {
    if (isConnected && address) {
      trackCollectionView(address);
    }
  }, [isConnected, address]);

  // Fetch user's collected drops from Supabase
  useEffect(() => {
    if (!isConnected || !address) {
      setCollection([]);
      setLoading(false);
      return;
    }

    const fetchCollectedDrops = async () => {
      setLoading(true);
      try {
        // Query orders/purchases table for this user
        // This assumes an orders table with buyer_address and drop_id fields
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("drop_id")
          .eq("buyer_address", address);

        if (ordersError) {
          console.warn("Could not fetch orders:", ordersError);
          setCollection([]);
          setLoading(false);
          return;
        }

        if (!orders || orders.length === 0) {
          setCollection([]);
          setLoading(false);
          return;
        }

        // Fetch the actual drop details for each order
        const dropIds = orders.map(o => o.drop_id);
        const { data: drops, error: dropsError } = await supabase
          .from("drops")
          .select("id, title, artist_id, image_url, asset_type, preview_uri, delivery_uri, is_gated, created_at, artists(name)")
          .in("id", dropIds);

        if (dropsError) {
          console.warn("Could not fetch drops:", dropsError);
          setCollection([]);
          setLoading(false);
          return;
        }

        // Transform the data
        const collected = (drops || []).map((drop: any) => ({
          id: drop.id,
          title: drop.title,
          artist: drop.artists?.name || "Unknown Artist",
          image_url: drop.image_url,
          preview_uri: drop.preview_uri,
          delivery_uri: drop.delivery_uri,
          asset_type: drop.asset_type || "image",
          is_gated: drop.is_gated,
          created_at: drop.created_at,
        }));

        setCollection(collected);
      } catch (error) {
        console.error("Error fetching collection:", error);
        setCollection([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectedDrops();
  }, [isConnected, address]);

  const collectedDrops = useMemo(() => {
    if (filter === "all") return collection;
    // For now, all items are "owned" since they're from the user's collection
    return collection;
  }, [collection, filter]);

  // Render the appropriate viewer based on asset type
  const renderViewer = () => {
    if (!selectedItem) return null;

    const src = selectedItem.delivery_uri || selectedItem.preview_uri || selectedItem.image_url;
    if (!src) return null;

    switch (selectedItem.asset_type) {
      case "video":
        return <VideoViewer src={src} onClose={() => setSelectedItem(null)} />;
      case "audio":
        return <AudioPlayer src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "pdf":
        return <PdfReader src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "epub":
        return <EpubReader src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "image":
      default:
        return <ImageViewer src={src} alt={selectedItem.title} onClose={() => setSelectedItem(null)} />;
    }
  };

  if (!isConnected) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground">Connect to see your NFT collection</p>
        <Button onClick={() => navigate(-1)} className="rounded-full gradient-primary text-primary-foreground">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Viewer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8">
            <div className="bg-black/90 rounded-xl overflow-hidden">
              <div className="max-h-96 overflow-hidden">
                {renderViewer()}
              </div>
              
              {/* Content Info and Download Panel */}
              <div className="p-6 border-t border-gray-700 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedItem.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{selectedItem.artist}</p>
                </div>
                
                <DownloadPanel
                  fileName={selectedItem.title}
                  fileType={selectedItem.asset_type}
                  isGated={selectedItem.is_gated || false}
                  isOwned={true}
                  downloadUrl={selectedItem.delivery_uri || selectedItem.preview_uri}
                  accessNote={selectedItem.is_gated ? "You own this item. Delivery files are available." : undefined}
                  onDownload={() => {
                    if (selectedItem.delivery_uri) {
                      window.open(selectedItem.delivery_uri, '_blank');
                    }
                  }}
                />
              </div>
            </div>
            
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">My Collection</h1>
      </div>

      {/* Filter tabs */}
      <div className="px-4 flex gap-2">
        {["all", "owned"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Collection grid */}
      {loading ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Loading your collection...</p>
        </div>
      ) : collectedDrops.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Grid3X3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">
            You haven't collected any art yet.
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Visit the marketplace or drops to start collecting.
          </p>
          <Button
            onClick={() => navigate("/drops")}
            variant="outline"
            className="mt-4 rounded-full"
          >
            Browse Drops
          </Button>
        </div>
      ) : (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {collectedDrops.map((drop) => (
              <div
                key={drop.id}
                onClick={() => setSelectedItem(drop)}
                className="rounded-xl overflow-hidden bg-card shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group"
              >
                <div className="aspect-square overflow-hidden relative bg-secondary">
                  {drop.asset_type === "video" && drop.preview_uri ? (
                    <img
                      src={drop.preview_uri}
                      alt={drop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : drop.asset_type === "audio" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-purple-900">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎵</div>
                        <p className="text-xs text-white mt-2">Audio</p>
                      </div>
                    </div>
                  ) : drop.asset_type === "pdf" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-red-900">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <p className="text-xs text-white mt-2">PDF</p>
                      </div>
                    </div>
                  ) : drop.asset_type === "epub" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-900">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📚</div>
                        <p className="text-xs text-white mt-2">eBook</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={drop.image_url || `https://images.unsplash.com/photo-1578321272176-c8593e05e55a?w=400&h=400&fit=crop`}
                      alt={drop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold truncate text-foreground">
                    {drop.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {drop.artist}
                  </p>
                  {drop.asset_type && (
                    <p className="text-xs text-primary mt-1 uppercase tracking-wide">
                      {drop.asset_type}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center pb-4 pt-2 text-xs text-muted-foreground font-body">
            <p>{collectedDrops.length} items in collection</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyCollectionPage;
