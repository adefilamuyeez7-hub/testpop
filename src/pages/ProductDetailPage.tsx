import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useSupabaseProductById } from "@/hooks/useSupabase";
import {
  getCreativeRelease,
  getProductAssets,
  type CreativeRelease,
  type ProductAsset,
} from "@/lib/db";
import { ipfsToHttp, resolveMediaUrl } from "@/lib/pinata";
import { resolveContractProductId, resolveProductMetadataUri } from "@/lib/productMetadata";

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
  const { address } = useAccount();
  const { selectedProduct, setSelectedProduct } = useProductStore();
  const { addItem } = useCartStore();
  const { data: supabaseProduct, loading } = useSupabaseProductById(id);
  const [creativeRelease, setCreativeRelease] = useState<CreativeRelease | null>(null);
  const [productAssets, setProductAssets] = useState<ProductAsset[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");

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
          Back to Marketplace
        </Button>
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const availableStock = product.stock === 0 ? "∞" : product.stock - product.sold;
  const isSoldOut = product.stock > 0 && product.sold >= product.stock;
  const physicalDetails = creativeRelease?.physical_details_jsonb ?? {};
  const shippingProfile = creativeRelease?.shipping_profile_jsonb ?? {};
  const physicalDetailEntries = Object.entries(physicalDetails).filter(([, value]) => formatDetailValue(value));
  const shippingEntries = Object.entries(shippingProfile).filter(([, value]) => formatDetailValue(value));
  const releaseExplorerUrl = creativeRelease?.contract_address
    ? `https://sepolia.basescan.org/address/${creativeRelease.contract_address}`
    : null;
  const artMetadataUrl = creativeRelease?.art_metadata_uri ? ipfsToHttp(creativeRelease.art_metadata_uri) : null;

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

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate("/products")} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
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
    </div>
  );
}
