import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getArtistProfile } from "@/lib/db";

export function useGetArtistContract(wallet?: string | null) {
  const normalizedWallet = typeof wallet === "string" ? wallet.trim().toLowerCase() : "";

  const { data } = useQuery({
    queryKey: ["artist-contract", normalizedWallet],
    queryFn: async () => {
      if (!normalizedWallet) return null;
      const profile = await getArtistProfile(normalizedWallet);
      return profile?.contract_address || null;
    },
    enabled: Boolean(normalizedWallet),
    staleTime: 60_000,
  });

  return data || null;
}

export function useResolvedArtistContract(
  wallet?: string | null,
  storedContractAddress?: string | null,
) {
  const fetchedContractAddress = useGetArtistContract(wallet);

  return useMemo(() => {
    const preferred = typeof storedContractAddress === "string" ? storedContractAddress.trim() : "";
    if (preferred) return preferred;
    return fetchedContractAddress || null;
  }, [fetchedContractAddress, storedContractAddress]);
}

