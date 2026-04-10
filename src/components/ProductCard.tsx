import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { formatEther } from "viem";
import { toast } from "sonner";
import { resolveContractProductId } from "@/lib/productMetadata";

interface ProductCardProps {
  id: string;
  creativeReleaseId?: string | null;
  name: string;
  image: string;
  price: bigint;
  creator: string;
  description: string;
  stock: number;
  sold: number;
  releaseType?: "collectible" | "physical" | "hybrid";
  contractKind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | null;
  contractListingId?: number | null;
  category?: string;
  contractProductId?: number | null;
  metadataUri?: string | null;
}

export function ProductCard({
  id,
  creativeReleaseId,
  name,
  image,
  price,
  creator,
  description,
  stock,
  sold,
  releaseType,
  contractKind,
  contractListingId,
  contractProductId,
  metadataUri,
  category,
}: ProductCardProps) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCartStore();
  const { setSelectedProduct } = useProductStore();
  const resolvedContractProductId = resolveContractProductId(null, contractProductId);
  const isOnchainReady =
    (contractKind === "creativeReleaseEscrow" && typeof contractListingId === "number" && contractListingId > 0) ||
    (typeof resolvedContractProductId === "number" && resolvedContractProductId > 0);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsAdding(true);
    try {
      if (!isOnchainReady) {
        toast.error("This product is not ready for checkout yet");
        return;
      }

      addItem(
        id,
        creativeReleaseId ?? null,
        contractKind ?? "productStore",
        contractListingId ?? null,
        resolvedContractProductId ?? null,
        1,
        price,
        name,
        image,
      );
      toast.success("Added to cart");
    } finally {
      setIsAdding(false);
    }
  };

  const availableStock = stock === 0 ? "∞" : `${stock - sold} left`;

  return (
      <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => {
        setSelectedProduct({
          id,
          name,
          image,
          price,
          creator,
          description,
          stock,
          sold,
          releaseType,
          contractKind,
          contractListingId,
          category,
          contractProductId,
          metadataUri,
        });
        navigate(`/products/${id}`);
      }}
    >
      <div className="relative w-full h-48 bg-muted overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover hover:scale-105 transition-transform"
        />
        {stock > 0 && sold >= stock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold">Sold Out</span>
          </div>
        )}
        {releaseType && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
            {releaseType}
          </div>
        )}
      </div>
      <CardHeader className="pb-3">
        <CardTitle className="line-clamp-2 text-base">{name}</CardTitle>
        <CardDescription className="line-clamp-1">{creator}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold">{formatEther(price)} ETH</p>
          <p className="text-xs text-muted-foreground">{availableStock}</p>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        <Button
          onClick={handleQuickAdd}
          disabled={isAdding || (stock > 0 && sold >= stock) || !isOnchainReady}
          className="w-full gap-2"
          size="sm"
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              {isOnchainReady ? "Add to Cart" : "Unavailable"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProductGrid({ products }: { products: ProductCardProps[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
