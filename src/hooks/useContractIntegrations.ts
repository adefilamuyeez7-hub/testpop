/**
 * Missing Contract Integration Hooks
 * Implements: Factory, ArtistSharesToken functions
 */

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther, getAddress } from "viem";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts/artDropFactory";
import { ARTIST_SHARES_TOKEN_ADDRESS, ARTIST_SHARES_TOKEN_ABI } from "@/lib/contracts/artistSharesToken";

// ── Factory: Deploy Artist Contract ─────────────────
/**
 * Deploys a new per-artist ArtDrop contract for the connected wallet
 * Only works if caller is contract owner
 */
export function useDeployArtistContract() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const deploy = async (artistWallet: string) => {
    if (!address) {
      throw new Error("Connect wallet to deploy contract");
    }

    // Validate artist wallet
    let validatedArtist: string;
    try {
      validatedArtist = getAddress(artistWallet.trim());
    } catch (err) {
      throw new Error(`Invalid artist wallet: ${artistWallet}`);
    }

    console.log("🏭 Deploying artist contract for:", validatedArtist);

    try {
      const txHash = await writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "deployArtDrop",
        args: [validatedArtist],
        account: address,
        chain: ACTIVE_CHAIN,
      });
      console.log("📤 Transaction submitted:", txHash);
      return txHash;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ Deploy write operation failed:", errorMsg);
      throw new Error(`Failed to deploy contract: ${errorMsg}`);
    }
  };

  const error = writeError || receiptError;

  return { deploy, isPending, isConfirming, isSuccess, error, hash, receipt };
}

// ── Factory: Get Artist Contract ────────────────────
/**
 * Fetches the deployed contract address for an artist
 */
export function useGetArtistContract(artistWallet: string | undefined) {
  const { data } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getArtistContract",
    args: artistWallet ? [getAddress(artistWallet)] : undefined,
    query: { enabled: !!artistWallet },
  });

  return data as string | undefined;
}

// ── Artist Shares: Launch Campaign ──────────────────
/**
 * Artist launches a fundraising campaign to sell shares
 * @param targetETH - Total ETH to raise
 * @param totalShares - Total shares to issue
 * @param durationDays - Campaign duration in days
 */
export function useLaunchSharesCampaign() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const launch = async (targetETH: string, totalShares: string, durationDays: number) => {
    if (!address) {
      throw new Error("Connect wallet to launch campaign");
    }

    // Validate inputs
    if (!targetETH || parseFloat(targetETH) <= 0) {
      throw new Error("Target amount must be greater than 0");
    }

    if (!totalShares || parseInt(totalShares) <= 0) {
      throw new Error("Total shares must be greater than 0");
    }

    if (durationDays <= 0 || durationDays > 365) {
      throw new Error("Duration must be between 1 and 365 days");
    }

    const targetWei = parseEther(targetETH);

    console.log("💰 Launching shares campaign:", {
      targetETH,
      totalShares,
      durationDays,
      targetWei: targetWei.toString(),
    });

    return writeContract({
      address: ARTIST_SHARES_TOKEN_ADDRESS,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "launchCampaign",
      args: [targetWei, BigInt(totalShares), BigInt(durationDays)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { launch, isPending, isConfirming, isSuccess, error, hash, receipt };
}

// ── Artist Shares: Buy Shares ───────────────────────
/**
 * Investor buys shares during active campaign
 * @param amountETH - Amount of ETH to invest
 */
export function useBuyShares() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buyShares = async (amountETH: string) => {
    if (!address) {
      throw new Error("Connect wallet to buy shares");
    }

    if (!amountETH || parseFloat(amountETH) <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const amountWei = parseEther(amountETH);

    console.log("🛒 Buying shares:", {
      amountETH,
      amountWei: amountWei.toString(),
      buyer: address,
    });

    return writeContract({
      address: ARTIST_SHARES_TOKEN_ADDRESS,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "buyShares",
      args: [amountWei],
      value: amountWei,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { buyShares, isPending, isConfirming, isSuccess, error, hash, receipt };
}

// ── Artist Shares: Claim Pending Refund ─────────────
/**
 * Claims pending refund from failed campaign
 */
export function useClaimPendingRefund() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimRefund = async () => {
    if (!address) {
      throw new Error("Connect wallet to claim refund");
    }

    console.log("📦 Claiming pending refund for:", address);

    return writeContract({
      address: ARTIST_SHARES_TOKEN_ADDRESS,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "claimPendingRefund",
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { claimRefund, isPending, isConfirming, isSuccess, error, hash, receipt };
}

// ── Artist Shares: Get Campaign Status ──────────────
/**
 * Fetches current campaign status
 */
export function useCampaignStatus() {
  const { data } = useReadContract({
    address: ARTIST_SHARES_TOKEN_ADDRESS,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "getCampaignStatus",
  });

  if (!data) return null;

  const [targetAmount, raised, pricePerShare, endTime, active] = data as any[];
  return {
    targetAmount,
    raised,
    pricePerShare,
    endTime,
    active,
    progressPercent: (Number(raised) / Number(targetAmount)) * 100,
  };
}

// ── Artist Shares: Get Revenue Claim ────────────────
/**
 * Gets claimable revenue for a shareholder
 */
export function useGetRevenueClaim(shareholderAddress: string | undefined) {
  const { data } = useReadContract({
    address: ARTIST_SHARES_TOKEN_ADDRESS,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "getRevenueClaim",
    args: shareholderAddress ? [getAddress(shareholderAddress)] : undefined,
    query: { enabled: !!shareholderAddress },
  });

  return data as bigint | undefined;
}

// ── Artist Shares: Claim Revenue ────────────────────
/**
 * Claims revenue share for a shareholder
 */
export function useClaimRevenue() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async () => {
    if (!address) {
      throw new Error("Connect wallet to claim revenue");
    }

    console.log("💸 Claiming revenue for:", address);

    return writeContract({
      address: ARTIST_SHARES_TOKEN_ADDRESS,
      abi: ARTIST_SHARES_TOKEN_ABI,
      functionName: "claimRevenue",
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { claim, isPending, isConfirming, isSuccess, error, hash, receipt };
}

// ── Artist Shares: Get Investor Count ───────────────
/**
 * Gets total number of investors in campaign
 */
export function useInvestorCount() {
  const { data } = useReadContract({
    address: ARTIST_SHARES_TOKEN_ADDRESS,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "getInvestorCount",
  });

  return Number(data) || 0;
}

// ── Artist Shares: Get Pending Refund ───────────────
/**
 * Gets pending refund amount for current user
 */
export function usePendingRefund(userAddress: string | undefined) {
  const { data } = useReadContract({
    address: ARTIST_SHARES_TOKEN_ADDRESS,
    abi: ARTIST_SHARES_TOKEN_ABI,
    functionName: "pendingWithdrawals",
    args: userAddress ? [getAddress(userAddress)] : undefined,
    query: { enabled: !!userAddress },
  });

  return data as bigint | undefined;
}
