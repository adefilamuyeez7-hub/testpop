import {
  useAccount,
  useBalance,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeEventLog, getAddress, parseEther } from "viem";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import { ARTIST_DROP_ABI } from "@/lib/contracts/artDropArtist";
import { POAP_CAMPAIGN_ABI, POAP_CAMPAIGN_ADDRESS } from "@/lib/contracts/poapCampaign";

const unsupportedSharedArtDropMessage =
  "The shared ArtDrop contract path is retired. Use the per-artist contract hooks from useContractsArtist or the artist-specific exports in useContracts.";

type LegacyWriteHookResult = {
  isPending: false;
  isConfirming: false;
  isSuccess: false;
  error: Error;
  hash: undefined;
};

type LegacyReadHookResult = {
  isLoading: false;
  error: Error | null;
  refetch: () => Promise<void>;
};

function throwUnsupportedSharedArtDrop(): never {
  throw new Error(unsupportedSharedArtDropMessage);
}

async function rejectedRefetch(): Promise<void> {
  throw new Error(unsupportedSharedArtDropMessage);
}

function getUnsupportedLegacyWriteResult(): LegacyWriteHookResult {
  return {
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: new Error(unsupportedSharedArtDropMessage),
    hash: undefined,
  };
}

function getUnsupportedLegacyReadResult(hasParams = false): LegacyReadHookResult {
  return {
    isLoading: false,
    error: hasParams ? new Error(unsupportedSharedArtDropMessage) : null,
    refetch: rejectedRefetch,
  };
}

function normalizeAddress(address?: string | null) {
  if (!address?.trim()) {
    return null;
  }

  try {
    return getAddress(address.trim());
  } catch {
    return null;
  }
}

function parsePositiveEth(amount: string | number) {
  const amountStr = String(amount).trim();
  if (!amountStr) {
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

  return weiAmount;
}

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const {
    switchChain,
    isPending: isSwitchingNetwork,
    error: switchNetworkError,
  } = useSwitchChain();

  const connectWallet = async () => {
    const { openAppKit } = await import("@/lib/appKit");
    await openAppKit();
  };

  const isWrongNetwork = isConnected && chain?.id !== ACTIVE_CHAIN.id;

  const switchToActiveChain = async () => {
    await switchChain({ chainId: ACTIVE_CHAIN.id });
  };

  const requestActiveChainSwitch = async (reason?: string) => {
    if (!isConnected) {
      throw new Error("Connect wallet before switching network");
    }

    if (!isWrongNetwork) {
      return true;
    }

    const approved =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `${reason ? `${reason}\n\n` : ""}POPUP needs ${ACTIVE_CHAIN.name}.\n\nYour wallet is currently on ${chain?.name ?? "the wrong network"}.\nAllow POPUP to request a network switch now?`
          );

    if (!approved) {
      throw new Error(`Network change not approved. Please switch to ${ACTIVE_CHAIN.name} to continue.`);
    }

    await switchToActiveChain();
    return true;
  };

  return {
    address,
    isConnected,
    isConnecting: false,
    chain,
    isWrongNetwork,
    balance,
    connectWallet,
    switchToActiveChain,
    requestActiveChainSwitch,
    isSwitchingNetwork,
    switchNetworkError,
    disconnect,
  };
}

export function useCreateDrop() {
  return {
    createDrop: () => throwUnsupportedSharedArtDrop(),
    createdDropId: null,
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useMintDrop() {
  return {
    mint: () => throwUnsupportedSharedArtDrop(),
    mintedTokenId: null,
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useSubscribeArtist() {
  return {
    subscribe: async () => throwUnsupportedSharedArtDrop(),
    subscribedArtist: null,
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useArtistSubscriberCount(artistAddress?: string | null) {
  return {
    count: 0,
    ...getUnsupportedLegacyReadResult(Boolean(artistAddress)),
  };
}

export function useIsSubscribed(artistAddress?: string | null, userAddress?: string | null) {
  return {
    isSubscribed: false,
    ...getUnsupportedLegacyReadResult(Boolean(artistAddress || userAddress)),
  };
}

export function useCreateCampaign() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
    if (!address) {
      throw new Error("Connect wallet before creating a campaign");
    }

    return writeContract({
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
          return decoded.eventName === "CampaignCreated" ? Number(decoded.args.id) : null;
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { createCampaign, createdCampaignId, isPending, isConfirming, isSuccess, error, hash };
}

export function usePlaceBid() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBid = (campaignId: number, bidEth: string) => {
    if (!address) {
      throw new Error("Connect wallet before bidding");
    }

    return writeContract({
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

export function useArtDropDetails(dropId?: number | null) {
  return {
    data: null,
    ...getUnsupportedLegacyReadResult(dropId !== null && dropId !== undefined),
  };
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

export function useUserOwnedTokens(userAddress?: string | null) {
  return {
    balance: 0,
    isLoading: false,
    error: userAddress ? new Error(unsupportedSharedArtDropMessage) : null,
  };
}

export function useTokenURI(tokenId?: number | null) {
  return {
    uri: "",
    isLoading: false,
    error: tokenId !== null && tokenId !== undefined ? new Error(unsupportedSharedArtDropMessage) : null,
  };
}

export function useTokenDropId(tokenId?: number | null) {
  return {
    dropId: null,
    isLoading: false,
    error: tokenId !== null && tokenId !== undefined ? new Error(unsupportedSharedArtDropMessage) : null,
  };
}

export function useUserOwnedPOAPs(userAddress?: string | null) {
  const normalized = normalizeAddress(userAddress);
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: POAP_CAMPAIGN_ADDRESS,
    abi: POAP_CAMPAIGN_ABI,
    functionName: "balanceOf",
    args: normalized ? [normalized] : undefined,
    query: { enabled: Boolean(normalized) },
  });

  return {
    balance: balance ? Number(balance as bigint) : 0,
    isLoading: balanceLoading,
  };
}

export function useHasClaimedPOAP(campaignId?: number | null, userAddress?: string | null) {
  const normalized = normalizeAddress(userAddress);
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
    query: { enabled: campaignId !== null && campaignId !== undefined && Boolean(normalized) },
  });

  return {
    hasClaimed: Boolean(data),
    isLoading,
  };
}

export function useClaimPOAP() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async (campaignId: number) => {
    if (!address) {
      throw new Error("Connect wallet before claiming");
    }

    return writeContractAsync({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "claim",
      args: [BigInt(campaignId)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { claim, isPending, isConfirming, isSuccess, error, hash };
}

export function useTogglePause() {
  return {
    togglePause: () => throwUnsupportedSharedArtDrop(),
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useSettleAuction() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settleAuction = (campaignId: number) => {
    if (!address) {
      throw new Error("Connect wallet before settling auction");
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

export function useCancelCampaign() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelCampaign = (campaignId: number) => {
    if (!address) {
      throw new Error("Connect wallet before cancelling campaign");
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

export function useDistributePOAP() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const distribute = (campaignId: number, toAddress: string) => {
    if (!address) {
      throw new Error("Connect wallet before distributing POAP");
    }

    return writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "distribute",
      args: [BigInt(campaignId), getAddress(toAddress)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { distribute, isPending, isConfirming, isSuccess, error, hash };
}

export function useSubscribeToArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const validatedContract = normalizeAddress(artistContractAddress);

  const subscribe = (amountEth: string | number) => {
    if (!address) {
      throw new Error("Connect wallet before subscribing");
    }
    if (!validatedContract) {
      throw new Error("Invalid artist contract address");
    }

    return writeContract({
      address: validatedContract,
      abi: ARTIST_DROP_ABI,
      functionName: "subscribe",
      args: [],
      value: parsePositiveEth(amountEth),
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const subscriptionConfirmed =
    receipt?.logs.some((log) => {
      try {
        const decoded = decodeEventLog({
          abi: ARTIST_DROP_ABI,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "NewSubscription";
      } catch {
        return false;
      }
    }) ?? false;

  return { subscribe, subscriptionConfirmed, isPending, isConfirming, isSuccess, error, hash };
}

export function useCreateDropInArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const validatedContract = normalizeAddress(artistContractAddress);

  const createDrop = (
    metadataURI: string,
    priceEth: string,
    maxSupply: number,
    startTime: number,
    endTime: number
  ) => {
    if (!address) {
      throw new Error("Connect wallet to create a drop");
    }
    if (!validatedContract) {
      throw new Error("Invalid artist contract address");
    }
    if (!metadataURI.startsWith("ipfs://")) {
      throw new Error("Metadata URI must be a valid IPFS URI (ipfs://...)");
    }

    return writeContract({
      address: validatedContract,
      abi: ARTIST_DROP_ABI,
      functionName: "createDrop",
      args: [metadataURI, parseEther(priceEth), BigInt(maxSupply), BigInt(startTime), BigInt(endTime)],
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
          return decoded.eventName === "DropCreated" ? Number(decoded.args.dropId) : null;
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { createDrop, createdDropId, isPending, isConfirming, isSuccess, error, hash };
}

export function useMintFromArtistContract(artistContractAddress?: string | null) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const validatedContract = normalizeAddress(artistContractAddress);

  const mint = (dropId: number, priceWei: bigint) => {
    if (!address) {
      throw new Error("Connect wallet to mint");
    }
    if (!validatedContract) {
      throw new Error("Invalid artist contract address");
    }

    return writeContract({
      address: validatedContract,
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
          return decoded.eventName === "ArtMinted" ? Number(decoded.args.tokenId) : null;
        } catch {
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return { mint, mintedTokenId, isPending, isConfirming, isSuccess, error, hash };
}

export function useIsSubscribedToArtistContract(
  artistContractAddress?: string | null,
  userAddress?: string | null
) {
  const validatedContract = normalizeAddress(artistContractAddress);
  const validatedUser = normalizeAddress(userAddress);

  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ?? undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "isSubscriptionActive",
    args: validatedUser ? [validatedUser] : undefined,
    query: { enabled: Boolean(validatedContract && validatedUser) },
  });

  return {
    isSubscribed: Boolean(data),
    isLoading,
    error,
    refetch,
  };
}

export function useGetSubscriberCountFromArtistContract(artistContractAddress?: string | null) {
  const validatedContract = normalizeAddress(artistContractAddress);
  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ?? undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "getSubscriberCount",
    args: [],
    query: { enabled: Boolean(validatedContract) },
  });

  return {
    count: data ? Number(data as bigint) : 0,
    isLoading,
    error,
    refetch,
  };
}

export function useGetDropFromArtistContract(
  artistContractAddress?: string | null,
  dropId?: number | null
) {
  const validatedContract = normalizeAddress(artistContractAddress);
  const { data, isLoading, error, refetch } = useReadContract({
    address: validatedContract ?? undefined,
    abi: ARTIST_DROP_ABI,
    functionName: "getDrop",
    args: dropId !== null && dropId !== undefined ? [BigInt(dropId)] : undefined,
    query: { enabled: Boolean(validatedContract) && dropId !== null && dropId !== undefined },
  });

  return { data, isLoading, error, refetch };
}
