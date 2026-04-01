/**
 * ARTIST CONTRACTS HOOKS
 * 
 * These hooks work with per-artist ArtDrop contracts deployed via ArtDropFactory.
 * Each artist has ONE contract instance deployed with their wallet + founder wallet.
 * 
 * Key difference from old useContracts.ts:
 * - Contracts are looked up by artist.contractAddress from Supabase
 * - NOT using a shared ART_DROP_ADDRESS
 * - Each function requires an artist contract address parameter
 */

import { useEffect, useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, parseEther, getAddress } from "viem";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { ARTIST_DROP_ABI } from "@/lib/contracts/artDropArtist";

/**
 * Create a drop on the artist's contract
 * @param artistContractAddress - The artist's deployed contract address
 */
export function useCreateDropArtist(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash });

  let normalized: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const createDrop = (
    metadataURI: string,
    priceEth: string,
    maxSupply: number,
    startTime: number = 0,
    endTime: number = 0
  ) => {
    if (!address) throw new Error("Connect wallet to create a drop");
    if (!normalized) throw new Error("Artist contract address not provided");

    // Validate inputs
    if (!metadataURI || metadataURI.trim().length === 0) {
      throw new Error("Metadata URI cannot be empty");
    }
    if (!metadataURI.startsWith("ipfs://")) {
      throw new Error("Metadata URI must be a valid IPFS URI (ipfs://...)");
    }

    if (!priceEth || priceEth.trim().length === 0) {
      throw new Error("Price must be specified");
    }

    let weiPrice;
    try {
      weiPrice = parseEther(priceEth);
    } catch {
      throw new Error(`Invalid price format: "${priceEth}". Must be a valid decimal number (e.g., "0.05")`);
    }

    if (weiPrice < 0n) {
      throw new Error("Price cannot be negative");
    }

    if (maxSupply < 0) {
      throw new Error("Supply cannot be negative");
    }

    if (endTime !== 0 && endTime <= startTime) {
      throw new Error("End time must be after start time");
    }

    console.log("🎨 Creating drop on artist contract:", {
      metadataURI,
      priceWei: weiPrice.toString(),
      maxSupply,
      startTime,
      endTime,
      contractAddress: effectiveContractAddress,
    });

    return writeContract({
      address: effectiveContractAddress as `0x${string}`,
      abi: ARTIST_DROP_ABI,
      functionName: "createDrop",
      args: [metadataURI, weiPrice, BigInt(maxSupply), BigInt(startTime), BigInt(endTime)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const createdDropId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ARTIST_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "DropCreated") return null;
          console.log("✅ Drop created with ID:", decoded.args.dropId);
          return Number(decoded.args.dropId);
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { createDrop, createdDropId, isPending, isConfirming, isSuccess, error, hash };
}

/**
 * Mint an NFT from an artist's drop
 * @param artistContractAddress - The artist's deployed contract address
 */
export function useMintArtist(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let normalized: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const mint = (dropId: number, priceWei: bigint, overrideContractAddress?: string | null) => {
    if (!address) throw new Error("Connect wallet to mint");

    let effectiveContractAddress = normalized;
    if (!effectiveContractAddress && overrideContractAddress?.trim()) {
      try {
        effectiveContractAddress = getAddress(overrideContractAddress.trim());
      } catch {
        effectiveContractAddress = null;
      }
    }
    if (!effectiveContractAddress) throw new Error("Artist contract address not provided");

    // Validate drop ID
    if (!Number.isInteger(dropId) || dropId < 0) {
      throw new Error(`Invalid drop ID: ${dropId}. Drop ID must be a positive integer.`);
    }

    if (priceWei < 0n) {
      throw new Error("Price cannot be negative");
    }

    console.log("🎨 Minting NFT from artist contract:", {
      dropId,
      priceWei: priceWei.toString(),
      contractAddress: normalized,
      userAddress: address,
    });

    return writeContract({
      address: normalized as `0x${string}`,
      abi: ARTIST_DROP_ABI,
      functionName: "mint",
      args: [BigInt(dropId)],
      value: priceWei,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const mintedTokenId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ARTIST_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "ArtMinted") return null;
          console.log("✅ NFT minted with token ID:", decoded.args.tokenId);
          return Number(decoded.args.tokenId);
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { mint, mintedTokenId, isPending, isConfirming, isSuccess, error, hash };
}

/**
 * Subscribe to an artist
 * @param artistContractAddress - The artist's deployed contract address
 */
export function useSubscribeToArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let normalized: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const subscribe = async (amountEth: string | number) => {
    if (!address) throw new Error("Connect wallet before subscribing");
    if (!normalized) throw new Error("Artist contract address not provided");

    const amountStr = String(amountEth).trim();
    if (!amountStr || amountStr.length === 0) {
      throw new Error("Amount required");
    }

    let weiAmount: bigint;
    try {
      weiAmount = parseEther(amountStr);
    } catch {
      throw new Error(`Invalid amount format: "${amountStr}". Expected decimal number (e.g., "0.05")`);
    }

    if (weiAmount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }

    console.log("🎨 Subscribing to artist contract:", {
      contractAddress: normalized,
      amountEth: amountStr,
      weiAmount: weiAmount.toString(),
      subscriber: address,
    });

    return writeContract({
      address: normalized as `0x${string}`,
      abi: ARTIST_DROP_ABI,
      functionName: "subscribe",
      args: [],
      value: weiAmount,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const subscriptionHash =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ARTIST_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "NewSubscription") return null;
          console.log("✅ Subscription confirmed:", decoded.args);
          return receipt.transactionHash;
        } catch {
          return null;
        }
      })
      .find((value): value is string => Boolean(value)) ?? null;

  return { subscribe, subscriptionHash, isPending, isConfirming, isSuccess, error, hash };
}

/**
 * Check if user has active subscription to artist
 * @param artistContractAddress - The artist's deployed contract address
 * @param userAddress - The user's wallet address
 */
export function useIsSubscribedToArtistContract(
  artistContractAddress?: string | null,
  userAddress?: string | null
) {
  let normalizedArtist: string | null = null;
  let normalizedUser: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      normalizedArtist = getAddress(artistContractAddress.trim());
    }
    if (userAddress?.trim()) {
      normalizedUser = getAddress(userAddress.trim());
    }
  } catch {
    normalizedArtist = null;
    normalizedUser = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: normalizedArtist ? (normalizedArtist as `0x${string}`) : undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "isSubscriptionActive",
    args: normalizedUser ? [normalizedUser as `0x${string}`] : undefined,
    enabled: Boolean(normalizedArtist && normalizedUser),
  });

  return {
    isSubscribed: data ? Boolean(data as boolean) : false,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get subscriber count for an artist
 * @param artistContractAddress - The artist's deployed contract address
 */
export function useGetSubscriberCount(artistContractAddress?: string | null) {
  let normalized: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: normalized ? (normalized as `0x${string}`) : undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "getSubscriberCount",
    args: [],
    enabled: Boolean(normalized),
  });

  return {
    count: data ? Number(data as bigint) : 0,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get drop details from artist contract
 * @param artistContractAddress - The artist's deployed contract address
 * @param dropId - The drop ID
 */
export function useArtistDropDetails(
  artistContractAddress?: string | null,
  dropId?: number | null,
  enabled = true
) {
  let normalized: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: normalized ? (normalized as `0x${string}`) : undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "getDrop",
    args: dropId !== null && dropId !== undefined ? [BigInt(dropId)] : undefined,
    enabled: enabled && Boolean(normalized) && dropId !== null && dropId !== undefined,
  });

  return { data, isLoading, error, refetch };
}

/**
 * Toggle pause on a drop (artist only)
 * @param artistContractAddress - The artist's deployed contract address
 */
export function useTogglePauseArtist(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let normalized: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      normalized = getAddress(artistContractAddress.trim());
    }
  } catch {
    normalized = null;
  }

  const togglePause = (dropId: number) => {
    if (!address) throw new Error("Connect wallet before toggling pause");
    if (!normalized) throw new Error("Artist contract address not provided");

    if (!Number.isInteger(dropId) || dropId < 0) {
      throw new Error(`Invalid drop ID: ${dropId}`);
    }

    return writeContract({
      address: normalized as `0x${string}`,
      abi: ARTIST_DROP_ABI,
      functionName: "togglePause",
      args: [BigInt(dropId)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { togglePause, isPending, isConfirming, isSuccess, error, hash };
}
