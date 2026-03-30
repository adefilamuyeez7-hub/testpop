/**
 * Custom React hooks for Supabase data fetching
 * Simplifies component code and handles loading/error states
 */

import { useEffect, useState } from "react";
import { 
  fetchAllArtistsFromSupabase, 
  fetchPublishedProductsFromSupabase,
  fetchLiveDropsFromSupabase,
  fetchArtistByIdFromSupabase,
  fetchProductsByCreatorFromSupabase,
  fetchDropsByArtistFromSupabase,
  fetchOrdersByBuyerFromSupabase,
  fetchAllProductsFromSupabase,
} from "@/lib/supabaseStore";

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
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const artists = await fetchAllArtistsFromSupabase();
      setData(artists);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch artists"));
      console.error("❌ useSupabaseArtists error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSupabaseArtistById(artistId: string | undefined) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!!artistId);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!artistId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const artist = await fetchArtistByIdFromSupabase(artistId);
      setData(artist);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch artist"));
      console.error("❌ useSupabaseArtistById error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [artistId]);

  return { data, loading, error, refetch: fetchData };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Products Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabasePublishedProducts() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const products = await fetchPublishedProductsFromSupabase();
      setData(products);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch products"));
      console.error("❌ useSupabasePublishedProducts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSupabaseAllProducts() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const products = await fetchAllProductsFromSupabase();
      setData(products);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch products"));
      console.error("❌ useSupabaseAllProducts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSupabaseProductsByCreator(creatorWallet: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!creatorWallet);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!creatorWallet) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const products = await fetchProductsByCreatorFromSupabase(creatorWallet);
      setData(products);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch products"));
      console.error("❌ useSupabaseProductsByCreator error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [creatorWallet]);

  return { data, loading, error, refetch: fetchData };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drops Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabaseLiveDrops() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const drops = await fetchLiveDropsFromSupabase();
      setData(drops);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch drops"));
      console.error("❌ useSupabaseLiveDrops error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useSupabaseDropsByArtist(artistId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!artistId);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!artistId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const drops = await fetchDropsByArtistFromSupabase(artistId);
      setData(drops);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch drops"));
      console.error("❌ useSupabaseDropsByArtist error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [artistId]);

  return { data, loading, error, refetch: fetchData };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orders Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupabaseOrdersByBuyer(buyerWallet: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!buyerWallet);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!buyerWallet) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const orders = await fetchOrdersByBuyerFromSupabase(buyerWallet);
      setData(orders);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch orders"));
      console.error("❌ useSupabaseOrdersByBuyer error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [buyerWallet]);

  return { data, loading, error, refetch: fetchData };
}
