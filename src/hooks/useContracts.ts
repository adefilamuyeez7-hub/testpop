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
import { openWalletApprovalModal } from "@/lib/appKit";

const unsupportedSharedArtDropMessage =
  "The shared ArtDrop contract path is retired. Use the per-artist contract hooks from useContractsArtist or the artist-specific exports in useContracts.";
const legacyPoapCampaignMessage =
  "Legacy POAPCampaign v1 actions are disabled while POPUP migrates auction and claim flows to the safer V2 design.";

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
    const { openWalletConnectModal } = await import("@/lib/appKit");
    await openWalletConnectModal();
  };

  const isWrongNetwork = isConnected && chain?.id !== ACTIVE_CHAIN.id;

  const switchToActiveChain = async () => {
    const { openWalletNetworkModal } = await import("@/lib/appKit");
    await openWalletNetworkModal();
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
  return {
    createCampaign: () => {
      throw new Error(legacyPoapCampaignMessage);
    },
    createdCampaignId: null,
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function usePlaceBid() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBid = (campaignId: number, bidAmount: string | number) => {
    if (!address) {
      throw new Error("Connect wallet before placing a bid");
    }
    if (!Number.isInteger(campaignId) || campaignId < 0) {
      throw new Error(`Invalid campaign ID: ${campaignId}`);
    }

    const value = parsePositiveEth(bidAmount);

    return writeContract({
      address: POAP_CAMPAIGN_ADDRESS,
      abi: POAP_CAMPAIGN_ABI,
      functionName: "placeBid",
      args: [BigInt(campaignId)],
      value,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const bidConfirmed =
    receipt?.logs.some((log) => {
      try {
        const decoded = decodeEventLog({
          abi: POAP_CAMPAIGN_ABI,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "BidPlaced";
      } catch {
        return false;
      }
    }) ?? false;

  return { placeBid, bidConfirmed, isPending, isConfirming, isSuccess, error, hash };
}

export function useArtDropDetails(dropId?: number | null) {
  return {
    data: null,
    ...getUnsupportedLegacyReadResult(dropId !== null && dropId !== undefined),
  };
}

export function useCampaignDetails(campaignId?: number | null, enabled = true) {
  return {
    data: null,
    ...getUnsupportedLegacyReadResult(Boolean(enabled && campaignId !== null && campaignId !== undefined)),
  };
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
  return {
    balance: 0,
    isLoading: false,
  };
}

export function useHasClaimedPOAP(campaignId?: number | null, userAddress?: string | null) {
  return {
    hasClaimed: false,
    isLoading: false,
  };
}

export function useClaimPOAP() {
  return {
    claim: async () => {
      throw new Error(legacyPoapCampaignMessage);
    },
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useTogglePause() {
  return {
    togglePause: () => throwUnsupportedSharedArtDrop(),
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useSettleAuction() {
  return {
    settleAuction: () => {
      throw new Error(legacyPoapCampaignMessage);
    },
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useCancelCampaign() {
  return {
    cancelCampaign: () => {
      throw new Error(legacyPoapCampaignMessage);
    },
    ...getUnsupportedLegacyWriteResult(),
  };
}

export function useDistributePOAP() {
  return {
    distribute: () => {
      throw new Error(legacyPoapCampaignMessage);
    },
    ...getUnsupportedLegacyWriteResult(),
  };
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
