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
  assetType?: "image" | "video" | "audio" | "pdf" | "epub" | "digital" | "merchandise";
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
        const normalizedContractAddress = item.contractAddress?.toLowerCase() || null;
        const existingIndex = get().items.findIndex(
          (entry) => {
            const sameMintedToken =
              normalizedContractAddress &&
              item.mintedTokenId !== null &&
              item.mintedTokenId !== undefined &&
              entry.contractAddress?.toLowerCase() === normalizedContractAddress &&
              entry.mintedTokenId === item.mintedTokenId;

            if (sameMintedToken) {
              return true;
            }

            return (
              entry.ownerWallet.toLowerCase() === ownerWallet &&
              entry.id === item.id
            );
          }
        );

        if (existingIndex >= 0) {
          set({
            items: get().items.map((entry, index) =>
              index === existingIndex
                ? { ...entry, ...item, ownerWallet, contractAddress: normalizedContractAddress }
                : entry
            ),
          });
          return;
        }

        set({
          items: [{ ...item, ownerWallet, contractAddress: normalizedContractAddress }, ...get().items],
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
