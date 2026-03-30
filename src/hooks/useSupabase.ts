/**
 * React Query hooks for Supabase data fetching
 * Replaces useState-based hooks with useQuery for automatic caching, deduplication,
 * and background refetching. Maintains same interface as old hooks for easy migration.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchAllArtistsFromSupabase,
  fetchPublishedProductsFromSupabase,
  fetchLiveDropsFromSupabase,
  fetchArtistByIdFromSupabase,
  fetchProductsByCreatorFromSupabase,
  fetchDropsByArtistFromSupabase,
  fetchOrdersByBuyerFromSupabase,
  fetchAllProductsFromSupabase,
  fetchAllDropsFromSupabase,
} from "@/lib/supabaseStore";

/**
 * Unified return type compatible with old useState-based hooks
 * useQuery provides: data, error, isLoading, refetch, etc.
 * We map these to the old interface: data, loading, error, refetch
 */
export interface UseSupabaseResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Artists Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabaseArtists() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artists", "all"],
    queryFn: fetchAllArtistsFromSupabase,
    staleTime: 5000, // 5 seconds - refetch more frequently for contract address updates
    refetchInterval: 5000, // Auto-refetch every 5 seconds
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useSupabaseArtistById(artistId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artists", artistId],
    queryFn: () => (artistId ? fetchArtistByIdFromSupabase(artistId) : null),
    enabled: !!artistId,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Products Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabasePublishedProducts() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", "published"],
    queryFn: fetchPublishedProductsFromSupabase,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useSupabaseAllProducts() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", "all"],
    queryFn: fetchAllProductsFromSupabase,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useSupabaseProductsByCreator(creatorWallet: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", "creator", creatorWallet],
    queryFn: () =>
      creatorWallet
        ? fetchProductsByCreatorFromSupabase(creatorWallet)
        : Promise.resolve([]),
    enabled: !!creatorWallet,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drops Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabaseLiveDrops() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "live"],
    queryFn: fetchLiveDropsFromSupabase,
    staleTime: 5000, // 5 seconds - refetch to show newly created drops
    refetchInterval: 5000, // Auto-refetch every 5 seconds
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useSupabaseAllDrops() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "all"],
    queryFn: fetchAllDropsFromSupabase,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

export function useSupabaseDropsByArtist(artistId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "artist", artistId],
    queryFn: () =>
      artistId
        ? fetchDropsByArtistFromSupabase(artistId)
        : Promise.resolve([]),
    enabled: !!artistId,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orders Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabaseOrdersByBuyer(buyerWallet: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orders", "buyer", buyerWallet],
    queryFn: () =>
      buyerWallet
        ? fetchOrdersByBuyerFromSupabase(buyerWallet)
        : Promise.resolve([]),
    enabled: !!buyerWallet,
    staleTime: 5000, // 5 seconds
    refetchInterval: 5000,
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: async () => {
      await refetch();
    },
  };
}
