import { useMutation, useQuery } from "@tanstack/react-query";
import { getPublicClient } from "@wagmi/core";
import { parseEther } from "viem";
import { supabase } from "@/lib/db";
import { config } from "@/lib/wagmi";
import { useWallet } from "./useWallet";

export { useWallet } from "./useWallet";

const ARTIST_SUBSCRIPTION_READ_ABI = [
  {
    type: "function",
    name: "getSubscriberCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ARTIST_SUBSCRIPTION_WRITE_CANDIDATES = [
  [
    {
      type: "function",
      name: "subscribe",
      stateMutability: "payable",
      inputs: [],
      outputs: [],
    },
  ],
  [
    {
      type: "function",
      name: "subscribeMonthly",
      stateMutability: "payable",
      inputs: [],
      outputs: [],
    },
  ],
] as const;

const BID_WRITE_CANDIDATES = [
  {
    abi: [
      {
        type: "function",
        name: "placeBid",
        stateMutability: "payable",
        inputs: [{ name: "auctionId", type: "uint256" }],
        outputs: [],
      },
    ] as const,
    buildArgs: (listingId: number) => [BigInt(listingId)],
  },
  {
    abi: [
      {
        type: "function",
        name: "buyEntries",
        stateMutability: "payable",
        inputs: [
          { name: "campaignId", type: "uint256" },
          { name: "quantity", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const,
    buildArgs: (listingId: number) => [BigInt(listingId), 1n],
  },
] as const;

export function useCreateCampaign() {
  return {
    createCampaignAsync: async () => {
      throw new Error("Legacy campaign creation is disabled. Use the V2 campaign flow.");
    },
    isPending: false,
  };
}

export function useGetSubscriberCountFromArtistContract(contractAddress?: string | null) {
  const publicClient = getPublicClient(config);

  const query = useQuery({
    queryKey: ["artist-subscriber-count", contractAddress?.toLowerCase() || ""],
    queryFn: async () => {
      if (!contractAddress) return 0;
      const count = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ARTIST_SUBSCRIPTION_READ_ABI,
        functionName: "getSubscriberCount",
      });
      return Number(count || 0n);
    },
    enabled: Boolean(contractAddress),
    staleTime: 30_000,
  });

  return {
    count: query.data || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useSubscribeToArtistContract(contractAddress?: string | null) {
  const { signer: walletClient, address } = useWallet();
  const publicClient = getPublicClient(config);

  const mutation = useMutation({
    mutationFn: async (subscriptionPriceEth: string) => {
      if (!walletClient || !address) {
        throw new Error("Connect a wallet before subscribing.");
      }
      if (!contractAddress) {
        throw new Error("Artist contract not found.");
      }

      const value = parseEther(String(subscriptionPriceEth || "0"));
      let lastError = null;

      for (const abi of ARTIST_SUBSCRIPTION_WRITE_CANDIDATES) {
        try {
          const hash = await walletClient.writeContract({
            account: address,
            address: contractAddress as `0x${string}`,
            abi,
            functionName: abi[0].name,
            args: [],
            value,
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          return hash;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("No compatible subscription method was found.");
    },
  });

  return {
    subscribe: (subscriptionPriceEth: string) => mutation.mutateAsync(subscriptionPriceEth),
    isPending: mutation.isPending,
    isConfirming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}

export function useIsSubscribedToArtistContract(
  contractAddress?: string | null,
  subscriberWallet?: string | null,
) {
  const normalizedContract = contractAddress?.trim().toLowerCase() || "";
  const normalizedSubscriber = subscriberWallet?.trim().toLowerCase() || "";

  const query = useQuery({
    queryKey: ["artist-is-subscribed", normalizedContract, normalizedSubscriber],
    queryFn: async () => {
      if (!normalizedContract || !normalizedSubscriber) {
        return false;
      }

      const { data: artist } = await supabase
        .from("artists")
        .select("id")
        .eq("contract_address", normalizedContract)
        .maybeSingle();

      if (!artist?.id) {
        return false;
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("artist_id", artist.id)
        .eq("subscriber_wallet", normalizedSubscriber)
        .maybeSingle();

      return Boolean(subscription?.id);
    },
    enabled: Boolean(normalizedContract && normalizedSubscriber),
    staleTime: 30_000,
  });

  return {
    isSubscribed: Boolean(query.data),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePlaceBid() {
  const { signer: walletClient, address } = useWallet();
  const publicClient = getPublicClient(config);

  const mutation = useMutation({
    mutationFn: async ({
      listingId,
      bidAmountEth,
      contractAddress,
    }: {
      listingId: number;
      bidAmountEth: string;
      contractAddress?: string | null;
    }) => {
      if (!walletClient || !address) {
        throw new Error("Connect a wallet before bidding.");
      }
      if (!contractAddress) {
        throw new Error("Contract address is required to place a bid.");
      }

      const value = parseEther(String(bidAmountEth || "0"));
      let lastError = null;

      for (const candidate of BID_WRITE_CANDIDATES) {
        try {
          const hash = await walletClient.writeContract({
            account: address,
            address: contractAddress as `0x${string}`,
            abi: candidate.abi,
            functionName: candidate.abi[0].name,
            args: candidate.buildArgs(listingId),
            value,
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          return hash;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("No supported bid method was found for this contract.");
    },
  });

  return {
    placeBid: (listingId: number, bidAmountEth: string, contractAddress?: string | null) =>
      mutation.mutateAsync({ listingId, bidAmountEth, contractAddress }),
    isPending: mutation.isPending,
    isConfirming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
