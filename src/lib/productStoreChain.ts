import { createPublicClient, decodeEventLog, http, parseEther } from "viem";
import { writeContract } from "@wagmi/core";
import { ACTIVE_CHAIN, config as wagmiConfig } from "@/lib/wagmi";
import { PRODUCT_STORE_ABI, PRODUCT_STORE_ADDRESS } from "@/lib/contracts/productStore";
import { openWalletApprovalModal } from "@/lib/appKit";

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
});

export interface OnchainProductRecord {
  id: bigint;
  creator: `0x${string}`;
  metadataURI: string;
  price: bigint;
  stock: bigint;
  sold: bigint;
  royaltyPercent: bigint;
  active: boolean;
  createdAt: number;
}

export async function waitForProductStoreReceipt(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({ hash });
}

export async function getOnchainProduct(contractProductId: number): Promise<OnchainProductRecord> {
  const product = await publicClient.readContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "getProduct",
    args: [BigInt(contractProductId)],
  });

  return product as OnchainProductRecord;
}

export function parseProductCreatedId(receipt: Awaited<ReturnType<typeof waitForProductStoreReceipt>>) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PRODUCT_STORE_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "ProductCreated") {
        return Number(decoded.args.productId);
      }
    } catch {
      // ignore non-matching logs
    }
  }

  return null;
}

export function parsePurchaseCompletedId(receipt: Awaited<ReturnType<typeof waitForProductStoreReceipt>>) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PRODUCT_STORE_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "PurchaseCompleted") {
        return Number(decoded.args.orderId);
      }
    } catch {
      // ignore non-matching logs
    }
  }

  return null;
}

export async function createOnchainProduct(params: {
  metadataUri: string;
  priceEth: string;
  stock: number;
  royaltyPercent?: number;
  account: `0x${string}`;
}) {
  void openWalletApprovalModal().catch((error) => {
    console.warn("Unable to open wallet approval modal:", error);
  });

  const hash = await writeContract(wagmiConfig, {
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "createProduct",
    args: [
      params.metadataUri,
      parseEther(params.priceEth),
      BigInt(params.stock),
      BigInt(params.royaltyPercent ?? 0),
    ],
    account: params.account,
    chain: ACTIVE_CHAIN,
  });

  const receipt = await waitForProductStoreReceipt(hash);
  return {
    hash,
    receipt,
    contractProductId: parseProductCreatedId(receipt),
  };
}

export async function buyOnchainProduct(params: {
  contractProductId: number;
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
    address: PRODUCT_STORE_ADDRESS,
    abi: PRODUCT_STORE_ABI,
    functionName: "buyProduct",
    args: [BigInt(params.contractProductId), BigInt(params.quantity), params.orderMetadata],
    value: totalValue,
    account: params.account,
    chain: ACTIVE_CHAIN,
  });

  const receipt = await waitForProductStoreReceipt(hash);
  return {
    hash,
    receipt,
    contractOrderId: parsePurchaseCompletedId(receipt),
  };
}
