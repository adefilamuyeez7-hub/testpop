import { create } from "zustand";

export interface CartItem {
  productId: number;
  quantity: number;
  price: string;
  name: string;
  image: string;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  addItem: (
    productId: number,
    quantity: number,
    price: bigint,
    name: string,
    image: string
  ) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  getTotalPrice: () => bigint;
  getTotalItems: () => number;
  getCartSize: () => number;
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items: [],
  isLoading: false,

  addItem: (productId, quantity, price, name, image) => {
    const { items } = get();
    const existingItem = items.find((item) => item.productId === productId);
    const priceStr = price.toString();

    if (existingItem) {
      existingItem.quantity += quantity;
      set({ items: [...items] });
      return;
    }

    set({
      items: [
        ...items,
        { productId, quantity, price: priceStr, name, image },
      ],
    });
  },

  removeItem: (productId) => {
    const { items } = get();
    set({ items: items.filter((item) => item.productId !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    const { items } = get();
    const item = items.find((entry) => entry.productId === productId);
    if (!item) return;

    item.quantity = quantity;
    set({ items: [...items] });
  },

  clearCart: () => set({ items: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  getTotalPrice: () => {
    const { items } = get();
    return items.reduce(
      (total, item) => total + BigInt(item.price) * BigInt(item.quantity),
      BigInt(0)
    );
  },

  getTotalItems: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.quantity, 0);
  },

  getCartSize: () => {
    const { items } = get();
    return items.length;
  },
}));
