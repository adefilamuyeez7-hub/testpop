import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Grid3X3, Loader2, MessageSquare, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { trackCollectionView } from "@/lib/analyticsStore";
import { ImageViewer, VideoViewer, AudioPlayer, PdfReader, DownloadPanel } from "@/components/collection";
import { ipfsToHttp } from "@/lib/pinata";
import { resolveDropCoverImage, sameMediaTarget } from "@/lib/mediaPreview";
import { useCollectionStore, type CollectedDropItem } from "@/stores/collectionStore";
import {
  getEntitlementsByBuyer,
  getFulfillmentsByOrder,
  getOrdersByBuyer,
  getProductAssets,
  createProductFeedbackThread,
  type Entitlement,
  type Fulfillment,
  type OrderWithItems,
  type ProductAsset,
} from "@/lib/db";
import {
  detectAssetTypeFromFilename,
  detectAssetTypeFromMime,
  detectAssetTypeFromUri,
  type AssetType,
} from "@/lib/assetTypes";
import { toast } from "sonner";
import { establishSecureSession } from "@/lib/secureAuth";

const ACCESSIBLE_ORDER_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);
const IMAGE_LIKE_ASSET_TYPES = new Set<AssetType>(["image", "video", "audio"]);

const EpubReader = lazy(() =>
  import("@/components/collection/EpubReader").then((module) => ({ default: module.EpubReader }))
);

function getCollectionItemKey(item: CollectedDropItem) {
  const normalizedWallet = item.ownerWallet.toLowerCase();
  const normalizedContract = item.contractAddress?.toLowerCase();

  if (normalizedContract && item.mintedTokenId !== null && item.mintedTokenId !== undefined) {
    return `${normalizedWallet}:${normalizedContract}:${item.mintedTokenId}`;
  }

  return `${normalizedWallet}:${item.id}`;
}

function inferCollectedAssetType(item: Pick<CollectedDropItem, "assetType" | "deliveryUri" | "previewUri" | "imageUrl">): AssetType {
  const hasDistinctDeliveryAsset =
    Boolean(item.deliveryUri?.trim()) &&
    !sameMediaTarget(item.deliveryUri, item.previewUri) &&
    !sameMediaTarget(item.deliveryUri, item.imageUrl);

  if (item.assetType === "image" && hasDistinctDeliveryAsset) {
    const deliveryDetected = detectAssetTypeFromUri(item.deliveryUri || "");
    if (deliveryDetected !== "image") {
      return deliveryDetected;
    }
  }

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

  return item.assetType || "digital";
}

function inferProductAssetType(asset?: Partial<ProductAsset> | null): AssetType {
  if (!asset) {
    return "digital";
  }

  if (
    asset.asset_type === "image" ||
    asset.asset_type === "video" ||
    asset.asset_type === "audio" ||
    asset.asset_type === "pdf" ||
    asset.asset_type === "epub"
  ) {
    return asset.asset_type;
  }

  if (asset.mime_type?.trim()) {
    const detectedFromMime = detectAssetTypeFromMime(asset.mime_type);
    if (detectedFromMime !== "digital") {
      return detectedFromMime;
    }
  }

  if (asset.file_name?.trim()) {
    const detectedFromFilename = detectAssetTypeFromFilename(asset.file_name);
    if (detectedFromFilename !== "digital") {
      return detectedFromFilename;
    }
  }

  if (asset.uri?.trim()) {
    const detectedFromUri = detectAssetTypeFromUri(asset.uri);
    if (detectedFromUri !== "digital") {
      return detectedFromUri;
    }
  }

  return "digital";
}

function pickPreviewProductAsset(assets: ProductAsset[]): ProductAsset | null {
  const candidates = assets.filter((asset) => (asset.preview_uri || asset.uri)?.trim());
  const priorityGroups = [
    candidates.filter(
      (asset) =>
        asset.visibility === "public" &&
        (asset.is_primary || asset.role === "hero_art" || asset.role === "preview") &&
        IMAGE_LIKE_ASSET_TYPES.has(inferProductAssetType(asset)),
    ),
    candidates.filter(
      (asset) =>
        asset.visibility === "public" &&
        IMAGE_LIKE_ASSET_TYPES.has(inferProductAssetType(asset)),
    ),
    candidates.filter((asset) => asset.visibility === "public" && asset.is_primary),
    candidates.filter((asset) => asset.visibility === "public"),
    candidates,
  ];

  for (const group of priorityGroups) {
    if (group.length > 0) {
      return group[0];
    }
  }

  return null;
}

function pickDeliveryProductAsset(assets: ProductAsset[]): ProductAsset | null {
  const candidates = assets.filter((asset) => asset.uri?.trim());
  const priorityGroups = [
    candidates.filter((asset) => asset.role === "delivery"),
    candidates.filter((asset) => asset.visibility === "gated" || asset.visibility === "private"),
    candidates.filter((asset) => asset.role === "source" || asset.role === "attachment"),
    candidates.filter((asset) => inferProductAssetType(asset) !== "image"),
    candidates,
  ];

  for (const group of priorityGroups) {
    if (group.length > 0) {
      return group[0];
    }
  }

  return null;
}

function resolveCollectionPreviewImage(item: Pick<CollectedDropItem, "assetType" | "deliveryUri" | "previewUri" | "imageUrl">): string {
  return resolveDropCoverImage({
    assetType: item.assetType,
    previewUri: item.previewUri,
    imageUrl: item.imageUrl,
    deliveryUri: item.deliveryUri,
  });
}

function normalizeCollectedItem(item: CollectedDropItem): CollectedDropItem {
  const assetType = inferCollectedAssetType(item);
  const imageUrl = resolveCollectionPreviewImage({ ...item, assetType });
  const previewUri =
    item.previewUri ||
    imageUrl ||
    (assetType === "image" || assetType === "video" || assetType === "audio" ? item.deliveryUri : undefined);
  const deliveryUri =
    item.deliveryUri ||
    (assetType === "image" || assetType === "video" || assetType === "audio"
      ? item.previewUri || item.imageUrl
      : undefined);

  return {
    ...item,
    imageUrl,
    previewUri: previewUri || undefined,
    deliveryUri: deliveryUri || undefined,
    assetType: inferCollectedAssetType({
      assetType,
      deliveryUri,
      previewUri,
      imageUrl,
    }),
  };
}

function resolveCollectedAssetSource(item: Pick<CollectedDropItem, "assetType" | "deliveryUri" | "previewUri" | "imageUrl">): string {
  const delivery = item.deliveryUri?.trim();
  const preview = item.previewUri?.trim();
  const image = item.imageUrl?.trim();

  if (item.assetType === "pdf" || item.assetType === "epub") {
    return ipfsToHttp(delivery || preview || image || "");
  }

  return ipfsToHttp(delivery || preview || image || "");
}

function resolveCollectedDownloadSource(item: Pick<CollectedDropItem, "deliveryUri" | "previewUri" | "imageUrl">): string {
  return ipfsToHttp(item.deliveryUri?.trim() || item.previewUri?.trim() || item.imageUrl?.trim() || "");
}

function toOrderCollectionItems(
  order: OrderWithItems,
  ownerWallet: string,
  productAssetsByProductId: Map<string, ProductAsset[]>,
): CollectedDropItem[] {
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
    const productId = item.product_id || typedOrder.product_id || null;
    const productAssets = productId ? productAssetsByProductId.get(productId) || [] : [];
    const previewAsset = pickPreviewProductAsset(productAssets);
    const deliveryAsset = pickDeliveryProductAsset(productAssets);
    const previewUri =
      previewAsset?.preview_uri?.trim() ||
      previewAsset?.uri?.trim() ||
      product?.preview_uri ||
      product?.image_ipfs_uri ||
      product?.image_url ||
      undefined;
    const deliveryUri =
      deliveryAsset?.uri?.trim() ||
      product?.delivery_uri ||
      undefined;
    const deliveryAssetType = inferProductAssetType(deliveryAsset);
    const inferredAssetType = inferCollectedAssetType({
      assetType: deliveryAsset ? deliveryAssetType : product?.asset_type || undefined,
      deliveryUri,
      previewUri,
      imageUrl: product?.image_url || undefined,
    });
    const imageUrl = resolveDropCoverImage({
      assetType: inferredAssetType,
      previewUri,
      imageUrl: product?.image_url || undefined,
      imageIpfsUri: product?.image_ipfs_uri || undefined,
      deliveryUri,
      metadata: product?.metadata || undefined,
    });

    return {
      id: `${typedOrder.id}:${item.id || item.product_id || index}`,
      ownerWallet,
      creativeReleaseId: typedOrder.creative_release_id ?? null,
      productId,
      title: product?.name?.trim() || `Order item ${index + 1}`,
      artist: product?.creator_wallet || "Marketplace",
      imageUrl,
      previewUri,
      deliveryUri,
      assetType: inferredAssetType,
      isGated: Boolean(product?.is_gated),
      contractKind: typedOrder.contract_kind ?? null,
      orderStatus: typedOrder.status || undefined,
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

type MyCollectionPageProps = {
  embedded?: boolean;
};

const MyCollectionPage = ({ embedded = false }: MyCollectionPageProps) => {
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
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    visibility: "public" as "public" | "private",
    feedbackType: "review" as "review" | "feedback" | "question",
    rating: 5,
    title: "",
    body: "",
  });
  const isReaderItem = selectedItem?.assetType === "pdf" || selectedItem?.assetType === "epub";

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
    setFeedbackForm({
      visibility: "public",
      feedbackType: "review",
      rating: 5,
      title: "",
      body: "",
    });
  }, [selectedItem?.id]);

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
        await establishSecureSession(address.toLowerCase());
        const orders = await getOrdersByBuyer(address.toLowerCase(), { accessibleOnly: true });
        if (!active) return;

        const productIds = Array.from(
          new Set(
            (orders || []).flatMap((order) => {
              const normalizedOrder = order as OrderWithItems;
              const itemProductIds = normalizedOrder.order_items?.map((item) => item.product_id).filter(Boolean) || [];
              return normalizedOrder.product_id ? [...itemProductIds, normalizedOrder.product_id] : itemProductIds;
            }),
          ),
        );

        const [entitlements, fulfillmentGroups, productAssetEntries] = await Promise.all([
          getEntitlementsByBuyer(address.toLowerCase()),
          Promise.all(
            (orders || []).map(async (order) => ({
              orderId: order.id,
              fulfillments: await getFulfillmentsByOrder(order.id),
            })),
          ),
          Promise.all(
            productIds.map(async (productId) => [
              productId,
              await getProductAssets(productId, { includePrivate: true }),
            ] as const),
          ),
        ]);
        if (!active) return;

        const entitlementsByOrderAndProduct = new Map<string, Entitlement[]>();
        for (const entitlement of entitlements || []) {
          const key = `${entitlement.order_id || ""}:${entitlement.product_id || ""}`;
          const group = entitlementsByOrderAndProduct.get(key) || [];
          group.push(entitlement);
          entitlementsByOrderAndProduct.set(key, group);
        }

        const fulfillmentsByOrder = new Map<string, Fulfillment[]>(
          fulfillmentGroups.map((entry) => [entry.orderId, entry.fulfillments || []]),
        );
        const productAssetsByProductId = new Map<string, ProductAsset[]>(productAssetEntries);

        const mappedItems = (orders || []).flatMap((order) =>
          toOrderCollectionItems(order as OrderWithItems, address, productAssetsByProductId).map((item) => {
            const productId = item.productId || order.product_id || null;
            const entitlementKey = `${order.id}:${productId || ""}`;
            const itemEntitlements = entitlementsByOrderAndProduct.get(entitlementKey) || [];
            const orderFulfillments = fulfillmentsByOrder.get(order.id) || [];
            const itemFulfillment = orderFulfillments.find((fulfillment) => fulfillment.product_id === productId) || orderFulfillments[0];

            return {
              ...item,
              entitlementCount: itemEntitlements.length,
              fulfillmentStatus: itemFulfillment?.status || undefined,
            };
          }),
        );

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
    if (filter === "owned") {
      return ownedCollection.filter((item) => item.mintedTokenId != null || Boolean(item.contractAddress) || Boolean(item.isGated));
    }
    return ownedCollection;
  }, [filter, ownedCollection]);

  const renderViewer = () => {
    if (!selectedItem) return null;

    const src = resolveCollectedAssetSource(selectedItem);
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
        return (
          <Suspense
            fallback={
              <div className="flex min-h-[320px] items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 text-orange-900">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your eBook reader...
                </div>
              </div>
            }
          >
            <EpubReader src={src} title={selectedItem.title} onClose={() => setSelectedItem(null)} />
          </Suspense>
        );
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

  async function handleSubmitCollectorFeedback() {
    if (!selectedItem?.productId) {
      toast.error("This collection item is not linked to a product yet.");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet to send verified feedback.");
      return;
    }

    if (!feedbackForm.body.trim()) {
      toast.error("Write your feedback before sending it.");
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await establishSecureSession(address);
      await createProductFeedbackThread({
        productId: selectedItem.productId,
        feedbackType: feedbackForm.visibility === "public" ? "review" : feedbackForm.feedbackType,
        visibility: feedbackForm.visibility,
        rating: feedbackForm.visibility === "public" ? feedbackForm.rating : null,
        title: feedbackForm.title,
        body: feedbackForm.body,
      });
      setFeedbackForm((prev) => ({ ...prev, title: "", body: "" }));
      toast.success(
        feedbackForm.visibility === "public"
          ? "Your verified review is now attached to this product."
          : "Your private feedback is now in the creator inbox."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send feedback");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground">Connect to see your NFT collection</p>
        {!embedded && (
          <Button onClick={() => navigate(-1)} className="rounded-full gradient-primary text-primary-foreground">
            Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${embedded ? "pb-6" : "pb-20"}`}>
      {selectedItem && (
        <div
          className={`fixed inset-0 z-50 bg-black/90 ${isReaderItem ? "overflow-hidden p-0" : "flex items-center justify-center overflow-y-auto p-4"}`}
        >
          <div className={isReaderItem ? "h-full w-full" : "relative my-8 w-full max-w-2xl"}>
            {isReaderItem ? (
              renderViewer()
            ) : (
              <>
                <div className="overflow-hidden rounded-xl bg-black/90">
                  <div className="max-h-96 overflow-hidden">{renderViewer()}</div>
                  {(() => {
                    const isOwned =
                      (selectedItem.orderStatus ? ACCESSIBLE_ORDER_STATUSES.has(selectedItem.orderStatus) : false) ||
                      selectedItem.mintedTokenId != null ||
                      Boolean(selectedItem.contractAddress) ||
                      !selectedItem.isGated;
                    const downloadUrl = resolveCollectedDownloadSource(selectedItem) || undefined;

                    return (
                      <div className="space-y-4 border-t border-gray-700 p-6">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{selectedItem.title}</h3>
                          <p className="mt-1 text-sm text-gray-400">{selectedItem.artist}</p>
                        </div>

                        <DownloadPanel
                          fileName={selectedItem.title}
                          fileType={selectedItem.assetType}
                          isGated={selectedItem.isGated || false}
                          isOwned={isOwned}
                          downloadUrl={downloadUrl}
                          accessNote={
                            selectedItem.assetType === "pdf" || selectedItem.assetType === "epub"
                              ? "This file opens in the in-app reader above, and you can also open or download the original file from here."
                              : selectedItem.isGated
                                ? "You own this item. Delivery files are available."
                                : undefined
                          }
                          actionLabel={selectedItem.assetType === "pdf" || selectedItem.assetType === "epub" ? "Open file" : "Download"}
                          showCopyLink={Boolean(downloadUrl)}
                          onDownload={() => {
                            if (downloadUrl) {
                              const downloadLink = document.createElement("a");
                              downloadLink.href = downloadUrl;
                              downloadLink.target = "_blank";
                              downloadLink.rel = "noreferrer";
                              downloadLink.download = selectedItem.title;
                              downloadLink.click();
                            }
                          }}
                        />

                        {selectedItem.productId ? (
                          <div className="rounded-2xl border border-gray-700 bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-white">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              <p className="text-sm font-semibold">Verified collector feedback</p>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-gray-400">
                              Feedback from your collection is verified by ownership. Publish a public review or send a private note straight into the creator inbox.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={feedbackForm.visibility === "public" ? "default" : "outline"}
                                onClick={() =>
                                  setFeedbackForm((prev) => ({ ...prev, visibility: "public", feedbackType: "review" }))
                                }
                                className="rounded-full"
                              >
                                Public review
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={feedbackForm.visibility === "private" ? "default" : "outline"}
                                onClick={() =>
                                  setFeedbackForm((prev) => ({ ...prev, visibility: "private", feedbackType: "feedback" }))
                                }
                                className="rounded-full"
                              >
                                Private feedback
                              </Button>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                              <input
                                value={feedbackForm.title}
                                onChange={(event) => setFeedbackForm((prev) => ({ ...prev, title: event.target.value }))}
                                className="h-10 rounded-xl border border-gray-700 bg-black/30 px-3 text-sm text-white placeholder:text-gray-500"
                                placeholder={
                                  feedbackForm.visibility === "public"
                                    ? "Review title"
                                    : "Optional subject for the creator"
                                }
                              />
                              <select
                                value={feedbackForm.visibility === "public" ? feedbackForm.rating : feedbackForm.feedbackType}
                                onChange={(event) => {
                                  if (feedbackForm.visibility === "public") {
                                    setFeedbackForm((prev) => ({ ...prev, rating: Number(event.target.value) || 5 }));
                                    return;
                                  }
                                  setFeedbackForm((prev) => ({
                                    ...prev,
                                    feedbackType: event.target.value as "review" | "feedback" | "question",
                                  }));
                                }}
                                className="h-10 rounded-xl border border-gray-700 bg-black/30 px-3 text-sm text-white"
                              >
                                {feedbackForm.visibility === "public" ? (
                                  [5, 4, 3, 2, 1].map((value) => (
                                    <option key={value} value={value}>
                                      {value} / 5
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value="feedback">Feedback</option>
                                    <option value="question">Question</option>
                                    <option value="review">Collector note</option>
                                  </>
                                )}
                              </select>
                            </div>

                            <textarea
                              value={feedbackForm.body}
                              onChange={(event) => setFeedbackForm((prev) => ({ ...prev, body: event.target.value }))}
                              className="mt-3 min-h-[120px] w-full rounded-2xl border border-gray-700 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-gray-500"
                              placeholder={
                                feedbackForm.visibility === "public"
                                  ? "Tell future collectors what this item felt like to own or use."
                                  : "Send a private note, bug report, idea, or question to the creator."
                              }
                            />
                            <Button
                              onClick={() => void handleSubmitCollectorFeedback()}
                              disabled={feedbackSubmitting || !feedbackForm.body.trim()}
                              className="mt-3 w-full rounded-full"
                            >
                              {feedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verified feedback"}
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-gray-700 px-4 py-3 text-xs text-gray-400">
                            Feedback opens once this collectible is linked to a product record.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!embedded && (
        <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold">My Collection</h1>
        </div>
      )}

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
                    {(drop.fulfillmentStatus || drop.entitlementCount) && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {drop.fulfillmentStatus ? `Fulfillment: ${drop.fulfillmentStatus}` : null}
                        {drop.fulfillmentStatus && drop.entitlementCount ? " · " : null}
                        {drop.entitlementCount ? `${drop.entitlementCount} gated asset${drop.entitlementCount === 1 ? "" : "s"}` : null}
                      </p>
                    )}
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
