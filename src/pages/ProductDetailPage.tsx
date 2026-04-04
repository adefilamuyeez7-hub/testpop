import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useSupabaseProductById } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { resolveContractProductId, resolveProductMetadataUri } from "@/lib/productMetadata";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { selectedProduct, setSelectedProduct } = useProductStore();
  const { addItem } = useCartStore();
  const { data: supabaseProduct, loading } = useSupabaseProductById(id);

  const product = useMemo(() => {
    if (selectedProduct?.id === id) {
      return selectedProduct;
    }

    if (!supabaseProduct) {
      return null;
    }

    return {
      id: supabaseProduct.id,
      name: supabaseProduct.name,
      image: resolveMediaUrl(supabaseProduct.image_url, supabaseProduct.image_ipfs_uri),
      price: BigInt(Math.floor(Number(supabaseProduct.price_eth || 0) * 1e18)),
      creator: supabaseProduct.creator_wallet || "0x0",
      description: supabaseProduct.description || "",
      stock: supabaseProduct.stock || 0,
      sold: supabaseProduct.sold || 0,
      category: supabaseProduct.category || "Other",
      contractProductId: resolveContractProductId(supabaseProduct.metadata, supabaseProduct.contract_product_id),
      metadataUri: resolveProductMetadataUri(supabaseProduct.metadata, supabaseProduct.metadata_uri),
    };
  }, [id, selectedProduct, supabaseProduct]);

  useEffect(() => {
    if (product) {
      setSelectedProduct(product);
    }
  }, [product, setSelectedProduct]);

  const isOnchainReady = typeof product?.contractProductId === "number" && product.contractProductId > 0;
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/products")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Button>
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const availableStock = product.stock === 0 ? "∞" : product.stock - product.sold;
  const isSoldOut = product.stock > 0 && product.sold >= product.stock;

  const handleAddToCart = () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!isOnchainReady) {
      toast.error("This product is not ready for checkout yet");
      return;
    }

    addItem(product.id, product.contractProductId ?? null, 1, product.price, product.name, product.image);
    toast.success("Added to cart!");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/products")}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Image */}
        <div className="flex flex-col gap-4">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{product.sold} sold</p>
            <p>{availableStock} in stock</p>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
            <p className="text-muted-foreground mb-4">{product.category}</p>
            <p className="text-3xl font-bold">{formatEther(product.price)} ETH</p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>

              {!isOnchainReady && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  This product has not been linked to the onchain product store yet, so checkout is disabled.
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Creator</h3>
                <p className="font-mono text-sm break-all">{product.creator}</p>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={isSoldOut || !isOnchainReady}
                size="lg"
                className="w-full gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                {isSoldOut ? "Sold Out" : !isOnchainReady ? "Unavailable" : "Add to Cart"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm">
                <span className="font-semibold">Powered by Base Sepolia</span>
                <br />
                Purchase securely on the blockchain with guaranteed authenticity.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Details Tabs */}
      <div className="mt-12">
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="description">Description</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
