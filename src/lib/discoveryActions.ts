import type { Drop, Product } from "@/lib/db";
import { getProductsByCreativeRelease } from "@/lib/db";
import { resolveDropBehavior } from "@/lib/dropBehavior";
import { resolveContractProductId } from "@/lib/productMetadata";
import { fetchDropByIdFromSupabase, fetchProductByIdFromSupabase } from "@/lib/supabaseStore";
import type { CollectedDropItem } from "@/stores/collectionStore";
import { getCatalogPrimaryAction } from "@/utils/catalogUtils";

export type DiscoverActionItemType = "drop" | "product" | "release";

export type ActionableDiscoverDrop = Drop & {
  artists?: { name?: string | null } | null;
};

type DiscoverActionInput = {
  id: string;
  item_type: DiscoverActionItemType;
  can_bid?: boolean;
  can_purchase?: boolean;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | string | null;
  price_eth?: number | null;
};

export type ResolvedDiscoverAction =
  | {
      kind: "cart";
      analyticsAction: "cart" | "collect";
      product: Product;
    }
  | {
      kind: "collect";
      drop: ActionableDiscoverDrop;
      contractAddress: string;
      contractDropId: number;
      priceEth: string;
    }
  | {
      kind: "details";
      reason: "bid" | "campaign" | "unsupported" | "details";
    };

function getDropSourceKind(drop: ActionableDiscoverDrop) {
  if (typeof drop.source_kind === "string" && drop.source_kind) {
    return drop.source_kind;
  }

  const metadata =
    drop.metadata && typeof drop.metadata === "object" && !Array.isArray(drop.metadata)
      ? (drop.metadata as Record<string, unknown>)
      : null;

  return typeof metadata?.source_kind === "string" ? metadata.source_kind : null;
}

export async function resolveDiscoverDrop(dropId: string): Promise<ActionableDiscoverDrop> {
  const drop = await fetchDropByIdFromSupabase(dropId);
  if (!drop) {
    throw new Error("This drop is unavailable right now.");
  }

  return drop as ActionableDiscoverDrop;
}

export async function resolveDiscoverCheckoutProduct(
  itemId: string,
  itemType: Exclude<DiscoverActionItemType, "drop">,
): Promise<Product> {
  if (itemType === "product") {
    const product = await fetchProductByIdFromSupabase(itemId);
    if (!product) {
      throw new Error("This product is unavailable right now.");
    }

    return product;
  }

  const products = await getProductsByCreativeRelease(itemId);
  const product =
    products.find((candidate) => Boolean(candidate?.id)) ||
    null;

  if (!product) {
    throw new Error("This release is live in discovery, but its checkout product is still syncing.");
  }

  return product;
}

export async function resolveDiscoverPrimaryAction(
  item: DiscoverActionInput,
): Promise<ResolvedDiscoverAction> {
  const primaryAction = getCatalogPrimaryAction(item);

  if (primaryAction === "details") {
    return { kind: "details", reason: "details" };
  }

  if (primaryAction === "bid") {
    return { kind: "details", reason: "bid" };
  }

  if (item.item_type === "product") {
    return {
      kind: "cart",
      analyticsAction: "cart",
      product: await resolveDiscoverCheckoutProduct(item.id, "product"),
    };
  }

  if (item.item_type === "release") {
    return {
      kind: "cart",
      analyticsAction: "cart",
      product: await resolveDiscoverCheckoutProduct(item.id, "release"),
    };
  }

  const drop = await resolveDiscoverDrop(item.id);
  const behavior = resolveDropBehavior({
    drop: {
      type: drop.type || "drop",
      contractKind:
        (drop.contract_kind as
          | "artDrop"
          | "poapCampaign"
          | "poapCampaignV2"
          | "creativeReleaseEscrow"
          | "productStore"
          | null) || null,
      contractDropId:
        drop.contract_drop_id !== null && drop.contract_drop_id !== undefined
          ? Number(drop.contract_drop_id)
          : null,
      metadata:
        drop.metadata && typeof drop.metadata === "object" && !Array.isArray(drop.metadata)
          ? (drop.metadata as Record<string, unknown>)
          : null,
    },
    linkedProduct:
      drop.linked_product && typeof drop.linked_product === "object" && !Array.isArray(drop.linked_product)
        ? (drop.linked_product as Product)
        : null,
    linkedRelease:
      drop.creative_release && typeof drop.creative_release === "object" && !Array.isArray(drop.creative_release)
        ? {
            contract_kind: drop.creative_release.contract_kind ?? null,
            contract_listing_id: drop.creative_release.contract_listing_id ?? null,
            contract_drop_id: drop.creative_release.contract_drop_id ?? null,
            metadata:
              drop.creative_release.metadata && typeof drop.creative_release.metadata === "object"
                ? drop.creative_release.metadata
                : null,
          }
        : null,
    sourceKind: getDropSourceKind(drop),
  });

  if (behavior.mode === "checkout") {
    const linkedProductId =
      drop.linked_product && typeof drop.linked_product === "object" && !Array.isArray(drop.linked_product)
        ? ((drop.linked_product as Product).id ?? null)
        : null;
    const linkedReleaseId =
      drop.creative_release && typeof drop.creative_release === "object" && !Array.isArray(drop.creative_release)
        ? (drop.creative_release.id ?? null)
        : null;

    const product = await resolveDiscoverCheckoutProduct(
      linkedProductId || linkedReleaseId || drop.id,
      linkedProductId ? "product" : linkedReleaseId ? "release" : "product",
    );

    return {
      kind: "cart",
      analyticsAction: "collect",
      product,
    };
  }

  if (behavior.mode === "collect") {
    const contractDropId =
      drop.contract_drop_id !== null && drop.contract_drop_id !== undefined
        ? Number(drop.contract_drop_id)
        : null;

    if (!drop.contract_address || contractDropId === null) {
      throw new Error("This drop is visible, but its collect contract is not ready yet.");
    }

    return {
      kind: "collect",
      drop,
      contractAddress: drop.contract_address,
      contractDropId,
      priceEth: String(drop.price_eth || item.price_eth || 0),
    };
  }

  return {
    kind: "details",
    reason: behavior.mode === "campaign" ? "campaign" : "unsupported",
  };
}

export function buildCollectionRecord(
  drop: ActionableDiscoverDrop,
  ownerWallet: string,
  mintedTokenId: number | null,
): CollectedDropItem {
  const artistName =
    drop.artists && typeof drop.artists === "object" && !Array.isArray(drop.artists)
      ? drop.artists.name || "Unknown Artist"
      : "Unknown Artist";

  const isOnchainCollect = Boolean(drop.contract_address);
  return {
    id: drop.id,
    ownerWallet,
    creativeReleaseId: drop.creative_release_id ?? null,
    productId:
      drop.linked_product && typeof drop.linked_product === "object" && !Array.isArray(drop.linked_product)
        ? (drop.linked_product as Product).id || null
        : null,
    title: drop.title || "Untitled Drop",
    artist: artistName,
    imageUrl: drop.image_url || drop.image_ipfs_uri || undefined,
    previewUri: drop.preview_uri || undefined,
    deliveryUri: drop.delivery_uri || undefined,
    assetType: drop.asset_type || "image",
    isGated: isOnchainCollect || Boolean(drop.is_gated),
    mintedTokenId,
    contractAddress: drop.contract_address || null,
    contractKind: (drop.contract_kind as "artDrop" | "productStore" | "creativeReleaseEscrow" | null) || null,
    contractDropId:
      drop.contract_drop_id !== null && drop.contract_drop_id !== undefined ? Number(drop.contract_drop_id) : null,
    collectedAt: new Date().toISOString(),
  };
}

export function addProductToCart(
  addItem: (
    productId: string,
    creativeReleaseId: string | null,
    contractKind: "artDrop" | "productStore" | "creativeReleaseEscrow" | null,
    contractListingId: number | null,
    contractProductId: number | null,
    quantity: number,
    price: bigint,
    name: string,
    image: string,
  ) => void,
  product: Product,
  fallbackTitle: string,
  fallbackImage?: string,
) {
  const resolvedPriceEth = Number(product.price_eth || 0);
  const priceWei = BigInt(Math.max(0, Math.round(resolvedPriceEth * 1e18)));
  const resolvedContractProductId = resolveContractProductId(
    product.metadata && typeof product.metadata === "object" ? product.metadata : null,
    product.contract_product_id
  );
  const resolvedContractKind = (() => {
    if (product.contract_kind === "creativeReleaseEscrow" || product.contract_kind === "productStore") {
      return product.contract_kind;
    }

    const metadataContractKind =
      product.metadata &&
      typeof product.metadata === "object" &&
      !Array.isArray(product.metadata) &&
      typeof product.metadata.contract_kind === "string"
        ? product.metadata.contract_kind
        : "";

    return metadataContractKind === "creativeReleaseEscrow" ? "creativeReleaseEscrow" : "productStore";
  })();

  addItem(
    product.id,
    product.creative_release_id ?? null,
    resolvedContractKind,
    Number.isFinite(Number(product.contract_listing_id)) ? Number(product.contract_listing_id) : null,
    resolvedContractProductId,
    1,
    priceWei,
    product.name || fallbackTitle || "Untitled Product",
    product.preview_uri || product.image_url || product.image_ipfs_uri || fallbackImage || "",
  );
}
