import type { Drop, Product } from "@/lib/db";
import { getProductsByCreativeRelease } from "@/lib/db";
import { fetchDropByIdFromSupabase, fetchProductByIdFromSupabase } from "@/lib/supabaseStore";
import type { CollectedDropItem } from "@/stores/collectionStore";

export type DiscoverActionItemType = "drop" | "product" | "release";

export type ActionableDiscoverDrop = Drop & {
  artists?: { name?: string | null } | null;
};

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

export function buildCollectionRecord(
  drop: ActionableDiscoverDrop,
  ownerWallet: string,
  mintedTokenId: number | null,
): CollectedDropItem {
  const artistName =
    drop.artists && typeof drop.artists === "object" && !Array.isArray(drop.artists)
      ? drop.artists.name || "Unknown Artist"
      : "Unknown Artist";

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
    isGated: Boolean(drop.is_gated),
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

  addItem(
    product.id,
    product.creative_release_id ?? null,
    product.contract_kind ?? "productStore",
    Number.isFinite(Number(product.contract_listing_id)) ? Number(product.contract_listing_id) : null,
    Number.isFinite(Number(product.contract_product_id)) ? Number(product.contract_product_id) : null,
    1,
    priceWei,
    product.name || fallbackTitle || "Untitled Product",
    product.preview_uri || product.image_url || product.image_ipfs_uri || fallbackImage || "",
  );
}
