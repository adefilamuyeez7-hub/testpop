import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Grid3X3, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { trackCollectionView } from "@/lib/analyticsStore";
import { ImageViewer, VideoViewer, AudioPlayer, PdfReader, EpubReader, DownloadPanel } from "@/components/collection";
import { ipfsToHttp, resolveMediaUrl } from "@/lib/pinata";
import { useCollectionStore, type CollectedDropItem } from "@/stores/collectionStore";
import { getOrdersByBuyer, type OrderWithItems } from "@/lib/db";
import { detectAssetTypeFromUri, type AssetType } from "@/lib/assetTypes";

function getCollectionItemKey(item: CollectedDropItem) {
  const normalizedWallet = item.ownerWallet.toLowerCase();
  const normalizedContract = item.contractAddress?.toLowerCase();

  if (normalizedContract && item.mintedTokenId !== null && item.mintedTokenId !== undefined) {
    return `${normalizedWallet}:${normalizedContract}:${item.mintedTokenId}`;
  }

  return `${normalizedWallet}:${item.id}`;
}

function inferCollectedAssetType(item: Pick<CollectedDropItem, "assetType" | "deliveryUri" | "previewUri" | "imageUrl">): AssetType {
  if (item.assetType && item.assetType !== "digital") {
    return item.assetType;
  }

  const mediaCandidates = [item.deliveryUri, item.previewUri, item.imageUrl];
  for (const candidate of mediaCandidates) {
    if (!candidate?.trim()) continue;
    const detected = detectAssetTypeFromUri(candidate);
    if (detected) {
      return detected;
    }
  }

  return item.assetType || "image";
}

function resolveCollectionPreviewImage(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;

    const lower = value.toLowerCase();
    const isDocumentLike =
      lower.endsWith(".pdf") ||
      lower.endsWith(".epub") ||
      lower.includes(".pdf?") ||
      lower.includes(".epub?");

    if (isDocumentLike) continue;
    return resolveMediaUrl(value);
  }

  return "";
}

function normalizeCollectedItem(item: CollectedDropItem): CollectedDropItem {
  const imageUrl = resolveCollectionPreviewImage(item.imageUrl, item.previewUri);
  const previewUri = item.previewUri || imageUrl || item.deliveryUri;
  const deliveryUri = item.deliveryUri || item.previewUri || item.imageUrl;

  return {
    ...item,
    imageUrl,
    previewUri: previewUri || undefined,
    deliveryUri: deliveryUri || undefined,
    assetType: inferCollectedAssetType({
      assetType: item.assetType,
      deliveryUri,
      previewUri,
      imageUrl,
    }),
  };
}

function toOrderCollectionItems(order: OrderWithItems, ownerWallet: string): CollectedDropItem[] {
  const typedOrder = order as OrderWithItems;
  const orderItems = typedOrder.order_items?.length
    ? typedOrder.order_items
    : typedOrder.product_id
    ? [{
        id: `${typedOrder.id}:${typedOrder.product_id}`,
        product_id: typedOrder.product_id,
        quantity: typedOrder.quantity ?? 1,
        products: typedOrder.products ?? null,
      }]
    : [];

  return orderItems.map((item, index) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const imageUrl = resolveCollectionPreviewImage(product?.image_url, product?.image_ipfs_uri, product?.preview_uri);
    const previewUri = product?.preview_uri || product?.image_url || product?.image_ipfs_uri || undefined;
    const deliveryUri = product?.delivery_uri || product?.image_ipfs_uri || product?.image_url || undefined;
    const assetType = inferCollectedAssetType({
      assetType: product?.asset_type || undefined,
      deliveryUri,
      previewUri,
      imageUrl,
    });

    return {
      id: `${typedOrder.id}:${item.id || item.product_id || index}`,
      ownerWallet,
      title: product?.name?.trim() || `Order item ${index + 1}`,
      artist: product?.creator_wallet || "Marketplace",
      imageUrl,
      previewUri,
      deliveryUri,
      assetType,
      isGated: Boolean(product?.is_gated),
      collectedAt: typedOrder.created_at || new Date().toISOString(),
    } satisfies CollectedDropItem;
  });
}

const CollectionPlaceholder = ({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) => (
  <div className="w-full min-h-[320px] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white p-8 relative">
    <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-white/10 px-2 py-1 text-xs">
      Close
    </button>
    <div className="text-center space-y-3">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-white/75">{subtitle}</p>
    </div>
  </div>
);

const MyCollectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected } = useWallet();
  const [filter, setFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<CollectedDropItem | null>(null);
  const [routeCollectedItem] = useState<CollectedDropItem | null>(
    location.state?.collectedItem ?? null
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(
    location.state?.highlightDropId ?? null
  );
  const collection = useCollectionStore((state) => state.items);
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const [purchasedCollection, setPurchasedCollection] = useState<CollectedDropItem[]>([]);
  const [purchasedCollectionLoading, setPurchasedCollectionLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      trackCollectionView(address);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!routeCollectedItem || !address) {
      return;
    }

    if (routeCollectedItem.ownerWallet.toLowerCase() !== address.toLowerCase()) {
      return;
    }

    addCollectedDrop(routeCollectedItem);
  }, [addCollectedDrop, address, routeCollectedItem]);

  useEffect(() => {
    if (!isConnected || !address) {
      setPurchasedCollection([]);
      setPurchasedCollectionLoading(false);
      return;
    }

    let active = true;

    const loadPurchasedCollection = async () => {
      setPurchasedCollectionLoading(true);

      try {
        const orders = await getOrdersByBuyer(address.toLowerCase());
        if (!active) return;

        const mappedItems = (orders || []).flatMap((order) => toOrderCollectionItems(order as OrderWithItems, address));

        setPurchasedCollection(mappedItems);
      } catch (error) {
        console.error("Failed to load purchased collection:", error);
        if (active) {
          setPurchasedCollection([]);
        }
      } finally {
        if (active) {
          setPurchasedCollectionLoading(false);
        }
      }
    };

    loadPurchasedCollection();

    return () => {
      active = false;
    };
  }, [address, isConnected]);

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

    const normalizedAddress = address.toLowerCase();
    const merged = new Map<string, CollectedDropItem>();

    purchasedCollection.forEach((item) => {
      if (item.ownerWallet.toLowerCase() !== normalizedAddress) return;
      merged.set(getCollectionItemKey(item), item);
    });

    if (routeCollectedItem && routeCollectedItem.ownerWallet.toLowerCase() === normalizedAddress) {
      merged.set(getCollectionItemKey(routeCollectedItem), routeCollectedItem);
    }

    collection.forEach((item) => {
      if (item.ownerWallet.toLowerCase() !== normalizedAddress) return;
      const key = getCollectionItemKey(item);
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    });

    return Array.from(merged.values()).map(normalizeCollectedItem).sort((a, b) => {
      const aTime = new Date(a.collectedAt).getTime();
      const bTime = new Date(b.collectedAt).getTime();
      return bTime - aTime;
    });
  }, [address, purchasedCollection, collection, routeCollectedItem]);

  const collectedDrops = useMemo(() => {
    if (filter === "all") return ownedCollection;
    return ownedCollection;
  }, [filter, ownedCollection]);

  const renderViewer = () => {
    if (!selectedItem) return null;

    const src = ipfsToHttp(selectedItem.deliveryUri || selectedItem.previewUri || selectedItem.imageUrl);
    const poster = ipfsToHttp(selectedItem.previewUri || selectedItem.imageUrl || "");
    if (!src) return null;

    switch (selectedItem.assetType) {
      case "video":
        return <VideoViewer src={src} poster={poster} onClose={() => setSelectedItem(null)} />;
      case "audio":
        return <AudioPlayer src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "pdf":
        return <PdfReader src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "epub":
        return <EpubReader src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />;
      case "digital":
        return (
          <CollectionPlaceholder
            title={selectedItem.title}
            subtitle="This collectible includes downloadable files. Use the download panel below to access them."
            onClose={() => setSelectedItem(null)}
          />
        );
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
                  downloadUrl={
                    selectedItem.assetType === "pdf" || selectedItem.assetType === "epub"
                      ? undefined
                      : ipfsToHttp(selectedItem.deliveryUri || selectedItem.previewUri || "")
                  }
                  accessNote={
                    selectedItem.assetType === "pdf" || selectedItem.assetType === "epub"
                      ? "This eBook is rendered above in the built-in reader. Use download only if you want an offline copy."
                      : selectedItem.isGated
                      ? "You own this item. Delivery files are available."
                      : undefined
                  }
                  actionLabel="Download"
                  showCopyLink={selectedItem.assetType !== "pdf" && selectedItem.assetType !== "epub"}
                  onDownload={() => {
                    if (selectedItem.deliveryUri && selectedItem.assetType !== "pdf" && selectedItem.assetType !== "epub") {
                      const downloadLink = document.createElement("a");
                      downloadLink.href = ipfsToHttp(selectedItem.deliveryUri);
                      downloadLink.target = "_blank";
                      downloadLink.rel = "noreferrer";
                      downloadLink.download = selectedItem.title;
                      downloadLink.click();
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

      {purchasedCollectionLoading && collectedDrops.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground font-body">Loading your collection...</p>
        </div>
      )}

      {!purchasedCollectionLoading && collectedDrops.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Grid3X3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">You haven&apos;t collected any art yet.</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Visit the drops page to start collecting.</p>
          <Button onClick={() => navigate("/drops")} variant="outline" className="mt-4 rounded-full">
            Browse Drops
          </Button>
        </div>
      ) : collectedDrops.length > 0 ? (
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
                        src={ipfsToHttp(drop.previewUri)}
                        alt={drop.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : drop.assetType === "audio" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-900 text-white text-xs font-semibold">
                        Audio Collect
                      </div>
                    ) : drop.assetType === "pdf" ? (
                      drop.imageUrl ? (
                        <img
                          src={ipfsToHttp(drop.imageUrl)}
                          alt={drop.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-red-900 text-white text-xs font-semibold">
                          PDF Collect
                        </div>
                      )
                    ) : drop.assetType === "epub" ? (
                      drop.imageUrl ? (
                        <img
                          src={ipfsToHttp(drop.imageUrl)}
                          alt={drop.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-900 text-white text-xs font-semibold">
                          eBook Collect
                        </div>
                      )
                    ) : drop.assetType === "digital" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-700 to-slate-900 text-white text-xs font-semibold px-3 text-center">
                        Downloadable Tool
                      </div>
                    ) : (
                      <img
                        src={ipfsToHttp(drop.imageUrl || "https://images.unsplash.com/photo-1578321272176-c8593e05e55a?w=400&h=400&fit=crop")}
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
      ) : null}
    </div>
  );
};

export default MyCollectionPage;
