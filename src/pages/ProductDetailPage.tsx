import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, MessageSquare, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useSupabaseProductById } from "@/hooks/useSupabase";
import {
  getCreativeRelease,
  getProductFeedbackOverview,
  getProductFeedbackThreadMessages,
  getProductAssets,
  createProductFeedbackThread,
  curateProductFeedbackThread,
  sendProductFeedbackMessage,
  type ProductFeedbackMessage,
  type ProductFeedbackOverview,
  type CreativeRelease,
  type ProductAsset,
} from "@/lib/db";
import { ipfsToHttp, resolveMediaUrl } from "@/lib/pinata";
import { resolveContractProductId, resolveProductMetadataUri } from "@/lib/productMetadata";
import { establishSecureSession } from "@/lib/secureAuth";

function resolveAssetUrl(asset?: ProductAsset | null) {
  if (!asset) return "";
  return resolveMediaUrl(asset.preview_uri, asset.uri);
}

function formatDetailValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { address } = useAccount();
  const { selectedProduct, setSelectedProduct } = useProductStore();
  const { addItem } = useCartStore();
  const { data: supabaseProduct, loading } = useSupabaseProductById(id);
  const [creativeRelease, setCreativeRelease] = useState<CreativeRelease | null>(null);
  const [productAssets, setProductAssets] = useState<ProductAsset[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [feedbackOverview, setFeedbackOverview] = useState<ProductFeedbackOverview | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [selectedPublicThreadId, setSelectedPublicThreadId] = useState<string | null>(null);
  const [selectedPublicThreadMessages, setSelectedPublicThreadMessages] = useState<ProductFeedbackMessage[]>([]);
  const [selectedPublicThreadLoading, setSelectedPublicThreadLoading] = useState(false);
  const [selectedViewerThreadId, setSelectedViewerThreadId] = useState<string | null>(null);
  const [selectedViewerThreadMessages, setSelectedViewerThreadMessages] = useState<ProductFeedbackMessage[]>([]);
  const [selectedViewerThreadLoading, setSelectedViewerThreadLoading] = useState(false);
  const [selectedCreatorThreadId, setSelectedCreatorThreadId] = useState<string | null>(null);
  const [selectedCreatorThreadMessages, setSelectedCreatorThreadMessages] = useState<ProductFeedbackMessage[]>([]);
  const [selectedCreatorThreadLoading, setSelectedCreatorThreadLoading] = useState(false);
  const [viewerReplyDraft, setViewerReplyDraft] = useState("");
  const [creatorReplyDraft, setCreatorReplyDraft] = useState("");
  const feedbackSectionRef = useRef<HTMLDivElement | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    visibility: "public" as "public" | "private",
    feedbackType: "review" as "review" | "feedback" | "question",
    rating: 5,
    title: "",
    body: "",
  });

  const product = useMemo(() => {
    if (selectedProduct?.id === id) {
      return selectedProduct;
    }

    if (!supabaseProduct) {
      return null;
    }

    return {
      id: supabaseProduct.id,
      creativeReleaseId: supabaseProduct.creative_release_id ?? null,
      name: supabaseProduct.name,
      image: resolveMediaUrl(supabaseProduct.image_url, supabaseProduct.image_ipfs_uri),
      price: BigInt(Math.floor(Number(supabaseProduct.price_eth || 0) * 1e18)),
      creator: supabaseProduct.creator_wallet || "0x0",
      description: supabaseProduct.description || "",
      stock: supabaseProduct.stock || 0,
      sold: supabaseProduct.sold || 0,
      category: supabaseProduct.category || "Other",
      releaseType: supabaseProduct.product_type || "physical",
      contractKind: supabaseProduct.contract_kind || "productStore",
      contractListingId: Number.isFinite(Number(supabaseProduct.contract_listing_id))
        ? Number(supabaseProduct.contract_listing_id)
        : null,
      contractProductId: resolveContractProductId(supabaseProduct.metadata, supabaseProduct.contract_product_id),
      metadataUri: resolveProductMetadataUri(supabaseProduct.metadata, supabaseProduct.metadata_uri),
    };
  }, [id, selectedProduct, supabaseProduct]);

  useEffect(() => {
    if (product) {
      setSelectedProduct(product);
    }
  }, [product, setSelectedProduct]);

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      if (!supabaseProduct?.id) return;
      setDetailsLoading(true);
      try {
        const [assets, release] = await Promise.all([
          getProductAssets(supabaseProduct.id),
          supabaseProduct.creative_release_id
            ? getCreativeRelease(supabaseProduct.creative_release_id)
            : Promise.resolve(null),
        ]);

        if (!isMounted) return;
        setProductAssets(assets || []);
        setCreativeRelease(release || null);
      } finally {
        if (isMounted) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetails();
    return () => {
      isMounted = false;
    };
  }, [supabaseProduct?.id, supabaseProduct?.creative_release_id]);

  useEffect(() => {
    let isMounted = true;

    const loadFeedback = async () => {
      if (!id) return;
      setFeedbackLoading(true);

      try {
        if (address) {
          await establishSecureSession(address).catch(() => undefined);
        }
        const nextFeedback = await getProductFeedbackOverview(id);
        if (isMounted) {
          setFeedbackOverview(nextFeedback);
        }
      } catch (error) {
        if (isMounted) {
          console.error(error);
          setFeedbackOverview(null);
        }
      } finally {
        if (isMounted) {
          setFeedbackLoading(false);
        }
      }
    };

    void loadFeedback();
    return () => {
      isMounted = false;
    };
  }, [address, id]);

  useEffect(() => {
    const firstThreadId = feedbackOverview?.public_threads?.[0]?.id || null;
    setSelectedPublicThreadId((current) =>
      current && feedbackOverview?.public_threads?.some((thread) => thread.id === current)
        ? current
        : firstThreadId
    );
  }, [feedbackOverview?.public_threads]);

  useEffect(() => {
    const firstViewerThreadId = feedbackOverview?.viewer_threads?.[0]?.id || null;
    setSelectedViewerThreadId((current) =>
      current && feedbackOverview?.viewer_threads?.some((thread) => thread.id === current)
        ? current
        : firstViewerThreadId
    );
  }, [feedbackOverview?.viewer_threads]);

  useEffect(() => {
    const firstCreatorThreadId = feedbackOverview?.creator_threads?.[0]?.id || null;
    setSelectedCreatorThreadId((current) =>
      current && feedbackOverview?.creator_threads?.some((thread) => thread.id === current)
        ? current
        : firstCreatorThreadId
    );
  }, [feedbackOverview?.creator_threads]);

  useEffect(() => {
    if (!selectedPublicThreadId) {
      setSelectedPublicThreadMessages([]);
      return;
    }

    let active = true;
    setSelectedPublicThreadLoading(true);
    getProductFeedbackThreadMessages(selectedPublicThreadId)
      .then((data) => {
        if (active) {
          setSelectedPublicThreadMessages(data.messages || []);
        }
      })
      .catch((error) => {
        if (active) {
          console.error(error);
          setSelectedPublicThreadMessages([]);
        }
      })
      .finally(() => {
        if (active) {
          setSelectedPublicThreadLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedPublicThreadId]);

  useEffect(() => {
    if (!selectedViewerThreadId) {
      setSelectedViewerThreadMessages([]);
      return;
    }

    let active = true;
    setSelectedViewerThreadLoading(true);
    getProductFeedbackThreadMessages(selectedViewerThreadId)
      .then((data) => {
        if (active) {
          setSelectedViewerThreadMessages(data.messages || []);
        }
      })
      .catch((error) => {
        if (active) {
          console.error(error);
          setSelectedViewerThreadMessages([]);
        }
      })
      .finally(() => {
        if (active) {
          setSelectedViewerThreadLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedViewerThreadId]);

  useEffect(() => {
    if (!selectedCreatorThreadId) {
      setSelectedCreatorThreadMessages([]);
      return;
    }

    let active = true;
    setSelectedCreatorThreadLoading(true);
    getProductFeedbackThreadMessages(selectedCreatorThreadId)
      .then((data) => {
        if (active) {
          setSelectedCreatorThreadMessages(data.messages || []);
        }
      })
      .catch((error) => {
        if (active) {
          console.error(error);
          setSelectedCreatorThreadMessages([]);
        }
      })
      .finally(() => {
        if (active) {
          setSelectedCreatorThreadLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCreatorThreadId]);

  const galleryImages = useMemo(() => {
    const urls = new Set<string>();
    const orderedUrls: string[] = [];

    const pushUrl = (value?: string | null) => {
      const resolved = value ? resolveMediaUrl(value) : "";
      if (resolved && !urls.has(resolved)) {
        urls.add(resolved);
        orderedUrls.push(resolved);
      }
    };

    pushUrl(creativeRelease?.cover_image_uri || null);
    pushUrl(product?.image || "");

    for (const asset of productAssets) {
      if (["hero_art", "gallery_photo", "physical_photo", "preview"].includes(String(asset.role || ""))) {
        pushUrl(resolveAssetUrl(asset));
      }
    }

    return orderedUrls;
  }, [creativeRelease?.cover_image_uri, product?.image, productAssets]);

  useEffect(() => {
    if (!selectedImage && galleryImages[0]) {
      setSelectedImage(galleryImages[0]);
    }
  }, [galleryImages, selectedImage]);

  useEffect(() => {
    if (location.hash !== "#feedback") {
      return;
    }

    window.setTimeout(() => {
      feedbackSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [location.hash, feedbackOverview]);

  useEffect(() => {
    if (!feedbackOverview || feedbackOverview.can_publish_public_review) {
      return;
    }

    setFeedbackForm((prev) => ({
      ...prev,
      visibility: "private",
      feedbackType: "question",
      rating: 5,
    }));
  }, [feedbackOverview]);

  const isOnchainReady =
    (product?.contractKind === "creativeReleaseEscrow" &&
      typeof product.contractListingId === "number" &&
      product.contractListingId > 0) ||
    (typeof product?.contractProductId === "number" && product.contractProductId > 0);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!product) {
      return (
        <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/products")} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Releases
        </Button>
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const availableStock = product.stock === 0 ? "Unlimited" : product.stock - product.sold;
  const isSoldOut = product.stock > 0 && product.sold >= product.stock;
  const physicalDetails = creativeRelease?.physical_details_jsonb ?? {};
  const shippingProfile = creativeRelease?.shipping_profile_jsonb ?? {};
  const physicalDetailEntries = Object.entries(physicalDetails).filter(([, value]) => formatDetailValue(value));
  const shippingEntries = Object.entries(shippingProfile).filter(([, value]) => formatDetailValue(value));
  const releaseExplorerUrl = creativeRelease?.contract_address
    ? `https://sepolia.basescan.org/address/${creativeRelease.contract_address}`
    : null;
  const artMetadataUrl = creativeRelease?.art_metadata_uri ? ipfsToHttp(creativeRelease.art_metadata_uri) : null;
  const isCreatorViewer = feedbackOverview?.is_creator_viewer ?? false;
  const canLeaveFeedback = feedbackOverview?.can_leave_feedback ?? false;
  const canPublishPublicReview = feedbackOverview?.can_publish_public_review ?? false;
  const feedbackGate = feedbackOverview?.feedback_gate ?? "locked";
  const selectedCreatorThread =
    feedbackOverview?.creator_threads?.find((thread) => thread.id === selectedCreatorThreadId) || null;

  const handleAddToCart = () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!isOnchainReady) {
      toast.error("This release is not ready for checkout yet");
      return;
    }

    addItem(
      product.id,
      product.creativeReleaseId ?? null,
      product.contractKind ?? "productStore",
      product.contractListingId ?? null,
      product.contractProductId ?? null,
      1,
      product.price,
      product.name || "Untitled",
      product.image || "",
    );
    toast.success("Added to cart!");
  };

  const handleSubmitFeedback = async () => {
    if (!id) return;
    if (!address) {
      toast.error("Connect your wallet to leave verified feedback.");
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
        productId: id,
        feedbackType:
          canPublishPublicReview && feedbackForm.visibility === "public"
            ? "review"
            : feedbackForm.feedbackType,
        visibility: canPublishPublicReview ? feedbackForm.visibility : "private",
        rating: canPublishPublicReview && feedbackForm.visibility === "public" ? feedbackForm.rating : null,
        title: feedbackForm.title,
        body: feedbackForm.body,
      });
      setFeedbackForm((prev) => ({ ...prev, title: "", body: "" }));
      setFeedbackOverview(await getProductFeedbackOverview(id));
      toast.success(
        canPublishPublicReview && feedbackForm.visibility === "public"
          ? "Your verified collector review is live."
          : feedbackGate === "subscriber"
            ? "Your gated subscriber thread is now open with the creator."
            : "Your private feedback is in the creator inbox."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send feedback");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleReplyToCreatorThread = async () => {
    if (!id || !address || !selectedCreatorThreadId || !creatorReplyDraft.trim()) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await establishSecureSession(address);
      const message = await sendProductFeedbackMessage(selectedCreatorThreadId, creatorReplyDraft);
      setSelectedCreatorThreadMessages((prev) => [...prev, message]);
      setCreatorReplyDraft("");
      setFeedbackOverview(await getProductFeedbackOverview(id));
      toast.success("Creator reply sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send creator reply");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleReplyToViewerThread = async () => {
    if (!id || !address || !selectedViewerThreadId || !viewerReplyDraft.trim()) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await establishSecureSession(address);
      const message = await sendProductFeedbackMessage(selectedViewerThreadId, viewerReplyDraft);
      setSelectedViewerThreadMessages((prev) => [...prev, message]);
      setViewerReplyDraft("");
      setFeedbackOverview(await getProductFeedbackOverview(id));
      toast.success("Your feedback reply was sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send feedback reply");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleCurateCreatorThread = async (updates: {
    featured?: boolean;
    creatorCurated?: boolean;
    status?: "open" | "closed" | "archived";
    visibility?: "public" | "private";
  }) => {
    if (!id || !address || !selectedCreatorThreadId) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await establishSecureSession(address);
      await curateProductFeedbackThread({
        threadId: selectedCreatorThreadId,
        ...updates,
      });
      setFeedbackOverview(await getProductFeedbackOverview(id));
      toast.success("Feedback thread updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update feedback thread");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate("/products")} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Releases
      </Button>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[2rem] border bg-muted">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground">
                {detailsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "No preview available"}
              </div>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((image) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`overflow-hidden rounded-2xl border ${
                    selectedImage === image ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={image} alt={product.name} className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {product.releaseType || "physical"}
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {product.category}
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tight">{product.name}</h1>
            <p className="text-3xl font-bold">{formatEther(product.price)} ETH</p>
            <p className="leading-7 text-muted-foreground">{product.description}</p>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              {!isOnchainReady && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  This release has not been linked to a live onchain checkout contract yet.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl bg-secondary/50 p-4">
                  <p className="text-muted-foreground">Sold</p>
                  <p className="mt-1 text-lg font-semibold">{product.sold}</p>
                </div>
                <div className="rounded-2xl bg-secondary/50 p-4">
                  <p className="text-muted-foreground">Available</p>
                  <p className="mt-1 text-lg font-semibold">{availableStock}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">Creator wallet</p>
                <p className="mt-2 break-all font-mono text-sm">{product.creator}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleAddToCart} disabled={isSoldOut || !isOnchainReady} size="lg" className="flex-1 gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {isSoldOut ? "Sold Out" : !isOnchainReady ? "Unavailable" : "Add to Cart"}
                </Button>

                {releaseExplorerUrl && (
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <a href={releaseExplorerUrl} target="_blank" rel="noreferrer">
                      View Onchain Art
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6 text-sm">
              Checkout stays onchain, while fulfillment, release access, and marketplace history are tracked in your order flow.
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-12">
        <Tabs defaultValue="physical" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="physical">Physical Details</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="art">Onchain Art</TabsTrigger>
          </TabsList>

          <TabsContent value="physical" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Physical Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {physicalDetailEntries.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {physicalDetailEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl bg-secondary/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{formatDetailValue(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No physical details have been added yet.</p>
                )}

                {creativeRelease?.creator_notes && (
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creator Notes</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{creativeRelease.creator_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Product Pictures</CardTitle>
              </CardHeader>
              <CardContent>
                {galleryImages.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {galleryImages.map((image) => (
                      <button key={image} type="button" onClick={() => setSelectedImage(image)} className="overflow-hidden rounded-2xl border">
                        <img src={image} alt={product.name} className="h-48 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No gallery images yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipping" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Shipping & Fulfillment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shippingEntries.length > 0 ? (
                  shippingEntries.map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-secondary/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{formatDetailValue(value)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Shipping details will appear here once the creator adds them.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="art" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Onchain Art</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The collectible art layer for this release is anchored onchain and linked to the physical object.
                </p>
                <div className="flex flex-wrap gap-3">
                  {releaseExplorerUrl && (
                    <Button asChild variant="outline" className="gap-2">
                      <a href={releaseExplorerUrl} target="_blank" rel="noreferrer">
                        Open Contract
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {artMetadataUrl && (
                    <Button asChild variant="outline" className="gap-2">
                      <a href={artMetadataUrl} target="_blank" rel="noreferrer">
                        Open Art Metadata
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div id="feedback" ref={feedbackSectionRef} className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="h-5 w-5 text-primary" />
              Collector Reviews & Product Threads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : feedbackOverview?.public_threads?.length ? (
              <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-2">
                  {feedbackOverview.public_threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedPublicThreadId(thread.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedPublicThreadId === thread.id ? "border-primary bg-primary/5" : "bg-secondary/20"}`}
                    >
                      <div className="flex flex-wrap gap-2">
                        {thread.featured ? <Badge className="bg-[#dbeafe] text-[#1d4ed8]">Featured</Badge> : null}
                        {thread.creator_curated ? <Badge variant="outline">Curated</Badge> : null}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {thread.title || (thread.feedback_type === "review" ? "Verified collector review" : "Collector thread")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {thread.rating ? `${thread.rating}/5` : "Conversation"} · {thread.feedback_type} · {thread.subscriber_priority ? "subscriber priority" : "collector"}
                      </p>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-foreground/85">
                        {thread.latest_message?.body || "Open feedback thread"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border bg-secondary/10 p-4">
                  {selectedPublicThreadId ? (
                    selectedPublicThreadLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedPublicThreadMessages.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">No messages in this thread yet.</p>
                        ) : (
                          selectedPublicThreadMessages.map((message) => (
                            <div key={message.id} className={`rounded-2xl px-4 py-3 text-sm ${message.sender_role === "creator" ? "mr-10 bg-white text-foreground" : "ml-10 bg-[#eff6ff] text-foreground"}`}>
                              <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {message.sender_role === "creator" ? "Creator" : "Collector"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                      Select a public thread to read the full conversation.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                No public collector reviews yet. The first verified review can come from your collection.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Release Threads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCreatorViewer ? (
              feedbackOverview?.creator_threads?.length ? (
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {feedbackOverview.creator_threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedCreatorThreadId(thread.id)}
                        className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
                          selectedCreatorThreadId === thread.id ? "bg-primary/10" : "bg-background"
                        }`}
                      >
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{thread.visibility}</Badge>
                          <Badge variant="outline">{thread.feedback_type}</Badge>
                          {thread.featured ? <Badge className="bg-[#dbeafe] text-[#1d4ed8]">Featured</Badge> : null}
                          {thread.subscriber_priority ? <Badge className="bg-[#ecfeff] text-[#0f766e]">Subscriber priority</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {thread.title || thread.product?.name || "Product feedback"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {thread.latest_message?.body || "Open feedback thread"}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border bg-secondary/20 p-4">
                    {selectedCreatorThread ? (
                      <>
                        <div className="border-b border-border pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {selectedCreatorThread.title || selectedCreatorThread.product?.name || "Product feedback"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedCreatorThread.feedback_type} · {selectedCreatorThread.visibility} · {selectedCreatorThread.rating ? `${selectedCreatorThread.rating}/5` : "no rating"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedCreatorThread.creator_curated ? <Badge variant="outline">Curated</Badge> : null}
                              {selectedCreatorThread.status !== "open" ? <Badge variant="outline">{selectedCreatorThread.status}</Badge> : null}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleCurateCreatorThread({
                                  featured: !selectedCreatorThread.featured,
                                  creatorCurated: true,
                                })
                              }
                              disabled={feedbackSubmitting}
                              className="rounded-full"
                            >
                              {selectedCreatorThread.featured ? "Unfeature" : "Feature"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleCurateCreatorThread({
                                  visibility: selectedCreatorThread.visibility === "public" ? "private" : "public",
                                  creatorCurated: true,
                                })
                              }
                              disabled={feedbackSubmitting}
                              className="rounded-full"
                            >
                              Make {selectedCreatorThread.visibility === "public" ? "private" : "public"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleCurateCreatorThread({
                                  status: selectedCreatorThread.status === "archived" ? "open" : "archived",
                                })
                              }
                              disabled={feedbackSubmitting}
                              className="rounded-full"
                            >
                              {selectedCreatorThread.status === "archived" ? "Reopen" : "Archive"}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                          {selectedCreatorThreadLoading ? (
                            <div className="flex items-center justify-center py-10">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : selectedCreatorThreadMessages.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
                          ) : (
                            selectedCreatorThreadMessages.map((message) => {
                              const isOwn = message.sender_wallet.toLowerCase() === (address || "").toLowerCase();
                              return (
                                <div
                                  key={message.id}
                                  className={`rounded-2xl px-4 py-3 text-sm ${
                                    isOwn ? "ml-10 bg-[#eff6ff] text-foreground" : "mr-10 bg-white text-foreground"
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                                  <p className="mt-2 text-[11px] text-muted-foreground">
                                    {message.sender_role === "creator"
                                      ? "You"
                                      : selectedCreatorThread.metadata?.thread_gate === "subscriber"
                                        ? "Subscriber"
                                        : "Collector"}
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-3 flex items-end gap-2">
                          <textarea
                            value={creatorReplyDraft}
                            onChange={(event) => setCreatorReplyDraft(event.target.value)}
                            className="min-h-[96px] flex-1 rounded-2xl border border-border bg-background px-3 py-3 text-sm"
                            placeholder="Reply to the collector, thank them, or ask a follow-up..."
                          />
                          <Button
                            onClick={() => void handleReplyToCreatorThread()}
                            disabled={feedbackSubmitting || !creatorReplyDraft.trim()}
                            className="h-11 rounded-full"
                          >
                            {feedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                        Select a thread to manage creator feedback.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No release threads have landed yet. Collector reviews, subscriber notes, and private creator conversations will appear here as soon as someone opens the first thread.
                </div>
              )
            ) : canLeaveFeedback ? (
              <>
                {canPublishPublicReview ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
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
                      variant={feedbackForm.visibility === "private" ? "default" : "outline"}
                      onClick={() =>
                        setFeedbackForm((prev) => ({ ...prev, visibility: "private", feedbackType: "feedback" }))
                      }
                      className="rounded-full"
                    >
                      Private feedback
                    </Button>
                    {feedbackOverview?.viewer_relationship.active_subscription ? (
                      <Badge className="bg-[#ecfeff] text-[#0f766e]">Subscriber priority</Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#99f6e4] bg-[#f0fdfa] p-4 text-sm text-[#0f766e]">
                    Your active subscription unlocks a gated private release thread with the creator. Subscriber comments stay private unless the creator later curates them public.
                  </div>
                )}

                {feedbackForm.visibility === "private" || !canPublishPublicReview ? (
                  <select
                    value={feedbackForm.feedbackType}
                    onChange={(event) =>
                      setFeedbackForm((prev) => ({
                        ...prev,
                        feedbackType: event.target.value as "feedback" | "question" | "review",
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="feedback">Feedback</option>
                    <option value="question">Question</option>
                    {canPublishPublicReview ? <option value="review">Collector note</option> : null}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rating</span>
                    <select
                      value={feedbackForm.rating}
                      onChange={(event) =>
                        setFeedbackForm((prev) => ({ ...prev, rating: Number(event.target.value) || 5 }))
                      }
                      className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} / 5
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  value={feedbackForm.title}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={
                    canPublishPublicReview && feedbackForm.visibility === "public"
                      ? "Review title"
                      : feedbackGate === "subscriber"
                        ? "Optional subject for your subscriber thread"
                        : "Optional subject for the creator"
                  }
                  className="rounded-xl"
                />
                <textarea
                  value={feedbackForm.body}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, body: event.target.value }))}
                  className="min-h-[140px] w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm"
                  placeholder={
                    canPublishPublicReview && feedbackForm.visibility === "public"
                      ? "Tell future collectors what this product felt like to own or use."
                      : feedbackGate === "subscriber"
                        ? "Ask a subscriber-only question, leave a note, or start a gated conversation about this release."
                        : "Send the creator a verified note, request, bug report, or idea from your collection."
                  }
                />
                <Button
                  onClick={() => void handleSubmitFeedback()}
                  disabled={feedbackSubmitting || !feedbackForm.body.trim()}
                  className="w-full rounded-full"
                >
                  {feedbackSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : canPublishPublicReview ? (
                    "Send verified feedback"
                  ) : (
                    "Open subscriber thread"
                  )}
                </Button>

                {feedbackOverview.viewer_threads.length > 0 ? (
                  <div className="rounded-2xl border bg-secondary/20 p-4">
                    <p className="text-sm font-semibold text-foreground">Your active feedback threads</p>
                    <div className="mt-3 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        {feedbackOverview.viewer_threads.map((thread) => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => setSelectedViewerThreadId(thread.id)}
                            className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
                              selectedViewerThreadId === thread.id ? "bg-primary/10" : "bg-background"
                            }`}
                          >
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{thread.visibility}</Badge>
                              <Badge variant="outline">{thread.feedback_type}</Badge>
                              {thread.subscriber_priority ? <Badge className="bg-[#ecfeff] text-[#0f766e]">Subscriber priority</Badge> : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{thread.title || "Feedback thread"}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.latest_message?.body || "Open feedback thread"}</p>
                          </button>
                        ))}
                      </div>

                      <div className="rounded-2xl bg-background p-4">
                        {selectedViewerThreadId ? (
                          <>
                            <div className="border-b border-border pb-3">
                              <p className="text-sm font-semibold text-foreground">
                                {feedbackOverview.viewer_threads.find((thread) => thread.id === selectedViewerThreadId)?.title || "Feedback thread"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Continue the conversation with the creator here.
                              </p>
                            </div>

                            <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                              {selectedViewerThreadLoading ? (
                                <div className="flex items-center justify-center py-10">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              ) : selectedViewerThreadMessages.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No replies yet.</p>
                              ) : (
                                selectedViewerThreadMessages.map((message) => {
                                  const isOwn = message.sender_wallet.toLowerCase() === (address || "").toLowerCase();
                                  return (
                                    <div
                                      key={message.id}
                                      className={`rounded-2xl px-4 py-3 text-sm ${
                                        isOwn ? "ml-10 bg-[#eff6ff] text-foreground" : "mr-10 bg-white text-foreground"
                                      }`}
                                    >
                                      <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                                      <p className="mt-2 text-[11px] text-muted-foreground">
                                        {message.sender_role === "creator"
                                          ? "Creator"
                                          : feedbackOverview.viewer_threads.find((thread) => thread.id === selectedViewerThreadId)?.metadata?.thread_gate === "subscriber"
                                            ? "You · Subscriber"
                                            : "You"}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            <div className="mt-3 flex items-end gap-2">
                              <textarea
                                value={viewerReplyDraft}
                                onChange={(event) => setViewerReplyDraft(event.target.value)}
                                className="min-h-[96px] flex-1 rounded-2xl border border-border bg-background px-3 py-3 text-sm"
                                placeholder="Reply with more context, a follow-up, or a thank you..."
                              />
                              <Button
                                onClick={() => void handleReplyToViewerThread()}
                                disabled={feedbackSubmitting || !viewerReplyDraft.trim()}
                                className="h-11 rounded-full"
                              >
                                {feedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                            Select a thread to read creator replies.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Verified reviews open after this product reaches your collection, and active subscribers can open a gated private thread from the release page even before they collect.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
