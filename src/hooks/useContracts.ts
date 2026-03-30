import { useEffect, useState, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { injected, walletConnect, coinbaseWallet, metaMask } from "wagmi/connectors";
import { createPublicClient, http, decodeEventLog, parseEther, getAddress } from "viem";
import { ACTIVE_CHAIN, appKit } from "@/lib/wagmi";
import { ART_DROP_ABI, ART_DROP_ADDRESS } from "@/lib/contracts/artDrop";
import { POAP_CAMPAIGN_ABI, POAP_CAMPAIGN_ADDRESS } from "@/lib/contracts/poapCampaign";

// ── Wallet ──────────────────────────────────────
export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  const connectWallet = () => {
    appKit.open();
  };

  return {
    address,
    isConnected,
    isConnecting,
    chain,
    balance,
    connectWallet,
    disconnect,
  };
}

// ── Art Drop: Create ────────────────────────────
export function useCreateDrop() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash });

  const createDrop = (
    metadataURI: string,
    priceEth: string,
    maxSupply: number,
    startTime: number,
    endTime: number
  ) => {
    if (!address) throw new Error("Connect wallet to create a drop");

    // Validate inputs
    if (!metadataURI || metadataURI.trim().length === 0) {
      throw new Error("Metadata URI cannot be empty");
    }

    // Validate URI format (ipfs://)
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

    if (weiPrice <= 0n) {
      throw new Error("Price must be greater than 0");
    }

    if (maxSupply < 0) {
      throw new Error("Supply cannot be negative");
    }

    if (endTime !== 0 && endTime <= startTime) {
      throw new Error("End time must be after start time");
    }

    // Log the parameters being sent
    console.log("🎨 Creating drop with params:", {
      metadataURI,
      priceWei: weiPrice.toString(),
      maxSupply,
      startTime,
      endTime,
      artist: address,
    });

    return writeContract({
      address: ART_DROP_ADDRESS,
      abi: ART_DROP_ABI,
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
            abi: ART_DROP_ABI,
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

// ── Art Drop: Mint ──────────────────────────────
export function useMintDrop() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (dropId: number, priceWei: bigint) => {
    if (!address) {
      throw new Error("Connect wallet to mint");
    }
    
    // Validate drop ID
    if (!Number.isInteger(dropId) || dropId < 0) {
      throw new Error(`Invalid drop ID: ${dropId}. Drop ID must be a positive integer from the contract.`);
    }
    
    // Allow free drops: priceWei can be 0 or greater
    if (priceWei < 0n) {
      throw new Error("Price cannot be negative");
    }
    
    console.log("🎨 Minting NFT:", {
      dropId,
      priceWei: priceWei.toString(),
      contractAddress: ART_DROP_ADDRESS,
      userAddress: address,
    });
    
    writeContract({
      address: ART_DROP_ADDRESS,
      abi: ART_DROP_ABI,
      functionName: "mint",
      args: [BigInt(dropId)],
      value: priceWei,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  // ✅ Parse ArtMinted event from receipt (like useCreateDrop does)
  const mintedTokenId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
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

// ── Art Drop: Subscribe artist ───────────────────
export function useSubscribeArtist() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const subscribe = async (artist: string, amountEth: string | number) => {
    if (!address) {
      throw new Error("Connect wallet before subscribing");
    }
    
    if (!artist || artist.trim() === "") {
      throw new Error("Invalid artist address");
    }
    
    // ✅ Validate artist address is properly formatted (ERC-55 checksum)
    let validatedArtist: string;
    try {
      validatedArtist = getAddress(artist.trim());
    } catch (err) {
      throw new Error(`Invalid artist address format: ${artist}`);
    }
    
    // Convert to string if it's a number
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

    console.log("🎨 Subscribing to artist:", {
      artist: validatedArtist,
      amountEth: amountStr,
      weiAmount: weiAmount.toString(),
      subscriber: address,
    });

    return writeContract({
      address: ART_DROP_ADDRESS,
      abi: ART_DROP_ABI,
      functionName: "subscribe",
      args: [validatedArtist],
      value: weiAmount,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  // ✅ Parse ArtistSubscribed event from receipt
  const subscribedArtist =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "ArtistSubscribed") return null;
          console.log("✅ Subscription confirmed:", decoded.args);
          return decoded.args.artist as string;
        } catch {
          return null;
        }
      })
      .find((value): value is string => Boolean(value)) ?? null;

  return { subscribe, subscribedArtist, isPending, isConfirming, isSuccess, error, hash };
}

// ── Art Drop: Artist subscription stats ──────────
export function useArtistSubscriberCount(artistAddress?: string | null) {
  let normalized: string | null = null;
  
  try {
    // Use getAddress for proper ERC-55 checksumming
    if (artistAddress?.trim()) {
      normalized = getAddress(artistAddress.trim());
    }
  } catch {
    // If address is invalid, normalized stays null
    normalized = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "subscribers",
    args: [normalized ?? "0x0000000000000000000000000000000000000000"],
    enabled: Boolean(normalized),
  });

  return {
    count: data ? Number(data as bigint) : 0,
    isLoading,
    error,
    refetch,
  };
}

// ── Art Drop: Check if signup subscription exists for user
export function useIsSubscribed(artistAddress?: string | null, userAddress?: string | null) {
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

  // Use the new contract view function: isSubscribed(address artist, address subscriber)
  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "isSubscribed",
    args: normalizedArtist && normalizedUser ? [normalizedArtist, normalizedUser] : undefined,
    enabled: Boolean(normalizedArtist && normalizedUser),
  });

  return {
    isSubscribed: data ? Boolean(data as boolean) : false,
    isLoading,
    error,
    refetch,
  };
}

// ── POAP: Create Campaign ───────────────────────
export function useCreateCampaign() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash });

  const createCampaign = (
    uri: string,
    type: number,
    maxSupply: number,
    startTime: number,
    endTime: number,
    subPct: number,
    bidPct: number,
    creatorPct: number
  ) => {
    if (!address) return;
    writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "createCampaign",
      args: [uri, type, BigInt(maxSupply), BigInt(startTime), BigInt(endTime), subPct, bidPct, creatorPct],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const createdCampaignId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: POAP_CAMPAIGN_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "CampaignCreated") return null;
          return Number(decoded.args.id);
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { createCampaign, createdCampaignId, isPending, isConfirming, isSuccess, error, hash };
}

// ── POAP: Place Bid ─────────────────────────────
export function usePlaceBid() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBid = (campaignId: number, bidEth: string) => {
    if (!address) return;
    writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "placeBid",
      args: [BigInt(campaignId)],
      value: parseEther(bidEth),
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { placeBid, isPending, isConfirming, isSuccess, error, hash };
}

export function useArtDropDetails(dropId?: number | null, enabled = true) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "drops",
    args: dropId === null || dropId === undefined ? undefined : [BigInt(dropId)],
    query: {
      enabled: enabled && dropId !== null && dropId !== undefined,
    },
  });

  return { data, isLoading, error, refetch };
}

export function useCampaignDetails(campaignId?: number | null, enabled = true) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: POAP_CAMPAIGN_ADDRESS,
    abi: POAP_CAMPAIGN_ABI,
    functionName: "campaigns",
    args: campaignId === null || campaignId === undefined ? undefined : [BigInt(campaignId)],
    query: {
      enabled: enabled && campaignId !== null && campaignId !== undefined,
    },
  });

  return { data, isLoading, error, refetch };
}

// ── Art Drop: Get user's owned NFTs ──────────────
export function useUserOwnedTokens(userAddress?: string | null) {
  const normalized = userAddress ? getAddress(userAddress) : undefined;

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "balanceOf",
    args: normalized ? [normalized] : undefined,
    enabled: Boolean(normalized),
  });

  return {
    balance: balance ? Number(balance as bigint) : 0,
    isLoading: balanceLoading,
  };
}

// ── Art Drop: Get specific token URI ────────────
export function useTokenURI(tokenId?: number | null) {
  const { data, isLoading } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "tokenURI",
    args: tokenId !== null && tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    enabled: tokenId !== null && tokenId !== undefined,
  });

  return {
    uri: (data as string) || "",
    isLoading,
  };
}

// ── Art Drop: Get token's drop ID ───────────────
export function useTokenDropId(tokenId?: number | null) {
  const { data, isLoading } = useReadContract({
    address: ART_DROP_ADDRESS,
    abi: ART_DROP_ABI,
    functionName: "tokenDrop",
    args: tokenId !== null && tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    enabled: tokenId !== null && tokenId !== undefined,
  });

  return {
    dropId: data ? Number(data as bigint) : null,
    isLoading,
  };
}

// ── POAP: Get user's owned POAPs ────────────────
export function useUserOwnedPOAPs(userAddress?: string | null) {
  const normalized = userAddress ? getAddress(userAddress) : undefined;

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: POAP_CAMPAIGN_ADDRESS,
    abi: POAP_CAMPAIGN_ABI,
    functionName: "balanceOf",
    args: normalized ? [normalized] : undefined,
    enabled: Boolean(normalized),
  });

  return {
    balance: balance ? Number(balance as bigint) : 0,
    isLoading: balanceLoading,
  };
}

// ── POAP: Check if user claimed a specific campaign ─
export function useHasClaimedPOAP(campaignId?: number | null, userAddress?: string | null) {
  const normalized = userAddress ? getAddress(userAddress) : undefined;

  const { data, isLoading } = useReadContract({
    address: POAP_CAMPAIGN_ADDRESS,
    abi: POAP_CAMPAIGN_ABI,
    functionName: "claimed",
    args:
      campaignId !== null &&
      campaignId !== undefined &&
      normalized
        ? [BigInt(campaignId), normalized]
        : undefined,
    enabled:
      campaignId !== null && campaignId !== undefined && Boolean(normalized),
  });

  return {
    hasClaimed: (data as boolean) || false,
    isLoading,
  };
}

// ── POAP: Claim POAP from campaign ──────────────
export function useClaimPOAP() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async (campaignId: number) => {
    if (!address) throw new Error("Connect wallet before claiming");

    return new Promise((resolve, reject) => {
      writeContract(
        {
          address: POAP_CAMPAIGN_ADDRESS,
          abi: POAP_CAMPAIGN_ABI,
          functionName: "claim",
          args: [BigInt(campaignId)],
          account: address,
          chain: ACTIVE_CHAIN,
        },
        {
          onSuccess: (hash) => {
            resolve(hash);
          },
          onError: (err) => {
            reject(err);
          },
        }
      );
    });
  };

  return { claim, isPending, isConfirming, isSuccess, error, hash };
}

// ── Art Drop: Toggle pause on drop ──────────────
export function useTogglePause() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const togglePause = (dropId: number) => {
    if (!address) throw new Error("Connect wallet before toggling pause");

    if (!Number.isInteger(dropId) || dropId < 0) {
      throw new Error(`Invalid drop ID: ${dropId}`);
    }

    return writeContract({
      address: ART_DROP_ADDRESS,
      abi: ART_DROP_ABI,
      functionName: "togglePause",
      args: [BigInt(dropId)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { togglePause, isPending, isConfirming, isSuccess, error, hash };
}

// ── POAP: Settle auction campaign ───────────────
export function useSettleAuction() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settleAuction = (campaignId: number) => {
    if (!address) throw new Error("Connect wallet before settling auction");

    if (!Number.isInteger(campaignId) || campaignId < 0) {
      throw new Error(`Invalid campaign ID: ${campaignId}`);
    }

    return writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "settleAuction",
      args: [BigInt(campaignId)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { settleAuction, isPending, isConfirming, isSuccess, error, hash };
}

// ── POAP: Cancel campaign ───────────────────────
export function useCancelCampaign() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelCampaign = (campaignId: number) => {
    if (!address) throw new Error("Connect wallet before cancelling campaign");

    if (!Number.isInteger(campaignId) || campaignId < 0) {
      throw new Error(`Invalid campaign ID: ${campaignId}`);
    }

    return writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "cancelCampaign",
      args: [BigInt(campaignId)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { cancelCampaign, isPending, isConfirming, isSuccess, error, hash };
}

// ── POAP: Distribute POAP to address ────────────
export function useDistributePOAP() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const distribute = (campaignId: number, toAddress: string) => {
    if (!address) throw new Error("Connect wallet before distributing POAP");

    if (!Number.isInteger(campaignId) || campaignId < 0) {
      throw new Error(`Invalid campaign ID: ${campaignId}`);
    }

    const normalized = getAddress(toAddress);

    return writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "distribute",
      args: [BigInt(campaignId), normalized],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { distribute, isPending, isConfirming, isSuccess, error, hash };
}

// ═══════════════════════════════════════════════════════════════
// ✨ NEW: Artist-Specific Contract Hooks
// Each artist has their own ArtDrop contract instance via factory
// ═══════════════════════════════════════════════════════════════

// ── Subscribe to Artist's Contract ───────────────────────────
/**
 * Hook to subscribe to an artist's individual contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 */
export function useSubscribeToArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validatedContract: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
  } catch {
    validatedContract = null;
  }

  const subscribe = (amountEth: string | number) => {
    if (!address) {
      throw new Error("Connect wallet before subscribing");
    }

    if (!validatedContract) {
      throw new Error("Invalid artist contract address");
    }

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
      contractAddress: validatedContract,
      amountEth: amountStr,
      weiAmount: weiAmount.toString(),
      subscriber: address,
    });

    return writeContract({
      address: validatedContract as `0x${string}`,
      abi: ART_DROP_ABI,
      functionName: "subscribe",
      args: [],
      value: weiAmount,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  // Parse NewSubscription event
  const subscriptionConfirmed =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "NewSubscription") return null;
          console.log("✅ Subscription confirmed:", decoded.args);
          return true;
        } catch {
          return null;
        }
      })
      .find((v) => v === true) ?? false;

  return { subscribe, subscriptionConfirmed, isPending, isConfirming, isSuccess, error, hash };
}

// ── Create Drop in Artist Contract ───────────────────────────
/**
 * Hook to create a drop in an artist's individual ArtDrop contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 */
export function useCreateDropInArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validatedContract: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
  } catch {
    validatedContract = null;
  }

  const createDrop = (
    metadataURI: string,
    priceEth: string,
    maxSupply: number,
    startTime: number,
    endTime: number
  ) => {
    if (!address) throw new Error("Connect wallet to create a drop");
    if (!validatedContract) throw new Error("Invalid artist contract address");
    if (!metadataURI || !metadataURI.startsWith("ipfs://")) {
      throw new Error("Metadata URI must be a valid IPFS URI (ipfs://...)");
    }

    let weiPrice: bigint;
    try {
      weiPrice = parseEther(priceEth);
    } catch {
      throw new Error(`Invalid price format: "${priceEth}"`);
    }

    console.log("🎨 Creating drop in artist contract:", {
      contractAddress: validatedContract,
      metadataURI,
      priceWei: weiPrice.toString(),
      maxSupply,
      startTime,
      endTime,
    });

    return writeContract({
      address: validatedContract as `0x${string}`,
      abi: ART_DROP_ABI,
      functionName: "createDrop",
      args: [metadataURI, weiPrice, BigInt(maxSupply), BigInt(startTime), BigInt(endTime)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  // Parse DropCreated event
  const createdDropId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
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

// ── Mint from Artist Contract ──────────────────────────────
/**
 * Hook to mint an NFT from an artist's individual ArtDrop contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 */
export function useMintFromArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  let validatedContract: string | null = null;
  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
  } catch {
    validatedContract = null;
  }

  const mint = (dropId: number, priceWei: bigint) => {
    if (!address) throw new Error("Connect wallet to mint");
    if (!validatedContract) throw new Error("Invalid artist contract address");
    if (!Number.isInteger(dropId) || dropId < 0) {
      throw new Error(`Invalid drop ID: ${dropId}`);
    }

    console.log("🎨 Minting NFT from artist contract:", {
      contractAddress: validatedContract,
      dropId,
      priceWei: priceWei.toString(),
      userAddress: address,
    });

    return writeContract({
      address: validatedContract as `0x${string}`,
      abi: ART_DROP_ABI,
      functionName: "mint",
      args: [BigInt(dropId)],
      value: priceWei,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  // Parse ArtMinted event
  const mintedTokenId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: ART_DROP_ABI,
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

// ── Check subscription in Artist Contract ──────────────────
/**
 * Hook to check if a user is subscribed to an artist's contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 * @param userAddress The user's wallet address
 */
export function useIsSubscribedToArtistContract(
  artistContractAddress?: string | null,
  userAddress?: string | null
) {
  let validatedContract: string | null = null;
  let validatedUser: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
    if (userAddress?.trim()) {
      validatedUser = getAddress(userAddress.trim());
    }
  } catch {
    validatedContract = null;
    validatedUser = null;
  }

  // This contract's isSubscribed takes only subscriber address (artist is implicit)
  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ? (validatedContract as `0x${string}`) : undefined,
    abi: ART_DROP_ABI,
    functionName: "isSubscribed",
    args: validatedUser ? [validatedUser] : undefined,
    enabled: Boolean(validatedContract && validatedUser),
  });

  return {
    isSubscribed: data ? Boolean(data as boolean) : false,
    isLoading,
    error,
    refetch,
  };
}

// ── Get subscriber count from Artist Contract ────────────
/**
 * Hook to get total subscribers of an artist from their contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 */
export function useGetSubscriberCountFromArtistContract(artistContractAddress?: string | null) {
  let validatedContract: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
  } catch {
    validatedContract = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ? (validatedContract as `0x${string}`) : undefined,
    abi: ART_DROP_ABI,
    functionName: "getSubscriberCount",
    args: [],
    enabled: Boolean(validatedContract),
  });

  return {
    count: data ? Number(data as bigint) : 0,
    isLoading,
    error,
    refetch,
  };
}

// ── Get Drop from Artist Contract ──────────────────────────
/**
 * Hook to fetch drop details from an artist's individual contract
 * @param artistContractAddress The artist's deployed ArtDrop contract address
 * @param dropId The drop ID
 */
export function useGetDropFromArtistContract(
  artistContractAddress?: string | null,
  dropId?: number | null
) {
  let validatedContract: string | null = null;

  try {
    if (artistContractAddress?.trim()) {
      validatedContract = getAddress(artistContractAddress.trim());
    }
  } catch {
    validatedContract = null;
  }

  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ? (validatedContract as `0x${string}`) : undefined,
    abi: ART_DROP_ABI,
    functionName: "getDrop",
    args: dropId !== null && dropId !== undefined ? [BigInt(dropId)] : undefined,
    enabled: Boolean(validatedContract && dropId !== null && dropId !== undefined),
  });

  return { data, isLoading, error, refetch };
}
