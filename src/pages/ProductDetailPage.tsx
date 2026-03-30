import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { selectedProduct, setSelectedProduct } = useProductStore();
  const { addItem } = useCartStore();

  // Product data fetched from Supabase via productStore
  // TODO: Fetch real product from contract/Supabase if ID provided
  const product = selectedProduct;
  
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
      alert("Please connect your wallet first");
      return;
    }

    addItem(product.id, 1, product.price, product.name, product.image);
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

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Creator</h3>
                <p className="font-mono text-sm break-all">{product.creator}</p>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={isSoldOut}
                size="lg"
                className="w-full gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                {isSoldOut ? "Sold Out" : "Add to Cart"}
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
