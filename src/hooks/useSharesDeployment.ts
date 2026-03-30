import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCallback } from "react";
import { ARTIST_SHARES_TOKEN_ADDRESS, ARTIST_SHARES_TOKEN_ABI } from "@/lib/contracts/artistSharesToken";
import { Address, parseEther } from "viem";

/**
 * Hook to launch a shares fundraising campaign
 * Allows artists to raise funds by selling shares of upcoming projects
 */
export function useLaunchSharesCampaign(tokenAddress?: string | null) {
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();

  const launchCampaign = useCallback(
    async (args: {
      targetEthAmount: string | number;
      sharesToIssue: string | number;
      durationDays: number;
    }) => {
      if (!tokenAddress) {
        console.error("No shares token contract address provided");
        return null;
      }

      try {
        const targetEth = typeof args.targetEthAmount === "string" 
          ? parseEther(args.targetEthAmount)
          : BigInt(args.targetEthAmount);

        const sharesToIssue = typeof args.sharesToIssue === "string"
          ? parseEther(args.sharesToIssue)
          : BigInt(args.sharesToIssue);

        writeContract({
          address: tokenAddress as Address,
          abi: ARTIST_SHARES_TOKEN_ABI,
          functionName: "launchCampaign",
          args: [targetEth, sharesToIssue, BigInt(args.durationDays)],
        });

        return { success: true };
      } catch (err) {
        console.error("Error launching campaign:", err);
        return { success: false, error: err };
      }
    },
    [tokenAddress, writeContract]
  );

  return {
    launchCampaign,
    hash,
    isPending,
    isError,
    error,
  };
}

/**
 * Hook to buy shares from an active campaign
 */
export function useBuyShares(tokenAddress?: string | null) {
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();

  const buyShares = useCallback(
    async (amountEth: string | number) => {
      if (!tokenAddress) {
        console.error("No shares token contract address provided");
        return null;
      }

      try {
        const value = typeof amountEth === "string"
          ? parseEther(amountEth.toString())
          : BigInt(amountEth);

        writeContract({
          address: tokenAddress as Address,
          abi: ARTIST_SHARES_TOKEN_ABI,
          functionName: "buyShares",
          args: [value],
          value: value,
        });

        return { success: true };
      } catch (err) {
        console.error("Error buying shares:", err);
        return { success: false, error: err };
      }
    },
    [tokenAddress, writeContract]
  );

  return {
    buyShares,
    hash,
    isPending,
    isError,
    error,
  };
}

/**
 * Hook to get campaign status
 */
export function useCampaignStatus(tokenAddress?: string | null) {
  // This would use useReadContract to fetch campaign details
  // Implementation depends on ABI structure
  return {
    isActive: false,
    targetEth: "0",
    raisedEth: "0",
    pricePerShare: "0",
    daysRemaining: 0,
  };
}

/**
 * Hook to claim revenue as a shareholder
 */
export function useClaimRevenue(tokenAddress?: string | null) {
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();

  const claimRevenue = useCallback(async () => {
    if (!tokenAddress) {
      console.error("No shares token contract address provided");
      return null;
    }

    try {
      writeContract({
        address: tokenAddress as Address,
        abi: ARTIST_SHARES_TOKEN_ABI,
        functionName: "claimRevenue",
        args: [],
      });

      return { success: true };
    } catch (err) {
      console.error("Error claiming revenue:", err);
      return { success: false, error: err };
    }
  }, [tokenAddress, writeContract]);

  return {
    claimRevenue,
    hash,
    isPending,
    isError,
    error,
  };
}

/**
 * Hook to distribute revenue to shareholders (artist action)
 */
export function useDistributeRevenue(tokenAddress?: string | null) {
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();

  const distributeRevenue = useCallback(
    async (amountEth: string | number) => {
      if (!tokenAddress) {
        console.error("No shares token contract address provided");
        return null;
      }

      try {
        const amount = typeof amountEth === "string"
          ? parseEther(amountEth.toString())
          : BigInt(amountEth);

        writeContract({
          address: tokenAddress as Address,
          abi: ARTIST_SHARES_TOKEN_ABI,
          functionName: "distributeRevenue",
          args: [amount],
          value: amount,
        });

        return { success: true };
      } catch (err) {
        console.error("Error distributing revenue:", err);
        return { success: false, error: err };
      }
    },
    [tokenAddress, writeContract]
  );

  return {
    distributeRevenue,
    hash,
    isPending,
    isError,
    error,
  };
}
