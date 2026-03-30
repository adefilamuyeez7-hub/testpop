// ✅ CRITICAL: Get contract address per artist from Supabase
// Each artist has ONE ERC-721 contract deployed via ArtDropFactory
// This is the canonical hook for looking up artist contract addresses

import { useMemo } from "react";
import { getAddress } from "viem";
import { useSupabaseArtists } from "@/hooks/useSupabase";

/**
 * Normalize wallet address to ERC-55 checksum format
 */
function normalizeWallet(wallet?: string | null): string | null {
  if (!wallet?.trim()) return null;
  try {
    return getAddress(wallet.trim());
  } catch {
    return null;
  }
}

/**
 * Get contract address for an artist by ID
 * @param artistId - Artist UUID from database
 * @returns { contractAddress, isLoading, error }
 */
export function useArtistContractAddress(artistId?: string | null) {
  const { data: artists, isLoading, error } = useSupabaseArtists();

  const contractAddress = useMemo(() => {
    if (!artistId || !artists || artists.length === 0) return null;

    const artist = artists.find((a) => a.id === artistId);
    if (!artist || !artist.contract_address) return null;

    return normalizeWallet(artist.contract_address);
  }, [artistId, artists]);

  return {
    contractAddress,
    isLoading,
    error,
  };
}

/**
 * Get contract address for an artist by wallet address
 * @param wallet - Artist wallet address
 * @returns { contractAddress, isLoading, error }
 */
export function useArtistContractAddressByWallet(wallet?: string | null) {
  const { data: artists, isLoading, error } = useSupabaseArtists();
  const normalizedInput = normalizeWallet(wallet);

  const contractAddress = useMemo(() => {
    if (!normalizedInput || !artists || artists.length === 0) return null;

    const artist = artists.find((a) => {
      const artistWallet = normalizeWallet(a.wallet);
      return artistWallet === normalizedInput;
    });

    if (!artist || !artist.contract_address) return null;
    return normalizeWallet(artist.contract_address);
  }, [normalizedInput, artists]);

  return {
    contractAddress,
    isLoading,
    error,
  };
}

/**
 * Get contract addresses for multiple artists at once
 * Useful for rendering feed/list views
 */
export function useArtistContractAddresses(artistWallets: string[]) {
  return useQuery({
    queryKey: ['artistContracts', artistWallets],
    queryFn: async () => {
      if (!artistWallets || artistWallets.length === 0) return {};

      try {
        const { data, error } = await supabase
          .from('artists')
          .select('wallet, contract_address')
          .in('wallet', artistWallets);

        if (error) {
          console.error('Error fetching artist contracts:', error);
          return {};
        }

        const addressMap: Record<string, string> = {};
        data.forEach((artist) => {
          if (artist.contract_address) {
            addressMap[artist.wallet] = artist.contract_address;
          }
        });

        return addressMap;
      } catch (err) {
        console.error('Failed to fetch artist contracts:', err);
        return {};
      }
    },
    enabled: artistWallets && artistWallets.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}

/**
 * Verify that a contract address is valid before using it
 */
export function isValidContractAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  // Check format: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get contract address with fallback
 * Returns the artist contract if available, otherwise throws error
 */
export function useRequireArtistContractAddress(artistWallet: string | null | undefined) {
  const { data: contractAddress, isLoading, error } = useArtistContractAddress(artistWallet);

  if (!contractAddress) {
    throw new Error(
      `Contract not found for artist ${artistWallet}. Artist may not have deployed their contract yet.`
    );
  }

  return { contractAddress, isLoading, error };
}

/**
 * Invalidate contract address cache (use after contract deployment)
 */
export function useInvalidateContractAddress() {
  const queryClient = useQueryClient();

  return (artistWallet: string) => {
    queryClient.invalidateQueries({
      queryKey: ['artistContract', artistWallet],
    });
  };
}

/**
 * Prefetch contract address for better UX
 */
export function usePrefetchContractAddress() {
  const queryClient = useQueryClient();

  return (artistWallet: string) => {
    queryClient.prefetchQuery({
      queryKey: ['artistContract', artistWallet],
      queryFn: async () => {
        const { data } = await supabase
          .from('artists')
          .select('contract_address')
          .eq('wallet', artistWallet)
          .single();
        return data?.contract_address || null;
      },
    });
  };
}
