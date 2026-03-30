// Hooks for ArtistSharesToken contract interaction
// Used in share fundraising pages

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ARTIST_SHARES_TOKEN_ABI, ARTIST_SHARES_TOKEN_ADDRESS } from "@/lib/contracts/artistSharesToken";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { getAddress } from "viem";

// ── Launch Fundraising Campaign ──────────────────────────────────
export function useLaunchSharesCampaign(tokenAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validated: string | null = null;
  try {
    if (tokenAddress?.trim()) {
      validated = getAddress(tokenAddress.trim());
    }
  } catch {
    validated = null;
  }

  const launchCampaign = (targetEth: string, totalShares: string, daysActive: number) => {
    if (!address) throw new Error("Connect wallet");
    if (!validated) throw new Error("Invalid token address");

    let targetWei: bigint;
    try {
      targetWei = parseEther(targetEth);
    } catch {
      throw new Error("Invalid target amount");
    }

    let sharesAmount: bigint;
    try {
      sharesAmount = BigInt(totalShares);
    } catch {
      throw new Error("Invalid shares amount");
    }

    return writeContract({
      address: validated as `0x${string}`,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "launchCampaign",
      args: [targetWei, sharesAmount, BigInt(daysActive)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { launchCampaign, isPending, isConfirming, isSuccess, error, hash };
}

// ── Buy Shares ───────────────────────────────────────────────────
export function useBuyShares(tokenAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validated: string | null = null;
  try {
    if (tokenAddress?.trim()) {
      validated = getAddress(tokenAddress.trim());
    }
  } catch {
    validated = null;
  }

  const buyShares = (amountEth: string) => {
    if (!address) throw new Error("Connect wallet");
    if (!validated) throw new Error("Invalid token address");

    let weiAmount: bigint;
    try {
      weiAmount = parseEther(amountEth);
    } catch {
      throw new Error("Invalid amount");
    }

    return writeContract({
      address: validated as `0x${string}`,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "buyShares",
      args: [weiAmount],
      value: weiAmount,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { buyShares, isPending, isConfirming, isSuccess, error, hash };
}

// ── Get Campaign Status ──────────────────────────────────────────
export function useCampaignStatus(tokenAddress?: string | null) {
  let validated: string | null = null;
  try {
    if (tokenAddress?.trim()) {
      validated = getAddress(tokenAddress.trim());
    }
  } catch {
    validated = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: validated ? (validated as `0x${string}`) : undefined,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "getCampaignStatus",
    enabled: Boolean(validated),
  });

  const campaign = data
    ? {
        targetEth: formatEther((data as any)[0]),
        raisedEth: formatEther((data as any)[1]),
        pricePerShare: (data as any)[2].toString(),
        endTime: Number((data as any)[3]),
        active: (data as any)[4],
      }
    : null;

  return { campaign, isLoading, error, refetch };
}

// ── Get Revenue Claim ────────────────────────────────────────────
export function useRevenueClaim(tokenAddress?: string | null, userAddress?: string | null) {
  let validatedToken: string | null = null;
  let validatedUser: string | null = null;

  try {
    if (tokenAddress?.trim()) validatedToken = getAddress(tokenAddress.trim());
    if (userAddress?.trim()) validatedUser = getAddress(userAddress.trim());
  } catch {
    validatedToken = null;
    validatedUser = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedToken ? (validatedToken as `0x${string}`) : undefined,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "getRevenueClaim",
    args: validatedUser ? [validatedUser as `0x${string}`] : undefined,
    enabled: Boolean(validatedToken && validatedUser),
  });

  return {
    claimableEth: data ? formatEther(data as bigint) : "0",
    claimableWei: data ? (data as bigint).toString() : "0",
    isLoading,
    error,
    refetch,
  };
}

// ── Claim Revenue ────────────────────────────────────────────────
export function useClaimRevenue(tokenAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validated: string | null = null;
  try {
    if (tokenAddress?.trim()) {
      validated = getAddress(tokenAddress.trim());
    }
  } catch {
    validated = null;
  }

  const claimRevenue = () => {
    if (!address) throw new Error("Connect wallet");
    if (!validated) throw new Error("Invalid token address");

    return writeContract({
      address: validated as `0x${string}`,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "claimRevenue",
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { claimRevenue, isPending, isConfirming, isSuccess, error, hash };
}

// ── Get Share Balance ────────────────────────────────────────────
export function useShareBalance(tokenAddress?: string | null, userAddress?: string | null) {
  let validatedToken: string | null = null;
  let validatedUser: string | null = null;

  try {
    if (tokenAddress?.trim()) validatedToken = getAddress(tokenAddress.trim());
    if (userAddress?.trim()) validatedUser = getAddress(userAddress.trim());
  } catch {
    validatedToken = null;
    validatedUser = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedToken ? (validatedToken as `0x${string}`) : undefined,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "balanceOf",
    args: validatedUser ? [validatedUser as `0x${string}`] : undefined,
    enabled: Boolean(validatedToken && validatedUser),
  });

  return {
    balance: data ? (data as bigint).toString() : "0",
    isLoading,
    error,
    refetch,
  };
}
