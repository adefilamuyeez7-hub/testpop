import { createPublicClient, decodeEventLog, http, parseEther } from "viem";
import { writeContract } from "@wagmi/core";
import { ACTIVE_CHAIN, config as wagmiConfig } from "@/lib/wagmi";
import {
  CREATIVE_RELEASE_ESCROW_ABI,
  CREATIVE_RELEASE_ESCROW_ADDRESS,
} from "@/lib/contracts/creativeReleaseEscrow";
import { openWalletApprovalModal } from "@/lib/appKit";

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
});

export interface OnchainCreativeReleaseRecord {
  id: bigint;
  artist: `0x${string}`;
  metadataURI: string;
  unitPrice: bigint;
  supply: bigint;
  sold: bigint;
  adminWallet: `0x${string}`;
  payoutBps: bigint;
  active: boolean;
  createdAt: number;
}

export async function waitForCreativeReleaseEscrowReceipt(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({ hash });
}

export async function getOnchainCreativeRelease(listingId: number): Promise<OnchainCreativeReleaseRecord> {
  const listing = await publicClient.readContract({
    address: CREATIVE_RELEASE_ESCROW_ADDRESS,
    abi: CREATIVE_RELEASE_ESCROW_ABI,
    functionName: "listings",
    args: [BigInt(listingId)],
  });

  return listing as OnchainCreativeReleaseRecord;
}

export function parseCreativeReleaseListingId(
  receipt: Awaited<ReturnType<typeof waitForCreativeReleaseEscrowReceipt>>,
) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: CREATIVE_RELEASE_ESCROW_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "ReleaseListingCreated") {
        return Number(decoded.args.listingId);
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}

export function parseCreativeReleaseOrderId(
  receipt: Awaited<ReturnType<typeof waitForCreativeReleaseEscrowReceipt>>,
) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: CREATIVE_RELEASE_ESCROW_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "ReleasePurchased") {
        return Number(decoded.args.orderId);
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}

export async function createOnchainCreativeRelease(params: {
  artist: `0x${string}`;
  metadataUri: string;
  priceEth: string;
  supply: number;
  adminWallet: `0x${string}`;
  payoutBps?: number;
  account: `0x${string}`;
}) {
  void openWalletApprovalModal().catch((error) => {
    console.warn("Unable to open wallet approval modal:", error);
  });

  const hash = await writeContract(wagmiConfig, {
    address: CREATIVE_RELEASE_ESCROW_ADDRESS,
    abi: CREATIVE_RELEASE_ESCROW_ABI,
    functionName: "createReleaseListing",
    args: [
      params.artist,
      params.metadataUri,
      parseEther(params.priceEth),
      BigInt(params.supply),
      params.adminWallet,
      BigInt(params.payoutBps ?? 500),
    ],
    account: params.account,
    chain: ACTIVE_CHAIN,
  });

  const receipt = await waitForCreativeReleaseEscrowReceipt(hash);
  return {
    hash,
    receipt,
    contractListingId: parseCreativeReleaseListingId(receipt),
  };
}

export async function buyOnchainCreativeRelease(params: {
  listingId: number;
  quantity: number;
  unitPriceWei: bigint;
  orderMetadata: string;
  account: `0x${string}`;
}) {
  const totalValue = params.unitPriceWei * BigInt(params.quantity);

  void openWalletApprovalModal().catch((error) => {
    console.warn("Unable to open wallet approval modal:", error);
  });

  const hash = await writeContract(wagmiConfig, {
    address: CREATIVE_RELEASE_ESCROW_ADDRESS,
    abi: CREATIVE_RELEASE_ESCROW_ABI,
    functionName: "buyRelease",
    args: [BigInt(params.listingId), BigInt(params.quantity), params.orderMetadata],
    value: totalValue,
    account: params.account,
    chain: ACTIVE_CHAIN,
  });

  const receipt = await waitForCreativeReleaseEscrowReceipt(hash);
  return {
    hash,
    receipt,
    contractOrderId: parseCreativeReleaseOrderId(receipt),
  };
}
