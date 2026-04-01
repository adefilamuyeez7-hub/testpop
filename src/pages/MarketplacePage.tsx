import { useEffect, useMemo, useState } from "react";
import artist1 from "@/assets/artist-1.jpg";
import artist2 from "@/assets/artist-2.jpg";
import artDrop1 from "@/assets/art-drop-1.jpg";
import artDrop2 from "@/assets/art-drop-2.jpg";
import artDrop3 from "@/assets/art-drop-3.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart, Search, Filter, Star, AlertTriangle, Truck, MapPin,
  Plus, Minus, Trash2, ArrowLeft, Package, CheckCircle2, ChevronRight,
  Tag, Zap, Sparkles,
} from "lucide-react";
import { useWallet } from "@/hooks/useContracts";
import { toast } from "sonner";
import { recordPageVisit, recordProductView } from "@/lib/analyticsStore";
import {
  CHECKOUT_COUNTRIES,
  detectCheckoutCountry,
  formatCheckoutPhone,
  getCheckoutCountryMeta,
  type CheckoutCountry,
} from "@/lib/checkout";
import {
  createOrder as dbCreateOrder,
  getOrdersByBuyer,
  getProducts as dbGetProducts,
  updateProduct as dbUpdateProduct,
} from "@/lib/db";
import { getOrCreateGuestCustomerId } from "@/lib/runtimeSession";
import { resolveMediaUrl } from "@/lib/pinata";

// ─── Types ────────────────────────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  artist: string;
  category: string;
  priceEth: number;
  rating: number;
  reviews: number;
  stock: number;
  image: string;
  nftPerk: string;
  badge?: string;
  description: string;
};

type CartItem = Product & { qty: number };

type Order = {
  id: string;
  items: CartItem[];
  total: number;
  totalLocal?: string;
  currency?: string;
  status: "processing" | "shipped" | "out_for_delivery" | "delivered";
  trackingCode: string;
  address: string;
  date: string;
  estimatedDelivery: string;
};

type AdminProduct = {
  id: string;
  name: string;
  category: string;
  priceEth: string;
  stock: number;
  sold: number;
  status: "active" | "draft" | "out_of_stock";
  nftLink: string;
  uploadedAt: string;
  description: string;
  image?: string;
  imageUri?: string;
};

type AdminOrder = {
  id: string;
  productId?: string;
  product: string;
  buyer: string;
  buyerWallet?: string;
  customerKey?: string;
  qty: number;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  address: string;
  date: string;
  trackingCode: string;
  unitPriceEth?: string;
  totalPriceEth?: string;
  currency?: string;
  totalLocal?: string;
};

const CATEGORIES = ["All", "Prints", "Apparel", "Sculptures", "Collectibles", "Zines"];

const DELIVERY_STEPS: Record<Order["status"], number> = {
  processing: 0, shipped: 1, out_for_delivery: 2, delivered: 3,
};
const DELIVERY_LABELS = ["Processing", "Shipped", "Out for Delivery", "Delivered"];
const DEFAULT_ETH_RATES = {
  NGN: 4200000,
  USD: 3800,
  GBP: 3000,
  CAD: 5150,
  EUR: 3500,
} as const;

type SupportedCurrency = keyof typeof DEFAULT_ETH_RATES;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeStoredProduct(product: Partial<AdminProduct> & { id?: string; name?: string }): AdminProduct {
  return {
    id: product.id ?? `mp${Date.now()}`,
    name: product.name ?? "Untitled Product",
    category: product.category ?? "Other",
    priceEth: product.priceEth ?? "0",
    stock: Number(product.stock ?? 0),
    sold: Number(product.sold ?? 0),
    status: product.status ?? "draft",
    nftLink: product.nftLink ?? "#",
    uploadedAt: product.uploadedAt ?? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    description: product.description ?? "",
    image: product.image ?? "",
    imageUri: product.imageUri ?? "",
  };
}

async function fetchEthRates(): Promise<Record<SupportedCurrency, number>> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=ngn,usd,gbp,cad,eur"
  );

  if (!response.ok) {
    throw new Error("Unable to fetch ETH rates");
  }

  const data = (await response.json()) as {
    ethereum?: Partial<Record<Lowercase<SupportedCurrency>, number>>;
  };

  return {
    NGN: data.ethereum?.ngn ?? DEFAULT_ETH_RATES.NGN,
    USD: data.ethereum?.usd ?? DEFAULT_ETH_RATES.USD,
    GBP: data.ethereum?.gbp ?? DEFAULT_ETH_RATES.GBP,
    CAD: data.ethereum?.cad ?? DEFAULT_ETH_RATES.CAD,
    EUR: data.ethereum?.eur ?? DEFAULT_ETH_RATES.EUR,
  };
}

function formatLocalPrice(ethAmount: number, country: CheckoutCountry, rates: Record<SupportedCurrency, number>) {
  const { currency, locale } = getCheckoutCountryMeta(country);
  const converted = ethAmount * rates[currency];

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(converted);
}

function getFallbackVisuals(category: string, name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("tee") || lowerName.includes("hoodie")) {
    return { image: artist1, artist: "PopUp Artist", nftPerk: "Unlock creator perks with this purchase." };
  }
  if (lowerName.includes("zine")) {
    return { image: artist2, artist: "PopUp Artist", nftPerk: "Includes bonus digital content tied to your order." };
  }
  if (category === "Sculptures") {
    return { image: artDrop2, artist: "PopUp Artist", nftPerk: "Includes a collectible NFT certificate." };
  }
  if (category === "Collectibles") {
    return { image: artDrop3, artist: "PopUp Artist", nftPerk: "Purchase qualifies for collectible holder rewards." };
  }
  return { image: artDrop1, artist: "PopUp Artist", nftPerk: "Includes an NFT-linked collector perk." };
}

function productBadge(stock: number) {
  if (stock === 1) return "1 Left";
  if (stock > 1 && stock <= 2) return "Low Stock";
  return undefined;
}

function mapAdminProductToMarketplace(product: AdminProduct): Product {
  const fallback = {
    ...getFallbackVisuals(product.category, product.name),
    rating: 4.6,
    reviews: 0,
  };

  return {
    id: product.id,
    name: product.name,
    artist: fallback.artist,
    category: product.category,
    priceEth: Number(product.priceEth),
    rating: fallback.rating,
    reviews: fallback.reviews,
    stock: product.stock,
    image: resolveMediaUrl(product.image, product.imageUri) || fallback.image,
    nftPerk: fallback.nftPerk,
    badge: productBadge(product.stock),
    description: product.description,
  };
}

function getCustomerKey(wallet?: string) {
  const normalizedWallet = wallet?.trim().toLowerCase();
  if (normalizedWallet) return `wallet:${normalizedWallet}`;
  return getOrCreateGuestCustomerId();
}

function mapAdminOrderToMarketplace(order: AdminOrder, adminProducts: AdminProduct[]): Order {
  const matchedProduct = adminProducts.find(
    (item) => item.id === order.productId || item.name === order.product
  );
  const displayProduct = matchedProduct
    ? mapAdminProductToMarketplace(matchedProduct)
    : {
        id: order.id,
        name: order.product,
        ...getFallbackVisuals("Other", order.product),
        category: "Other",
        priceEth: 0,
        rating: 4.5,
        reviews: 0,
        stock: 0,
        badge: undefined,
        description: order.product,
      };

  const mappedStatus: Order["status"] =
    order.status === "pending"
      ? "processing"
      : order.status === "shipped"
      ? "shipped"
      : order.status === "delivered"
      ? "delivered"
      : "processing";

  return {
    id: order.id,
    items: [{ ...displayProduct, qty: order.qty }],
    total: Number(order.totalPriceEth ?? displayProduct.priceEth * order.qty),
    totalLocal: order.totalLocal,
    currency: order.currency,
    status: mappedStatus,
    trackingCode: order.trackingCode,
    address: order.address,
    date: order.date,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

// ─── Sub-views ───────────────────────────────────────────────────────────────
type View = "home" | "product" | "cart" | "checkout" | "orders";

// ─── Main Component ───────────────────────────────────────────────────────────
const MarketplacePage = () => {
  const { address, isConnected, connectWallet } = useWallet();
  const customerKey = getCustomerKey(address);

  // Navigation state
  const [view, setView] = useState<View>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Catalogue state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"popular" | "price_low" | "price_high">("popular");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);

  // Checkout form
  const [checkoutForm, setCheckoutForm] = useState({
    name: "", phone: "", address: "", city: "", state: "", country: detectCheckoutCountry(), notes: "",
  });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [ethRates, setEthRates] = useState<Record<SupportedCurrency, number>>(DEFAULT_ETH_RATES);
  const [hasLiveRates, setHasLiveRates] = useState(false);

  // Filter drawer
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    recordPageVisit();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      const products = await dbGetProducts();
      if (!active) return;

      const mappedProducts = (products || [])
        .map((product) =>
          normalizeStoredProduct({
            id: product.id,
            name: product.name,
            category: product.category || "Other",
            priceEth: String(product.price_eth || 0),
            stock: Number(product.stock || 0),
            sold: Number(product.sold || 0),
            status:
              product.status === "published"
                ? "active"
                : ((product.status as AdminProduct["status"]) || "draft"),
            nftLink: "#",
            description: product.description || "",
            image: product.image_url || "",
            imageUri: product.image_ipfs_uri || "",
          })
        )
        .filter((product) => product.status === "active")
        .map(mapAdminProductToMarketplace);

      setCatalogProducts(mappedProducts);
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchEthRates()
      .then((rates) => {
        if (cancelled) return;
        setEthRates(rates);
        setHasLiveRates(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHasLiveRates(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedProduct?.id) {
      recordProductView(selectedProduct.id);
    }
  }, [selectedProduct?.id]);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      if (!address) {
        setOrders([]);
        return;
      }

      const buyerOrders = await getOrdersByBuyer(address.toLowerCase());
      if (!active) return;

      const adminProducts = catalogProducts.map((product) =>
        normalizeStoredProduct({
          id: product.id,
          name: product.name,
          category: product.category,
          priceEth: product.priceEth.toString(),
          stock: product.stock,
          sold: 0,
          status: product.stock > 0 ? "active" : "out_of_stock",
          nftLink: "#",
          description: product.description,
          image: product.image,
        })
      );

      const mappedOrders = (buyerOrders || []).map((order: any) =>
        mapAdminOrderToMarketplace(
          {
            id: order.id,
            productId: order.product_id || undefined,
            product:
              adminProducts.find((product) => product.id === order.product_id)?.name ||
              order.product_id ||
              "Unknown product",
            buyer: order.buyer_wallet || address,
            buyerWallet: order.buyer_wallet,
            customerKey,
            qty: Number(order.quantity || 0),
            status: order.status || "pending",
            address: order.shipping_address || "",
            date: new Date(order.created_at || Date.now()).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            trackingCode: order.tracking_code || "Pending",
            unitPriceEth: undefined,
            totalPriceEth: String(order.total_price_eth || 0),
          },
          adminProducts
        )
      );

      setOrders(mappedOrders);
    }

    void loadOrders();

    return () => {
      active = false;
    };
  }, [address, customerKey, catalogProducts]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (product: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i);
      }
      return [...prev, { ...product, qty }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      if (newQty <= 0) return i; // don't remove on decrement to 0, use trash
      return { ...i, qty: Math.min(newQty, i.stock) };
    }));
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.priceEth * i.qty, 0);
  const displayCountry = checkoutForm.country;
  const displayCountryMeta = getCheckoutCountryMeta(displayCountry);
  const cartTotalLocal = formatLocalPrice(cartTotal, displayCountry, ethRates);

  // ── Filtered products ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = catalogProducts.filter(p =>
      (category === "All" || p.category === category) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.artist.toLowerCase().includes(search.toLowerCase()))
    );
    if (sortBy === "price_low") list = [...list].sort((a, b) => a.priceEth - b.priceEth);
    if (sortBy === "price_high") list = [...list].sort((a, b) => b.priceEth - a.priceEth);
    if (sortBy === "popular") list = [...list].sort((a, b) => b.reviews - a.reviews);
    return list;
  }, [catalogProducts, category, search, sortBy]);

  // ── Place order ─────────────────────────────────────────────────────────────
const placeOrder = async () => {
    if (!isConnected) { connectWallet(); return; }
    if (!address) {
      toast.error("Wallet address unavailable");
      return;
    }
    if (!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address) {
      toast.error("Fill in name, phone, and address");
      return;
    }
    setIsPlacingOrder(true);

    const formattedPhone = formatCheckoutPhone(checkoutForm.country, checkoutForm.phone);
    const newOrder: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      items: [...cart],
      total: cartTotal,
      status: "processing",
      trackingCode: `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      address: [
        checkoutForm.address,
        checkoutForm.city,
        checkoutForm.state,
        checkoutForm.country,
        `Phone: ${formattedPhone}`,
      ].filter(Boolean).join(", "),
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    };

    try {
      for (const item of cart) {
        const matchedProduct = catalogProducts.find((product) => product.id === item.id);
        const nextStock = Math.max(0, (matchedProduct?.stock || item.stock) - item.qty);

        await dbCreateOrder({
          product_id: item.id,
          buyer_wallet: address.toLowerCase(),
          quantity: item.qty,
          total_price_eth: item.priceEth * item.qty,
          status: "pending",
          shipping_address: newOrder.address,
          tracking_code: `${newOrder.trackingCode}-${item.id.slice(0, 4)}`,
        });

        await dbUpdateProduct(item.id, {
          stock: nextStock,
          status: nextStock > 0 ? "published" : "out_of_stock",
        });
      }

      const refreshedProducts = await dbGetProducts();
      const mappedProducts = (refreshedProducts || [])
        .map((product) =>
          normalizeStoredProduct({
            id: product.id,
            name: product.name,
            category: product.category || "Other",
            priceEth: String(product.price_eth || 0),
            stock: Number(product.stock || 0),
            sold: Number(product.sold || 0),
            status:
              product.status === "published"
                ? "active"
                : ((product.status as AdminProduct["status"]) || "draft"),
            nftLink: "#",
            description: product.description || "",
            image: product.image_url || "",
            imageUri: product.image_ipfs_uri || "",
          })
        )
        .filter((product) => product.status === "active")
        .map(mapAdminProductToMarketplace);

      setCatalogProducts(mappedProducts);
      setOrders((prev) => [newOrder, ...prev]);
      setLastOrder(newOrder);
      setCart([]);
      setShowOrderSuccess(true);
    } catch (error) {
      console.error("Failed to place marketplace order:", error);
      toast.error("Order placement failed");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // ── Views ───────────────────────────────────────────────────────────────────

  // HOME VIEW
  if (view === "home") return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Marketplace</h1>
            <p className="text-xs text-muted-foreground">Artist goods with NFT perks</p>
          </div>
          <button onClick={() => setView("cart")} className="relative p-2 rounded-full bg-secondary">
            <ShoppingCart className="h-5 w-5 text-foreground" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, artists..."
            className="pl-9 h-10 rounded-xl bg-secondary border-0"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Sort + count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} items</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(true)} className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Sort
            </button>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="px-4">
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-lg font-semibold text-foreground">No products live yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Founder-added products will show here once they are published.
            </p>
          </div>
        </div>
      ) : (
      <div className="px-4 grid grid-cols-2 gap-3">
        {filtered.map(p => (
          <button key={p.id} onClick={() => { setSelectedProduct(p); setView("product"); }}
            className="rounded-2xl bg-card shadow-card overflow-hidden text-left group">
            <div className="relative aspect-square overflow-hidden">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              {p.badge && (
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  {p.badge}
                </span>
              )}
              {p.stock <= 2 && (
                <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-white">
                  {p.stock} left
                </span>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-[11px] text-muted-foreground truncate">{p.artist}</p>
              <p className="text-xs font-semibold text-card-foreground line-clamp-2 mt-0.5 leading-tight">{p.name}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="text-[10px] text-muted-foreground">{p.rating} ({p.reviews})</span>
              </div>
              <p className="text-sm font-bold text-primary mt-1">{formatLocalPrice(p.priceEth, displayCountry, ethRates)}</p>
              <p className="text-[10px] text-muted-foreground">{p.priceEth} ETH</p>
              <button
                onClick={e => { e.stopPropagation(); addToCart(p); }}
                className="mt-2 w-full py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                Add to cart
              </button>
            </div>
          </button>
        ))}
      </div>
      )}

      {/* Orders shortcut */}
      {orders.length > 0 && (
        <button onClick={() => setView("orders")}
          className="mx-4 mt-4 w-[calc(100%-32px)] flex items-center justify-between p-3 rounded-2xl bg-card shadow-card">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-card-foreground">My Orders</p>
              <p className="text-[10px] text-muted-foreground">{orders.length} order{orders.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Sort Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle>Sort by</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {[["popular", "Most Popular"], ["price_low", "Price: Low to High"], ["price_high", "Price: High to Low"]] .map(([val, label]) => (
              <button key={val} onClick={() => { setSortBy(val as any); setShowFilters(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${sortBy === val ? "bg-primary/10 text-primary font-semibold" : "bg-secondary text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // PRODUCT DETAIL VIEW
  if (view === "product" && selectedProduct) {
    const p = selectedProduct;
    const inCart = cart.find(i => i.id === p.id);
    return (
      <div className="pb-32">
        <div className="relative aspect-square overflow-hidden">
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
          <button onClick={() => setView("home")} className="absolute top-3 left-3 p-2 rounded-full bg-background/70 backdrop-blur-sm">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <button onClick={() => setView("cart")} className="absolute top-3 right-3 p-2 rounded-full bg-background/70 backdrop-blur-sm relative">
            <ShoppingCart className="h-4 w-4 text-foreground" />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
              {p.badge && <Badge className="text-[10px] bg-primary text-primary-foreground">{p.badge}</Badge>}
            </div>
            <h1 className="text-lg font-bold text-foreground">{p.name}</h1>
            <p className="text-xs text-muted-foreground">by {p.artist}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => <Star key={s} className={`h-4 w-4 ${s <= Math.floor(p.rating) ? "fill-primary text-primary" : "text-border"}`} />)}
            </div>
            <span className="text-xs text-muted-foreground">{p.rating} · {p.reviews} reviews</span>
          </div>

          <div>
            <p className="text-2xl font-bold text-primary">{formatLocalPrice(p.priceEth, displayCountry, ethRates)}</p>
            <p className="text-sm text-muted-foreground">{p.priceEth} ETH</p>
          </div>

          <p className="text-sm text-muted-foreground font-body leading-relaxed">{p.description}</p>

          {/* NFT Perk */}
          <div className="p-3 rounded-xl bg-accent border border-border flex items-start gap-2">
            <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">NFT Perk</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{p.nftPerk}</p>
            </div>
          </div>

          {/* Delivery info */}
          <div className="p-3 rounded-xl bg-secondary flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">Estimated delivery: <span className="font-semibold text-foreground">3–5 business days</span></p>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> {p.stock} in stock
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-3 pt-2 bg-background/90 backdrop-blur-xl border-t border-border">
          {inCart ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-secondary rounded-xl px-3 py-2">
                <button onClick={() => updateQty(p.id, -1)} className="p-1"><Minus className="h-4 w-4 text-foreground" /></button>
                <span className="flex-1 text-center text-sm font-semibold">{inCart.qty}</span>
                <button onClick={() => updateQty(p.id, 1)} className="p-1"><Plus className="h-4 w-4 text-foreground" /></button>
              </div>
              <Button onClick={() => setView("cart")} className="flex-1 rounded-xl gradient-primary text-primary-foreground h-11 font-semibold">
                View Cart · {inCart.qty}
              </Button>
            </div>
          ) : (
            <Button onClick={() => addToCart(p)} disabled={p.stock === 0}
              className="w-full rounded-xl gradient-primary text-primary-foreground h-11 font-semibold">
              {p.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // CART VIEW
  if (view === "cart") return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => setView("home")} className="p-2 rounded-full bg-secondary">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold flex-1">Cart</h1>
        {cartCount > 0 && <span className="text-xs text-muted-foreground">{cartCount} item{cartCount > 1 ? "s" : ""}</span>}
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <ShoppingCart className="h-16 w-16 text-border mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">Your cart is empty</p>
          <p className="text-sm text-muted-foreground mb-6">Discover artist goods with NFT perks</p>
          <Button onClick={() => setView("home")} className="rounded-full gradient-primary text-primary-foreground">Browse Marketplace</Button>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="p-3 rounded-2xl bg-card shadow-card flex gap-3">
              <div className="h-20 w-20 rounded-xl overflow-hidden shrink-0">
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-card-foreground line-clamp-2">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{item.artist}</p>
                <p className="text-sm font-bold text-primary mt-1">{formatLocalPrice(item.priceEth * item.qty, displayCountry, ethRates)}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1">
                    <button onClick={() => updateQty(item.id, -1)} className="text-foreground"><Minus className="h-3 w-3" /></button>
                    <span className="text-xs font-semibold w-4 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="text-foreground"><Plus className="h-3 w-3" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Order summary */}
          <div className="p-4 rounded-2xl bg-card shadow-card space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span><span>{cartTotalLocal}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Delivery</span><span className="text-primary">Free</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-foreground">
              <span>Total</span><span>{cartTotalLocal}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{cartTotal.toFixed(4)} ETH · includes NFT perks</p>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-3 pt-2 bg-background/90 backdrop-blur-xl border-t border-border">
          <Button onClick={() => setView("checkout")} className="w-full rounded-xl gradient-primary text-primary-foreground h-11 font-semibold">
            Checkout · {cartTotalLocal}
          </Button>
        </div>
      )}
    </div>
  );

  // CHECKOUT VIEW
  if (view === "checkout") return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => setView("cart")} className="p-2 rounded-full bg-secondary">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold">Checkout</h1>
      </div>

      {showOrderSuccess && lastOrder ? (
        <div className="px-4 flex flex-col items-center text-center py-8 space-y-4">
          <CheckCircle2 className="h-20 w-20 text-primary" />
          <h2 className="text-xl font-bold">Order Placed!</h2>
          <p className="text-sm text-muted-foreground">Your order <span className="font-mono font-semibold text-foreground">{lastOrder.id}</span> has been confirmed.</p>
          <div className="w-full p-4 rounded-2xl bg-card shadow-card text-left space-y-2">
            <p className="text-xs text-muted-foreground">Tracking code</p>
            <p className="font-mono font-bold text-foreground">{lastOrder.trackingCode}</p>
            <p className="text-xs text-muted-foreground mt-2">Estimated delivery</p>
            <p className="text-sm font-semibold text-foreground">{lastOrder.estimatedDelivery}</p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowOrderSuccess(false); setView("orders"); }}>
              Track Order
            </Button>
            <Button className="flex-1 rounded-xl gradient-primary text-primary-foreground" onClick={() => { setShowOrderSuccess(false); setView("home"); }}>
              Continue Shopping
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {/* Delivery address form */}
          <div className="p-4 rounded-2xl bg-card shadow-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Delivery Address
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Full Name</Label>
                <Input value={checkoutForm.name} onChange={e => setCheckoutForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <div className="flex rounded-lg border border-border bg-background">
                  <div className="flex items-center border-r border-border px-3 text-sm text-muted-foreground">
                    {displayCountryMeta.dialCode}
                  </div>
                  <Input
                    value={checkoutForm.phone}
                    onChange={e => setCheckoutForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={displayCountryMeta.phonePlaceholder}
                    className="h-9 rounded-none border-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <select
                value={checkoutForm.country}
                onChange={e => setCheckoutForm(f => ({ ...f, country: e.target.value as CheckoutCountry }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                {CHECKOUT_COUNTRIES.map((country) => (
                  <option key={country.name} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Street Address</Label>
              <Input value={checkoutForm.address} onChange={e => setCheckoutForm(f => ({ ...f, address: e.target.value }))} placeholder="12 Main Street, GRA" className="h-9 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">City</Label>
                <Input value={checkoutForm.city} onChange={e => setCheckoutForm(f => ({ ...f, city: e.target.value }))} placeholder="Lagos" className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <Label className="text-xs">State / Region</Label>
                <Input value={checkoutForm.state} onChange={e => setCheckoutForm(f => ({ ...f, state: e.target.value }))} placeholder="California" className="h-9 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Delivery Notes (optional)</Label>
              <Input value={checkoutForm.notes} onChange={e => setCheckoutForm(f => ({ ...f, notes: e.target.value }))} placeholder="Landmark, instructions..." className="h-9 rounded-lg text-sm" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {hasLiveRates ? "Live" : "Estimated"} ETH conversion shown in {displayCountry} currency.
            </p>
          </div>

          {/* Order items summary */}
          <div className="p-4 rounded-2xl bg-card shadow-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Items ({cartCount})</h3>
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0">
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">Qty: {item.qty}</p>
                </div>
                <p className="text-xs font-bold text-primary">{formatLocalPrice(item.priceEth * item.qty, displayCountry, ethRates)}</p>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-foreground">
              <span>Total</span><span>{cartTotalLocal}</span>
            </div>
          </div>

          {/* Payment note */}
          <div className="p-3 rounded-xl bg-accent border border-border flex items-start gap-2">
            <Tag className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">Payment via ETH on Base. Connect wallet to confirm. NFT perks are minted on purchase.</p>
          </div>
        </div>
      )}

      {!showOrderSuccess && (
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-3 pt-2 bg-background/90 backdrop-blur-xl border-t border-border">
          <Button
            onClick={placeOrder}
            disabled={isPlacingOrder}
            className="w-full rounded-xl gradient-primary text-primary-foreground h-11 font-semibold"
          >
            {isPlacingOrder ? "Placing Order..." : `Place Order · ${cartTotalLocal}`}
          </Button>
        </div>
      )}
    </div>
  );

  // ORDERS / TRACKING VIEW
  if (view === "orders") return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => setView("home")} className="p-2 rounded-full bg-secondary">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center px-8">
          <Package className="h-16 w-16 text-border mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">No orders yet</p>
          <Button onClick={() => setView("home")} className="mt-4 rounded-full gradient-primary text-primary-foreground">Shop Now</Button>
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {orders.map(order => {
            const step = DELIVERY_STEPS[order.status];
            return (
              <div key={order.id} className="p-4 rounded-2xl bg-card shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground font-mono">{order.id}</p>
                    <p className="text-[10px] text-muted-foreground">{order.date} · {order.items.length} item{order.items.length > 1 ? "s" : ""}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${
                    order.status === "delivered" ? "bg-green-100 text-green-800" :
                    order.status === "shipped" || order.status === "out_for_delivery" ? "bg-blue-100 text-blue-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Tracking stepper */}
                <div className="relative">
                  <div className="absolute top-3 left-3 right-3 h-0.5 bg-secondary" />
                  <div
                    className="absolute top-3 left-3 h-0.5 bg-primary transition-all"
                    style={{ width: `${(step / 3) * 100}%` }}
                  />
                  <div className="relative flex justify-between">
                    {DELIVERY_LABELS.map((label, i) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center z-10 ${i <= step ? "bg-primary border-primary" : "bg-background border-border"}`}>
                          {i < step ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> :
                           i === step ? <div className="h-2 w-2 rounded-full bg-white" /> :
                           <div className="h-2 w-2 rounded-full bg-border" />}
                        </div>
                        <p className="text-[9px] text-muted-foreground text-center w-14 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Tracking: <span className="font-mono font-semibold text-foreground ml-1">{order.trackingCode}</span></div>
                  <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.address}</div>
                  {order.status !== "delivered" && (
                    <div className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Est. delivery: <span className="font-semibold text-foreground ml-1">{order.estimatedDelivery}</span></div>
                  )}
                </div>

                {/* Items preview */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {order.items.map(item => (
                    <div key={item.id} className="h-14 w-14 rounded-lg overflow-hidden shrink-0">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total paid</span>
                  <span className="font-bold text-foreground">{order.totalLocal || formatLocalPrice(order.total, displayCountry, ethRates)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return null;
};

export default MarketplacePage;
