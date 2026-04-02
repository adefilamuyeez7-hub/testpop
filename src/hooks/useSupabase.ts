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
  fetchDropByIdFromSupabase,
  fetchProductByIdFromSupabase,
} from "@/lib/supabaseStore";
import { getArtistProfile } from "@/lib/db";

const STANDARD_QUERY_OPTIONS = {
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false as const,
  retry: 1,
};

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
    ...STANDARD_QUERY_OPTIONS,
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
    ...STANDARD_QUERY_OPTIONS,
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

export function useSupabaseArtistByWallet(wallet: string | undefined) {
  const normalizedWallet = wallet?.toLowerCase();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artists", "wallet", normalizedWallet],
    queryFn: () => (normalizedWallet ? getArtistProfile(normalizedWallet) : null),
    enabled: !!normalizedWallet,
    ...STANDARD_QUERY_OPTIONS,
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
    ...STANDARD_QUERY_OPTIONS,
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
    ...STANDARD_QUERY_OPTIONS,
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

export function useSupabaseProductById(productId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => (productId ? fetchProductByIdFromSupabase(productId) : null),
    enabled: !!productId,
    ...STANDARD_QUERY_OPTIONS,
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

export function useSupabaseProductsByCreator(creatorWallet: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", "creator", creatorWallet],
    queryFn: () =>
      creatorWallet
        ? fetchProductsByCreatorFromSupabase(creatorWallet)
        : Promise.resolve([]),
    enabled: !!creatorWallet,
    ...STANDARD_QUERY_OPTIONS,
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
    ...STANDARD_QUERY_OPTIONS,
    staleTime: 60_000,
    refetchOnMount: false,
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

export function useSupabaseAllDrops(enabled = true) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "all"],
    queryFn: fetchAllDropsFromSupabase,
    enabled,
    ...STANDARD_QUERY_OPTIONS,
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

export function useSupabaseDropById(dropId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "detail", dropId],
    queryFn: () => (dropId ? fetchDropByIdFromSupabase(dropId) : null),
    enabled: !!dropId,
    ...STANDARD_QUERY_OPTIONS,
    staleTime: 60_000,
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

export function useSupabaseDropsByArtist(artistId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["drops", "artist", artistId],
    queryFn: () =>
      artistId
        ? fetchDropsByArtistFromSupabase(artistId)
        : Promise.resolve([]),
    enabled: !!artistId,
    ...STANDARD_QUERY_OPTIONS,
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
    ...STANDARD_QUERY_OPTIONS,
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
