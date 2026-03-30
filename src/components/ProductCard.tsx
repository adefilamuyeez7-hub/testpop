import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { useCartStore } from "@/stores/cartStore";
import { formatEther } from "viem";

interface ProductCardProps {
  id: number;
  name: string;
  image: string;
  price: bigint;
  creator: string;
  description: string;
  stock: number;
  sold: number;
}

export function ProductCard({ id, name, image, price, creator, description, stock, sold }: ProductCardProps) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [isAdding, setIsAdding] = useState(false);
  const { addItem, setLoading } = useCartStore();

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    setIsAdding(true);
    try {
      addItem(id, 1, price, name, image);
    } finally {
      setIsAdding(false);
    }
  };

  const availableStock = stock === 0 ? "∞" : `${stock - sold} left`;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/products/${id}`)}
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
          disabled={isAdding || (stock > 0 && sold >= stock)}
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
              Add to Cart
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
