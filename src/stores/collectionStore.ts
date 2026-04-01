import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CollectedDropItem {
  id: string;
  ownerWallet: string;
  title: string;
  artist: string;
  imageUrl?: string;
  previewUri?: string;
  deliveryUri?: string;
  assetType?: "image" | "video" | "audio" | "pdf" | "epub";
  isGated?: boolean;
  mintedTokenId?: number | null;
  contractAddress?: string | null;
  contractDropId?: number | null;
  collectedAt: string;
}

interface CollectionStore {
  items: CollectedDropItem[];
  addCollectedDrop: (item: CollectedDropItem) => void;
  clearCollectionForOwner: (ownerWallet: string) => void;
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      items: [],
      addCollectedDrop: (item) => {
        const ownerWallet = item.ownerWallet.toLowerCase();
        const existingIndex = get().items.findIndex(
          (entry) =>
            entry.ownerWallet.toLowerCase() === ownerWallet &&
            entry.id === item.id
        );

        if (existingIndex >= 0) {
          set({
            items: get().items.map((entry, index) =>
              index === existingIndex
                ? { ...entry, ...item, ownerWallet }
                : entry
            ),
          });
          return;
        }

        set({
          items: [{ ...item, ownerWallet }, ...get().items],
        });
      },
      clearCollectionForOwner: (ownerWallet) =>
        set({
          items: get().items.filter(
            (entry) => entry.ownerWallet.toLowerCase() !== ownerWallet.toLowerCase()
          ),
        }),
    }),
    {
      name: "popup-collection",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
