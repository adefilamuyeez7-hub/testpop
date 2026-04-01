import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Grid3X3, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { trackCollectionView } from "@/lib/analyticsStore";
import { ImageViewer, VideoViewer, AudioPlayer, PdfReader, EpubReader, DownloadPanel } from "@/components/collection";
import { useCollectionStore, type CollectedDropItem } from "@/stores/collectionStore";

const MyCollectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected } = useWallet();
  const [filter, setFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<CollectedDropItem | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(
    location.state?.highlightDropId ?? null
  );
  const collection = useCollectionStore((state) => state.items);

  useEffect(() => {
    if (isConnected && address) {
      trackCollectionView(address);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!highlightedId) return;

    const timer = window.setTimeout(() => {
      setHighlightedId(null);
      navigate(location.pathname, { replace: true, state: null });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [highlightedId, location.pathname, navigate]);

  const ownedCollection = useMemo(() => {
    if (!address) return [];
    return collection.filter(
      (item) => item.ownerWallet.toLowerCase() === address.toLowerCase()
    );
  }, [address, collection]);

  const collectedDrops = useMemo(() => {
    if (filter === "all") return ownedCollection;
    return ownedCollection;
  }, [filter, ownedCollection]);

  const renderViewer = () => {
    if (!selectedItem) return null;

    const src = selectedItem.deliveryUri || selectedItem.previewUri || selectedItem.imageUrl;
    if (!src) return null;

    switch (selectedItem.assetType) {
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
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8">
            <div className="bg-black/90 rounded-xl overflow-hidden">
              <div className="max-h-96 overflow-hidden">{renderViewer()}</div>
              <div className="p-6 border-t border-gray-700 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedItem.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{selectedItem.artist}</p>
                </div>

                <DownloadPanel
                  fileName={selectedItem.title}
                  fileType={selectedItem.assetType}
                  isGated={selectedItem.isGated || false}
                  isOwned={true}
                  downloadUrl={selectedItem.deliveryUri || selectedItem.previewUri}
                  accessNote={selectedItem.isGated ? "You own this item. Delivery files are available." : undefined}
                  onDownload={() => {
                    if (selectedItem.deliveryUri) {
                      window.open(selectedItem.deliveryUri, "_blank");
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

      <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">My Collection</h1>
      </div>

      <div className="px-4 flex gap-2">
        {["all", "owned"].map((entry) => (
          <button
            key={entry}
            onClick={() => setFilter(entry)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              filter === entry ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {entry.charAt(0).toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </div>

      {collectedDrops.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Grid3X3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">You haven&apos;t collected any art yet.</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Visit the drops page to start collecting.</p>
          <Button onClick={() => navigate("/drops")} variant="outline" className="mt-4 rounded-full">
            Browse Drops
          </Button>
        </div>
      ) : (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {collectedDrops.map((drop) => {
              const isHighlighted = highlightedId === drop.id;

              return (
                <div
                  key={drop.id}
                  onClick={() => setSelectedItem(drop)}
                  className={`rounded-xl overflow-hidden bg-card shadow-card cursor-pointer group transition-all duration-700 ${
                    isHighlighted ? "ring-2 ring-primary shadow-elevated scale-[1.03] [transform:rotateY(180deg)]" : "hover:shadow-elevated"
                  }`}
                >
                  <div className="aspect-square overflow-hidden relative bg-secondary">
                    {drop.assetType === "video" && drop.previewUri ? (
                      <img
                        src={drop.previewUri}
                        alt={drop.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : drop.assetType === "audio" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-900 text-white text-xs font-semibold">
                        Audio Collect
                      </div>
                    ) : drop.assetType === "pdf" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-red-900 text-white text-xs font-semibold">
                        PDF Collect
                      </div>
                    ) : drop.assetType === "epub" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-900 text-white text-xs font-semibold">
                        eBook Collect
                      </div>
                    ) : (
                      <img
                        src={drop.imageUrl || "https://images.unsplash.com/photo-1578321272176-c8593e05e55a?w=400&h=400&fit=crop"}
                        alt={drop.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {isHighlighted && (
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-transparent" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate text-foreground">{drop.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{drop.artist}</p>
                    <p className="text-xs text-primary mt-1 uppercase tracking-wide">
                      {drop.assetType || "image"}
                    </p>
                  </div>
                </div>
              );
            })}
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
