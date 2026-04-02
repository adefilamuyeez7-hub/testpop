import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  productId: string;
  contractProductId?: number | null;
  quantity: number;
  price: string;
  name: string;
  image: string;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  addItem: (
    productId: string,
    contractProductId: number | null,
    quantity: number,
    price: bigint,
    name: string,
    image: string
  ) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  getTotalPrice: () => bigint;
  getTotalItems: () => number;
  getCartSize: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: (productId, contractProductId, quantity, price, name, image) => {
        const { items } = get();
        const priceStr = price.toString();
        const existingItem = items.find((item) => item.productId === productId);

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.productId === productId
                ? { ...item, quantity: item.quantity + quantity, contractProductId, price: priceStr, name, image }
                : item
            ),
          });
          return;
        }

        set({
          items: [
            ...items,
            { productId, contractProductId, quantity, price: priceStr, name, image },
          ],
        });
      },

      removeItem: (productId) => {
        const { items } = get();
        set({ items: items.filter((item) => item.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        const { items } = get();
        set({
          items: items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.max(1, quantity) }
              : item
          ),
        });
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
    }),
    {
      name: "popup-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
