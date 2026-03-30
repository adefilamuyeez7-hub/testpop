import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Star, ChevronRight, X, Truck, CheckCircle2, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useContracts";
import { Product, CartItem, OrderInfo } from "@/lib/types";
import { toast } from "sonner";
import { useSupabasePublishedProducts } from "@/hooks/useSupabase";

const categories = ["All", "Prints", "Apparel", "Sculptures", "Collectibles", "Zines", "Other"];
const sorts = ["Popular", "Price low-high", "Price high-low"];
const deliverySteps = ["Processing", "Shipped", "Out for Delivery", "Delivered"];

const InvestPage = () => {
  const { isConnected, connectWallet } = useWallet();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Popular");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ name: "", phone: "", street: "", city: "", state: "", notes: "" });
  const { data: supabaseProducts, loading, error } = useSupabasePublishedProducts();
  const [products, setProducts] = useState<Product[]>([]);

  // Convert Supabase products to Product format
  useEffect(() => {
    if (supabaseProducts && supabaseProducts.length > 0) {
      const converted: Product[] = supabaseProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Other",
        priceNaira: Math.floor(parseFloat(p.price_eth) * 400), // Approx conversion
        priceEth: parseFloat(p.price_eth),
        stock: p.stock || 0,
        rating: 4.5, // Default rating
        bestSeller: false,
        image: p.image_url || "",
        nftLink: "https://basescan.org",
        description: p.description || "Premium digital/physical product.",
      }));
      setProducts(converted);
    }
  }, [supabaseProducts]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((item) =>
      (category === "All" || item.category === category) &&
      (item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase()))
    );
    if (sort === "Price low-high") list = [...list].sort((a, b) => a.priceNaira - b.priceNaira);
    if (sort === "Price high-low") list = [...list].sort((a, b) => b.priceNaira - a.priceNaira);
    if (sort === "Popular") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, search, sort, products]);

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-4">
        <h1 className="text-xl font-bold">Marketplace</h1>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-4 space-y-4">
        <h1 className="text-xl font-bold">Marketplace</h1>
        <div className="text-red-500 text-sm">Error: {error.message}</div>
      </div>
    );
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * item.priceNaira, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product, qty = 1) => {
    if (qty < 1) return;
    if (product.stock < qty) {
      toast.error("Not enough stock");
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: Math.min(product.stock, item.quantity + qty) } : item));
      }
      return [...prev, { ...product, quantity: qty }];
    });
    toast.success("Added to cart");
  };

  const updateCartQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, Math.min(item.stock, item.quantity + delta)) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((item) => item.id !== id));

  const confirmCheckout = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!deliveryForm.name || !deliveryForm.phone || !deliveryForm.street || !deliveryForm.city || !deliveryForm.state) {
      toast.error("Complete the delivery form");
      return;
    }
    setOrderInfo({
      items: cartItems,
      total: cartTotal,
      tracking: `TRK${Math.floor(100000 + Math.random() * 899999)}`,
      delivery: `${deliveryForm.city}, ${deliveryForm.state}`,
      estimate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: 0,
    });
    setOrderConfirmed(true);
    setCartItems([]);
    setCheckoutOpen(false);
    toast.success("Order confirmed");
  };

  const advanceTracking = () => {
    if (!orderInfo) return;
    setOrderInfo((prev: OrderInfo | null) => 
      prev 
        ? { ...prev, status: Math.min(prev.status + 1, deliverySteps.length - 1) }
        : prev
    );
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Market</h1>
          <p className="text-sm text-muted-foreground">Jumia-style marketplace with NFT perks.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" className="relative" onClick={() => setCheckoutOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 text-[10px] h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center">{cartCount}</span>}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button key={cat} variant={category === cat ? "secondary" : "outline"} size="sm" onClick={() => setCategory(cat)}>{cat}</Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="flex-1" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
          {sorts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="p-3 rounded-2xl bg-card shadow-card">
            <div className="relative h-44 overflow-hidden rounded-xl">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              <div className="absolute left-2 top-2 flex gap-1">
                {product.bestSeller && <Badge className="text-[10px]">Best Seller</Badge>}
                {product.stock <= 3 && <Badge variant="destructive" className="text-[10px]">{product.stock === 1 ? "1 Left" : "Low Stock"}</Badge>}
              </div>
            </div>
            <div className="mt-2">
              <p className="font-semibold">{product.name}</p>
              <p className="text-[11px] text-muted-foreground">{product.category}</p>
              <div className="flex items-center gap-1 text-[11px] mt-1 text-yellow-500">
                <Star className="h-3 w-3" /> {product.rating}
              </div>
              <p className="text-sm font-bold mt-1">{product.priceNaira.toLocaleString()}  {product.priceEth} ETH</p>
              <p className="text-xs text-muted-foreground">Stock: {product.stock}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={() => setSelectedProduct(product)}>View</Button>
                <Button size="sm" variant="secondary" onClick={() => addToCart(product, 1)}>Add to Cart</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setSelectedProduct(null)}>
          <div className="w-full sm:w-3/4 max-w-lg rounded-2xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold">{selectedProduct.name}</h2>
                <p className="text-xs text-muted-foreground">NFT Perk included</p>
              </div>
              <button onClick={() => setSelectedProduct(null)}><X className="h-4 w-4" /></button>
            </div>
            <img src={selectedProduct.image} alt={selectedProduct.name} className="mt-3 h-48 w-full object-cover rounded-xl" />
            <p className="mt-3 text-sm text-muted-foreground">{selectedProduct.description}</p>
            <p className="mt-2 font-bold">{selectedProduct.priceNaira.toLocaleString()}  {selectedProduct.priceEth} ETH</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => { addToCart(selectedProduct, 1); setSelectedProduct(null); }}>Add to Cart</Button>
              <a href={selectedProduct.nftLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary font-semibold">View NFT</a>
            </div>
          </div>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          {cartItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}  {item.priceNaira * item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" onClick={() => updateCartQty(item.id, -1)}>-</Button>
                      <Button size="icon" onClick={() => updateCartQty(item.id, +1)}>+</Button>
                      <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.id)}></Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Input value={deliveryForm.name} onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })} placeholder="Full name" />
                <Input value={deliveryForm.phone} onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })} placeholder="Phone" />
                <Input value={deliveryForm.street} onChange={(e) => setDeliveryForm({ ...deliveryForm, street: e.target.value })} placeholder="Street" />
                <Input value={deliveryForm.city} onChange={(e) => setDeliveryForm({ ...deliveryForm, city: e.target.value })} placeholder="City" />
                <Input value={deliveryForm.state} onChange={(e) => setDeliveryForm({ ...deliveryForm, state: e.target.value })} placeholder="State" />
                <Textarea value={deliveryForm.notes} onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} placeholder="Delivery notes (optional)" />
              </div>

              <div className="text-right">
                <p className="text-sm">Total: {cartTotal.toLocaleString()}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                <Button onClick={confirmCheckout}>Confirm Order</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {orderConfirmed && orderInfo && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <h3 className="text-sm font-bold">Order Confirmation</h3>
          <p className="text-xs text-muted-foreground">Tracking: {orderInfo.tracking}</p>
          <p className="text-xs text-muted-foreground">Est. delivery: {orderInfo.estimate}</p>
          <p className="text-xs text-muted-foreground">Delivery: {orderInfo.delivery}</p>
          <div className="flex items-center gap-2 mt-2">{deliverySteps.map((step, idx) => (
            <div key={step} className="flex items-center gap-1">
              <span className={idx <= orderInfo.status ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-border'} />
              <span className="text-[10px] text-muted-foreground">{step}</span>
            </div>
          ))}</div>
          <div className="mt-2">
            <Button size="sm" onClick={advanceTracking}>{orderInfo.status === deliverySteps.length - 1 ? 'Delivered' : 'Advance status'}</Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvestPage;
