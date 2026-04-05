import { useMemo } from "react";
import {
  decodeEventLog,
  getAddress,
  parseEther,
  zeroAddress,
} from "viem";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import {
  POAP_CAMPAIGN_V2_ABI,
  POAP_CAMPAIGN_V2_ADDRESS,
} from "@/lib/contracts/poapCampaignV2";
import { openWalletApprovalModal } from "@/lib/appKit";

export type CampaignV2EntryMode = "eth" | "content" | "both";

export function entryModeToIndex(entryMode: CampaignV2EntryMode): 0 | 1 | 2 {
  if (entryMode === "content") return 1;
  if (entryMode === "both") return 2;
  return 0;
}

function normalizeAddress(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    return getAddress(value.trim());
  } catch {
    return null;
  }
}

function resolveCampaignContractAddress(contractAddress?: string | null) {
  return normalizeAddress(contractAddress) ?? POAP_CAMPAIGN_V2_ADDRESS;
}

export function useCreateCampaignV2() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const createCampaign = (params: {
    metadataUri: string;
    entryMode: CampaignV2EntryMode;
    maxSupply: number;
    ticketPriceEth: string;
    startTime: number;
    endTime: number;
    redeemStartTime: number;
  }) => {
    if (!address) throw new Error("Connect wallet to create a campaign");
    if (!params.metadataUri?.startsWith("ipfs://")) {
      throw new Error("Campaign metadata must be pinned to IPFS first");
    }
    if (params.maxSupply <= 0) {
      throw new Error("Campaign supply must be greater than 0");
    }

    const entryMode = entryModeToIndex(params.entryMode);
    const ticketPriceWei =
      params.entryMode === "content" ? 0n : parseEther(params.ticketPriceEth || "0");

    void openWalletApprovalModal().catch((error) => {
      console.warn("Unable to open wallet approval modal:", error);
    });

    return writeContract({
      address: POAP_CAMPAIGN_V2_ADDRESS,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "createCampaign",
      args: [
        params.metadataUri,
        entryMode,
        BigInt(params.maxSupply),
        ticketPriceWei,
        BigInt(params.startTime),
        BigInt(params.endTime),
        BigInt(params.redeemStartTime),
      ],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  const createdCampaignId =
    receipt?.logs
      .map((log) => {
        try {
          const decoded = decodeEventLog({
            abi: POAP_CAMPAIGN_V2_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "CampaignCreated") {
            return Number(decoded.args.campaignId);
          }
          return null;
        } catch (error) {
          console.warn("Failed to decode log:", error, log);
          return null;
        }
      })
      .find((value): value is number => typeof value === "number") ?? null;

  return {
    createCampaign,
    createdCampaignId,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useBuyCampaignEntriesV2() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buyEntries = (
    contractAddress: string | null | undefined,
    campaignId: number,
    quantity: number,
    ticketPriceEth: string
  ) => {
    if (!address) throw new Error("Connect wallet to buy entries");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be at least 1");
    }

    const totalValue = parseEther(ticketPriceEth || "0") * BigInt(quantity);

    void openWalletApprovalModal().catch((error) => {
      console.warn("Unable to open wallet approval modal:", error);
    });

    return writeContract({
      address: resolveCampaignContractAddress(contractAddress),
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "buyEntries",
      args: [BigInt(campaignId), BigInt(quantity)],
      value: totalValue,
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { buyEntries, hash, isPending, isConfirming, isSuccess, error };
}

export function useRedeemCampaignV2() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const redeem = (contractAddress: string | null | undefined, campaignId: number, quantity: number) => {
    if (!address) throw new Error("Connect wallet to redeem");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be at least 1");
    }

    void openWalletApprovalModal().catch((error) => {
      console.warn("Unable to open wallet approval modal:", error);
    });

    return writeContract({
      address: resolveCampaignContractAddress(contractAddress),
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "redeem",
      args: [BigInt(campaignId), BigInt(quantity)],
      account: address,
      chain: ACTIVE_CHAIN,
    });
  };

  return { redeem, hash, isPending, isConfirming, isSuccess, error };
}

export function useCampaignV2State(
  campaignId?: number | null,
  wallet?: string | null,
  contractAddress?: string | null
) {
  const normalizedWallet = normalizeAddress(wallet);
  const enabled = campaignId !== null && campaignId !== undefined;
  const resolvedAddress = resolveCampaignContractAddress(contractAddress);

  const contracts = [
    {
      address: resolvedAddress,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "campaigns",
      args: [BigInt(campaignId ?? 0)],
    },
    {
      address: resolvedAddress,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "ethCredits",
      args: [BigInt(campaignId ?? 0), normalizedWallet ?? zeroAddress],
    },
    {
      address: resolvedAddress,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "contentCredits",
      args: [BigInt(campaignId ?? 0), normalizedWallet ?? zeroAddress],
    },
    {
      address: resolvedAddress,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "redeemedCredits",
      args: [BigInt(campaignId ?? 0), normalizedWallet ?? zeroAddress],
    },
    {
      address: resolvedAddress,
      abi: POAP_CAMPAIGN_V2_ABI,
      functionName: "getRedeemableCount",
      args: [BigInt(campaignId ?? 0), normalizedWallet ?? zeroAddress],
    },
  ] as const;

  const campaignStateQuery = useReadContracts({
    contracts,
    query: { enabled },
    allowFailure: false,
  });

  const campaign = useMemo(() => {
    const value = campaignStateQuery.data?.[0]?.result;
    if (!value) return null;
    return {
      artist: value[0] || zeroAddress,
      metadataUri: value[1] || "",
      entryMode: Number(value[2] ?? 0),
      status: Number(value[3] ?? 0),
      maxSupply: Number(value[4] ?? 0n),
      minted: Number(value[5] ?? 0n),
      ticketPriceWei: value[6] ?? 0n,
      startTime: Number(value[7] ?? 0n),
      endTime: Number(value[8] ?? 0n),
      redeemStartTime: Number(value[9] ?? 0n),
    };
  }, [campaignStateQuery.data]);

  return {
    contractAddress: resolvedAddress,
    campaign,
    ethCredits: Number(campaignStateQuery.data?.[1]?.result ?? 0n),
    contentCredits: Number(campaignStateQuery.data?.[2]?.result ?? 0n),
    redeemedCredits: Number(campaignStateQuery.data?.[3]?.result ?? 0n),
    redeemableCredits: Number(campaignStateQuery.data?.[4]?.result ?? 0n),
    isLoading: campaignStateQuery.isLoading,
    error: campaignStateQuery.error,
    refetchAll: async () => {
      await campaignStateQuery.refetch();
    },
  };
}
