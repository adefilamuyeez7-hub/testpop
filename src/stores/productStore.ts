import { create } from "zustand";

// Product data structure - DB-backed with UUIDs and asset metadata
export interface Product {
  id: string; // UUID
  creator: string;
  creator_wallet?: string;
  metadataURI?: string;
  price: bigint;
  stock: number;
  sold: number;
  royaltyPercent?: number;
  active?: boolean;
  createdAt?: bigint;
  // Extended properties (from IPFS metadata or Supabase)
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  category?: string;
  // Asset metadata (new)
  asset_type?: "image" | "video" | "audio" | "pdf" | "epub" | "merchandise";
  preview_uri?: string;
  delivery_uri?: string;
  manifest_uri?: string;
  mime_type?: string;
  unlock_rule?: "public" | "owner" | "subscriber" | "both";
}

// Order data structure matching contract Order struct
export interface Order {
  orderId: number;
  buyer: string;
  productId: number;
  quantity: number;
  totalPrice: bigint;
  orderMetadata: string;
  timestamp: bigint;
  fulfilled: boolean;
  // Extended (populated from product data)
  productName?: string;
  productImage?: string;
}

interface ProductStore {
  // State
  products: Map<number, Product>;
  filteredProducts: Product[];
  selectedProduct: Product | null;
  userOrders: Order[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  setSelectedProduct: (product: Product | null) => void;
  setFilteredProducts: (products: Product[]) => void;
  setUserOrders: (orders: Order[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Filters
  filterByCategory: (category: string) => void;
  filterByCreator: (creator: string) => void;
  searchProducts: (query: string) => void;
  sortByPrice: (ascending: boolean) => void;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: new Map(),
  filteredProducts: [],
  selectedProduct: null,
  userOrders: [],
  isLoading: false,
  error: null,

  setProducts: (products) => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    set({ products: productMap, filteredProducts: products });
  },

  addProduct: (product) => {
    const { products } = get();
    products.set(product.id, product);
    set({ products: new Map(products) });
  },

  setSelectedProduct: (product) => set({ selectedProduct: product }),

  setFilteredProducts: (products) => set({ filteredProducts: products }),

  setUserOrders: (orders) => set({ userOrders: orders }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  filterByCategory: (category) => {
    const { products } = get();
    const filtered = Array.from(products.values()).filter(
      (p) => !category || p.category === category
    );
    set({ filteredProducts: filtered });
  },

  filterByCreator: (creator) => {
    const { products } = get();
    const filtered = Array.from(products.values()).filter(
      (p) => p.creator.toLowerCase() === creator.toLowerCase()
    );
    set({ filteredProducts: filtered });
  },

  searchProducts: (query) => {
    const { products } = get();
    const lowerQuery = query.toLowerCase();
    const filtered = Array.from(products.values()).filter(
      (p) =>
        p.name?.toLowerCase().includes(lowerQuery) ||
        p.description?.toLowerCase().includes(lowerQuery)
    );
    set({ filteredProducts: filtered });
  },

  sortByPrice: (ascending) => {
    const { filteredProducts } = get();
    const sorted = [...filteredProducts].sort((a, b) =>
      ascending
        ? Number(a.price - b.price)
        : Number(b.price - a.price)
    );
    set({ filteredProducts: sorted });
  },
}));
