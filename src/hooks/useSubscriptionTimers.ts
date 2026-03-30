import { useReadContract } from "wagmi";
import { getAddress } from "viem";
import { ART_DROP_ADDRESS, ART_DROP_ABI } from "@/lib/contracts/artDrop";

/**
 * @notice Check if a subscription is currently ACTIVE (not expired)
 * @param artistAddress Artist wallet address
 * @param userAddress User/collector wallet address
 * @returns Boolean indicating if subscription is active
 */
export function useIsSubscriptionActive(
  artistAddress?: string | null,
  userAddress?: string | null
) {
  let normalizedArtist: string | null = null;
  let normalizedUser: string | null = null;

  try {
    if (artistAddress?.trim()) {
      normalizedArtist = getAddress(artistAddress.trim());
    }
    if (userAddress?.trim()) {
      normalizedUser = getAddress(userAddress.trim());
    }
  } catch {
    normalizedArtist = null;
    normalizedUser = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "isSubscriptionActive",
    args: normalizedArtist && normalizedUser ? [normalizedArtist, normalizedUser] : undefined,
    enabled: Boolean(normalizedArtist && normalizedUser),
  });

  return {
    isActive: data ? Boolean(data as boolean) : false,
    isLoading,
    error,
    refetch,
  };
}

/**
 * @notice Get remaining time on subscription in seconds
 * @param artistAddress Artist wallet address
 * @param userAddress User/collector wallet address
 * @returns Seconds remaining (0 if expired)
 */
export function useSubscriptionTimeRemaining(
  artistAddress?: string | null,
  userAddress?: string | null
) {
  let normalizedArtist: string | null = null;
  let normalizedUser: string | null = null;

  try {
    if (artistAddress?.trim()) {
      normalizedArtist = getAddress(artistAddress.trim());
    }
    if (userAddress?.trim()) {
      normalizedUser = getAddress(userAddress.trim());
    }
  } catch {
    normalizedArtist = null;
    normalizedUser = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "getSubscriptionTimeRemaining",
    args: normalizedArtist && normalizedUser ? [normalizedArtist, normalizedUser] : undefined,
    enabled: Boolean(normalizedArtist && normalizedUser),
  });

  const secondsRemaining = data ? Number(data) : 0;
  const daysRemaining = Math.floor(secondsRemaining / (24 * 60 * 60));
  const hoursRemaining = Math.floor((secondsRemaining % (24 * 60 * 60)) / (60 * 60));

  return {
    secondsRemaining,
    daysRemaining,
    hoursRemaining,
    isExpired: secondsRemaining === 0,
    isLoading,
    error,
    refetch,
  };
}

/**
 * @notice Get minimum subscription fee for an artist
 * @param artistAddress Artist wallet address
 * @returns Minimum fee in wei
 */
export function useMinSubscriptionFee(artistAddress?: string | null) {
  let normalizedArtist: string | null = null;

  try {
    if (artistAddress?.trim()) {
      normalizedArtist = getAddress(artistAddress.trim());
    }
  } catch {
    normalizedArtist = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "minSubscriptionFee",
    args: normalizedArtist ? [normalizedArtist] : undefined,
    enabled: Boolean(normalizedArtist),
  });

  return {
    minFeeWei: data ? BigInt(data) : 0n,
    minFeeEth: data ? Number(data) / 1e18 : 0,
    isLoading,
    error,
    refetch,
  };
}
