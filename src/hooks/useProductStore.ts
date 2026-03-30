import { useCallback } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { PRODUCT_STORE_ADDRESS, PRODUCT_STORE_ABI } from "@/lib/contracts/productStore";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";

// ──────────────────────────────────────────────
//  Create Product Hook
// ──────────────────────────────────────────────

export function useCreateProduct() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { setLoading, setError } = useProductStore();

  return useCallback(
    async (
      metadataUri: string,
      price: bigint,
      stock: number,
      royaltyPercent: number
    ) => {
      setLoading(true);
      setError(null);
      try {
        const tx = await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "createProduct",
          args: [metadataUri, price, BigInt(stock), BigInt(royaltyPercent)],
        });
        setLoading(false);
        return tx;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create product";
        setError(errorMessage);
        setLoading(false);
        throw error;
      }
    },
    [writeContractAsync, setLoading, setError]
  );
}

// ──────────────────────────────────────────────
//  Add to Cart Hook
// ──────────────────────────────────────────────

export function useAddToCart() {
  const { writeContractAsync, isPending } = useWriteContract();

  return useCallback(
    async (productId: number, quantity: number) => {
      try {
        const tx = await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "addToCart",
          args: [BigInt(productId), BigInt(quantity)],
        });
        return tx;
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Remove from Cart Hook
// ──────────────────────────────────────────────

export function useRemoveFromCart() {
  const { writeContractAsync } = useWriteContract();

  return useCallback(
    async (productId: number) => {
      try {
        return await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "removeFromCart",
          args: [BigInt(productId)],
        });
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Buy Product Hook
// ──────────────────────────────────────────────

export function useBuyProduct() {
  const { writeContractAsync, isPending } = useWriteContract();

  return useCallback(
    async (productId: number, quantity: number, totalPrice: bigint, orderMetadata: string) => {
      try {
        const tx = await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "buyProduct",
          args: [BigInt(productId), BigInt(quantity), orderMetadata],
          value: totalPrice,
        });
        return tx;
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Checkout Cart Hook
// ──────────────────────────────────────────────

export function useCheckoutCart() {
  const { writeContractAsync, isPending } = useWriteContract();

  return useCallback(
    async (totalPrice: bigint, orderMetadata: string) => {
      try {
        const tx = await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "checkoutCart",
          args: [orderMetadata],
          value: totalPrice,
        });
        return tx;
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Get Products Hook (Read)
// ──────────────────────────────────────────────

export function useGetProduct(productId: number) {
  const { data: product, isLoading, error } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "getProduct",
    args: [BigInt(productId)],
  });

  return { product, isLoading, error };
}

// ──────────────────────────────────────────────
//  Get User Orders Hook (Read)
// ──────────────────────────────────────────────

export function useGetUserOrders(userAddress?: string) {
  const { data: orderIds, isLoading, error } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "getUserOrders",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress },
  });

  return { orderIds: orderIds as bigint[] | undefined, isLoading, error };
}

// ──────────────────────────────────────────────
//  Get Order Details Hook (Read)
// ──────────────────────────────────────────────

export function useGetOrder(orderId: number) {
  const { data: order, isLoading, error } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "getOrder",
    args: [BigInt(orderId)],
  });

  return { order, isLoading, error };
}

// ──────────────────────────────────────────────
//  Get Artist Balance Hook (Read)
// ──────────────────────────────────────────────

export function useGetArtistBalance(artistAddress?: string) {
  const { data: balance, isLoading, error } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "getArtistBalance",
    args: artistAddress ? [artistAddress as `0x${string}`] : undefined,
    query: { enabled: !!artistAddress },
  });

  return { balance: balance as bigint | undefined, isLoading, error };
}

// ──────────────────────────────────────────────
//  Withdraw Artist Balance Hook
// ──────────────────────────────────────────────

export function useWithdrawArtistBalance() {
  const { writeContractAsync, isPending } = useWriteContract();

  return useCallback(
    async () => {
      try {
        const tx = await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "withdrawArtistBalance",
          args: [],
        });
        return tx;
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Clear Cart Hook
// ──────────────────────────────────────────────

export function useClearCart() {
  const { writeContractAsync } = useWriteContract();

  return useCallback(
    async () => {
      try {
        return await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "clearCart",
          args: [],
        });
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}

// ──────────────────────────────────────────────
//  Fulfill Order Hook (for creators)
// ──────────────────────────────────────────────

export function useFulfillOrder() {
  const { writeContractAsync } = useWriteContract();

  return useCallback(
    async (orderId: number) => {
      try {
        return await writeContractAsync({
          address: PRODUCT_STORE_ADDRESS,
          abi: PRODUCT_STORE_ABI,
          functionName: "fulfillOrder",
          args: [BigInt(orderId)],
        });
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );
}
