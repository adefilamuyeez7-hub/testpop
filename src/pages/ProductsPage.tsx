import { useEffect, useMemo, useState } from "react";
import { Search, Filter, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { ProductCard, ProductGrid } from "@/components/ProductCard";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { useSupabasePublishedProducts } from "@/hooks/useSupabase";
import { resolveMediaUrl } from "@/lib/pinata";
import { extractContractProductId, extractProductMetadataUri } from "@/lib/productMetadata";

function mapSupabaseProductToStoreProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    image: resolveMediaUrl(p.image_url, p.image_ipfs_uri),
    price: BigInt(Math.floor(parseFloat(p.price_eth) * 1e18)),
    creator: p.creator_wallet || "0x0",
    description: p.description || "",
    stock: p.stock || 0,
    sold: p.sold || 0,
    category: p.category || "Other",
    contractProductId: extractContractProductId(p.metadata),
    metadataUri: extractProductMetadataUri(p.metadata),
  };
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { setProducts } = useProductStore();
  const { getTotalItems } = useCartStore();
  const { data: supabaseProducts, loading, error } = useSupabasePublishedProducts();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [category, setCategory] = useState("all");

  // Initialize with Supabase products
  useEffect(() => {
    if (supabaseProducts && supabaseProducts.length > 0) {
      console.log("📦 Loading products from Supabase:", supabaseProducts.length);
      setProducts(supabaseProducts.map(mapSupabaseProductToStoreProduct));
      return;
    }

    setProducts([]);
  }, [supabaseProducts, setProducts]);

  const totalCartItems = getTotalItems();
  const filteredByCategory = useMemo(() => {
    let products = (supabaseProducts || []).map(mapSupabaseProductToStoreProduct);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      products = products.filter((product) =>
        product.name?.toLowerCase().includes(normalizedQuery) ||
        product.description?.toLowerCase().includes(normalizedQuery)
      );
    }

    if (category !== "all") {
      products = products.filter((product) => product.category === category);
    }

    if (sortOrder === "price-low") {
      products = [...products].sort((a, b) => Number(a.price - b.price));
    } else if (sortOrder === "price-high") {
      products = [...products].sort((a, b) => Number(b.price - a.price));
    }

    return products;
  }, [category, searchQuery, sortOrder, supabaseProducts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Shop</h1>
              <p className="text-muted-foreground">Discover exclusive artist merchandise</p>
            </div>
            <Button
              onClick={() => navigate("/cart")}
              className="gap-2 relative"
              variant="outline"
            >
              <ShoppingCart className="w-5 h-5" />
              Cart
              {totalCartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {totalCartItems}
                </span>
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Merchandise">Merchandise</SelectItem>
                <SelectItem value="Prints">Prints</SelectItem>
                <SelectItem value="Digital">Digital</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-12">
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading products from Supabase...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">Error loading products</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </div>
        )}
        {!loading && !error && filteredByCategory.length > 0 ? (
          <>
            <p className="text-muted-foreground mb-6">
              {filteredByCategory.length} product{filteredByCategory.length !== 1 ? "s" : ""} found
            </p>
            <ProductGrid products={filteredByCategory} />
          </>
        ) : (
          !loading && !error && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No products found</p>
              <Button onClick={() => setSearchQuery("")} variant="outline">
                Clear Filters
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
