import { useMutation } from "@tanstack/react-query";
import { getPublicClient } from "@wagmi/core";
import { decodeEventLog } from "viem";
import { parseEther } from "viem";
import { config } from "@/lib/wagmi";
import { useWallet } from "./useWallet";

const DROP_COUNTER_CANDIDATES = [
  {
    name: "nextDropId",
    abi: [
      {
        type: "function",
        name: "nextDropId",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    resolveCreatedId: (before: number) => before,
  },
  {
    name: "dropCounter",
    abi: [
      {
        type: "function",
        name: "dropCounter",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    resolveCreatedId: (_before: number, after: number) => after,
  },
  {
    name: "totalDrops",
    abi: [
      {
        type: "function",
        name: "totalDrops",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    resolveCreatedId: (_before: number, after: number) => after,
  },
] as const;

const CREATE_DROP_CANDIDATES = [
  [
    {
      type: "function",
      name: "createDrop",
      stateMutability: "nonpayable",
      inputs: [
        { name: "metadataURI", type: "string" },
        { name: "priceWei", type: "uint256" },
        { name: "maxSupply", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
      ],
      outputs: [],
    },
  ],
] as const;

const MINT_CANDIDATES = [
  [
    {
      type: "function",
      name: "mint",
      stateMutability: "payable",
      inputs: [{ name: "dropId", type: "uint256" }],
      outputs: [],
    },
  ],
  [
    {
      type: "function",
      name: "collect",
      stateMutability: "payable",
      inputs: [{ name: "dropId", type: "uint256" }],
      outputs: [],
    },
  ],
  [
    {
      type: "function",
      name: "buyDrop",
      stateMutability: "payable",
      inputs: [{ name: "dropId", type: "uint256" }],
      outputs: [],
    },
  ],
] as const;

const TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

async function readDropCounter(publicClient: ReturnType<typeof getPublicClient>, contractAddress: `0x${string}`) {
  for (const candidate of DROP_COUNTER_CANDIDATES) {
    try {
      const value = await publicClient.readContract({
        address: contractAddress,
        abi: candidate.abi,
        functionName: candidate.name,
      });
      return {
        value: Number(value || 0n),
        resolveCreatedId: candidate.resolveCreatedId,
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function useCreateDropArtist(artistContractAddress?: string | null) {
  const { signer: walletClient, address } = useWallet();
  const publicClient = getPublicClient(config);

  const mutation = useMutation({
    mutationFn: async ({
      metadataUri,
      priceEth,
      supply,
      startTime,
      endTime,
    }: {
      metadataUri: string;
      priceEth: string;
      supply: number;
      startTime: number;
      endTime: number;
    }) => {
      if (!walletClient || !address) {
        throw new Error("Connect a wallet before creating a drop.");
      }
      if (!artistContractAddress) {
        throw new Error("Artist contract not found.");
      }

      const contractAddress = artistContractAddress as `0x${string}`;
      const counterBefore = await readDropCounter(publicClient, contractAddress);
      const priceWei = parseEther(String(priceEth || "0"));
      let lastError = null;

      for (const abi of CREATE_DROP_CANDIDATES) {
        try {
          const hash = await walletClient.writeContract({
            account: address,
            address: contractAddress,
            abi,
            functionName: "createDrop",
            args: [metadataUri, priceWei, BigInt(supply), BigInt(startTime), BigInt(endTime)],
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          const counterAfter = await readDropCounter(publicClient, contractAddress);
          const createdDropId =
            counterBefore && counterAfter
              ? counterAfter.resolveCreatedId(counterBefore.value, counterAfter.value)
              : null;

          return { hash, createdDropId };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("No compatible createDrop function was found.");
    },
  });

  return {
    createDrop: (
      metadataUri: string,
      priceEth: string,
      supply: number,
      startTime: number,
      endTime: number,
    ) => mutation.mutateAsync({ metadataUri, priceEth, supply, startTime, endTime }),
    createDropAsync: (
      metadataUri: string,
      priceEth: string,
      supply: number,
      startTime: number,
      endTime: number,
    ) => mutation.mutateAsync({ metadataUri, priceEth, supply, startTime, endTime }),
    createdDropId: mutation.data?.createdDropId ?? null,
    isPending: mutation.isPending,
    isConfirming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}

export function useGetArtistContractInfo(contractAddress?: string | null) {
  return {
    contractAddress: contractAddress || null,
    isLoading: false,
  };
}

export function useMintArtist() {
  const { signer: walletClient, address } = useWallet();
  const publicClient = getPublicClient(config);

  const mutation = useMutation({
    mutationFn: async ({
      dropId,
      priceWei,
      contractAddress,
    }: {
      dropId: number;
      priceWei: bigint;
      contractAddress: string;
    }) => {
      if (!walletClient || !address) {
        throw new Error("Connect a wallet before collecting.");
      }

      const normalizedAddress = contractAddress as `0x${string}`;
      let lastError = null;

      for (const abi of MINT_CANDIDATES) {
        try {
          const hash = await walletClient.writeContract({
            account: address,
            address: normalizedAddress,
            abi,
            functionName: abi[0].name,
            args: [BigInt(dropId)],
            value: priceWei,
            chain: walletClient.chain,
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          let mintedTokenId = null;

          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: TRANSFER_EVENT_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "Transfer") {
                mintedTokenId = Number(decoded.args.tokenId);
                break;
              }
            } catch {
              // ignore unrelated logs
            }
          }

          return { hash, mintedTokenId };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("No supported mint function was found for this contract.");
    },
  });

  return {
    mint: (dropId: number, priceWei: bigint, contractAddress: string) =>
      mutation.mutateAsync({ dropId, priceWei, contractAddress }),
    mintAsync: (dropId: number, priceWei: bigint, contractAddress: string) =>
      mutation.mutateAsync({ dropId, priceWei, contractAddress }),
    mintedTokenId: mutation.data?.mintedTokenId ?? null,
    isPending: mutation.isPending,
    isConfirming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
