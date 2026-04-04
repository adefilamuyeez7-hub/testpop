/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supabase Store - Complete integration for artists, products, drops, and orders
 * Replaces localStorage with real Supabase database queries
 */

import { supabase } from "./db";
import { toast } from "sonner";
import {
  LIVE_DROP_STATUSES,
  PUBLIC_PRODUCT_STATUSES,
  normalizePublicDropStatus,
} from "@/lib/catalogVisibility";
import { ipfsToHttp } from "@/lib/pinata";
import { resolvePortfolioImage } from "@/lib/portfolio";

let dropsColumnsMode: "full" | "legacy" | null = null;
let dropsArtistRelationMode: "embedded" | "detached" | null = null;
let artistsStatusMode: "native" | "legacy" | null = null;
let productColumnsMode: "full" | "legacy" | null = null;
const metadataJsonCache = new Map<string, Promise<Record<string, any> | null>>();
const releasePreviewCache = new Map<
  string,
  Promise<{
    creativeRelease: Record<string, any> | null;
    product: Record<string, any> | null;
    image: string;
  } | null>
>();

const FULL_PUBLIC_PRODUCT_SELECT = [
  "id",
  "artist_id",
  "creative_release_id",
  "creator_wallet",
  "name",
  "description",
  "category",
  "product_type",
  "asset_type",
  "price_eth",
  "stock",
  "sold",
  "image_url",
  "image_ipfs_uri",
  "preview_uri",
  "is_gated",
  "nft_link",
  "status",
  "metadata",
  "contract_kind",
  "contract_listing_id",
  "contract_product_id",
  "metadata_uri",
  "created_at",
  "updated_at",
].join(", ");

const LEGACY_PUBLIC_PRODUCT_SELECT = [
  "id",
  "creator_wallet",
  "name",
  "description",
  "category",
  "price_eth",
  "stock",
  "sold",
  "image_url",
  "image_ipfs_uri",
  "status",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

function getPublicProductSelectClause() {
  return productColumnsMode === "legacy" ? LEGACY_PUBLIC_PRODUCT_SELECT : FULL_PUBLIC_PRODUCT_SELECT;
}

function updateProductSchemaMode(error: { message?: string } | null | undefined) {
  const legacyOnlyColumns = [
    "artist_id",
    "creative_release_id",
    "product_type",
    "asset_type",
    "preview_uri",
    "is_gated",
    "nft_link",
    "contract_kind",
    "contract_listing_id",
    "contract_product_id",
    "metadata_uri",
  ];

  if (legacyOnlyColumns.some((column) => isMissingColumnError(error, "products", column))) {
    productColumnsMode = "legacy";
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, table: string, column: string) {
  const message = error?.message || "";
  return message.includes(`column ${table}.${column} does not exist`);
}

function isMissingRelationError(
  error: { message?: string } | null | undefined,
  sourceTable: string,
  targetTable: string
) {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("relationship") &&
    message.includes(sourceTable.toLowerCase()) &&
    message.includes(targetTable.toLowerCase())
  );
}

function normalizeDropStatus(status?: string | null) {
  return normalizePublicDropStatus(status);
}

function normalizeDropType(type?: string | null) {
  const normalizedType = type?.toLowerCase?.() || "";
  if (normalizedType === "auction" || normalizedType === "campaign") {
    return normalizedType;
  }

  return "drop";
}

function withDropDefaults<T extends Record<string, any> | null>(drop: T): T {
  if (!drop) return drop;

  return {
    preview_uri: null,
    delivery_uri: null,
    asset_type: "image",
    is_gated: false,
    contract_kind: null,
    ...drop,
    status: normalizeDropStatus(drop.status),
    type: normalizeDropType(drop.type),
  };
}

function isCampaignUpcomingDraft(drop: Record<string, any>) {
  const normalizedType = normalizeDropType(drop?.type);
  const normalizedStatus = normalizeDropStatus(drop?.status);
  return normalizedType === "campaign" && (normalizedStatus === "draft" || normalizedStatus === "upcoming");
}

function filterNonExpiredLiveDrops<T extends Record<string, any>>(drops: T[]) {
  const now = Date.now();
  return (drops || []).filter((drop) => {
    const normalizedStatus = normalizeDropStatus(drop?.status);
    const isVisibleCampaign = isCampaignUpcomingDraft(drop);

    if (normalizedStatus !== "live" && !isVisibleCampaign) {
      return false;
    }
    if (!drop?.ends_at) return true;
    const endsAt = new Date(drop.ends_at).getTime();
    if (!Number.isFinite(endsAt)) return true;
    return endsAt > now;
  });
}

function getMetadataField(metadata: Record<string, any> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function extractImageUriFromMetadata(metadata: Record<string, any> | null | undefined) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const properties =
    metadata.properties && typeof metadata.properties === "object" && !Array.isArray(metadata.properties)
      ? (metadata.properties as Record<string, any>)
      : null;

  return (
    getMetadataField(metadata, "coverImageUri") ||
    getMetadataField(metadata, "cover_image_uri") ||
    getMetadataField(metadata, "cover") ||
    getMetadataField(metadata, "imageUrl") ||
    getMetadataField(metadata, "image_url") ||
    getMetadataField(metadata, "imageUri") ||
    getMetadataField(metadata, "image_uri") ||
    getMetadataField(metadata, "previewUri") ||
    getMetadataField(metadata, "preview_uri") ||
    getMetadataField(metadata, "image") ||
    getMetadataField(properties, "coverImageUri") ||
    getMetadataField(properties, "cover_image_uri") ||
    getMetadataField(properties, "cover") ||
    getMetadataField(properties, "imageUrl") ||
    getMetadataField(properties, "image_url") ||
    getMetadataField(properties, "imageUri") ||
    getMetadataField(properties, "image_uri") ||
    getMetadataField(properties, "previewUri") ||
    getMetadataField(properties, "preview_uri") ||
    getMetadataField(properties, "image")
  );
}

async function fetchMetadataJson(uri?: string | null) {
  const normalizedUri = uri?.trim();
  if (!normalizedUri) {
    return null;
  }

  if (!metadataJsonCache.has(normalizedUri)) {
    metadataJsonCache.set(
      normalizedUri,
      fetch(ipfsToHttp(normalizedUri))
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Metadata request failed: ${response.status}`);
          }
          return (await response.json()) as Record<string, any>;
        })
        .catch((error) => {
          console.warn("Failed to fetch metadata JSON:", normalizedUri, error);
          return null;
        })
    );
  }

  return metadataJsonCache.get(normalizedUri) ?? null;
}

async function fetchReleasePreviewById(releaseId?: string | null) {
  const normalizedReleaseId = releaseId?.trim();
  if (!normalizedReleaseId) {
    return null;
  }

  if (!releasePreviewCache.has(normalizedReleaseId)) {
    releasePreviewCache.set(
      normalizedReleaseId,
      Promise.all([
        supabase
          .from("creative_releases")
          .select("id, title, release_type, cover_image_uri, contract_address, contract_kind, status, metadata")
          .eq("id", normalizedReleaseId)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, creative_release_id, name, image_url, image_ipfs_uri, product_type, contract_kind, status")
          .eq("creative_release_id", normalizedReleaseId)
          .in("status", [...PUBLIC_PRODUCT_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1),
      ])
        .then(([releaseResult, productResult]) => {
          if (releaseResult.error) {
            throw releaseResult.error;
          }
          if (productResult.error) {
            throw productResult.error;
          }

          const creativeRelease = releaseResult.data || null;
          const product = productResult.data?.[0] || null;
          const image =
            (typeof creativeRelease?.cover_image_uri === "string" && creativeRelease.cover_image_uri
              ? ipfsToHttp(creativeRelease.cover_image_uri)
              : "") ||
            (typeof product?.image_url === "string" && product.image_url ? product.image_url : "") ||
            (typeof product?.image_ipfs_uri === "string" && product.image_ipfs_uri
              ? ipfsToHttp(product.image_ipfs_uri)
              : "");

          if (!creativeRelease && !product) {
            return null;
          }

          return {
            creativeRelease,
            product,
            image,
          };
        })
        .catch((error) => {
          console.warn("Failed to fetch linked creative release preview:", normalizedReleaseId, error);
          return null;
        }),
    );
  }

  return releasePreviewCache.get(normalizedReleaseId) ?? null;
}

async function enrichDropMediaFromMetadata<T extends Record<string, any>>(drop: T) {
  const withDefaults = withDropDefaults(drop);
  const releasePreview = await fetchReleasePreviewById(withDefaults.creative_release_id);

  const attachReleaseData = <U extends Record<string, any>>(value: U): U =>
    releasePreview
      ? ({
          ...value,
          creative_release: value.creative_release || releasePreview.creativeRelease,
          linked_product: value.linked_product || releasePreview.product,
        } as U)
      : value;

  const applyReleaseImageFallback = <U extends Record<string, any>>(value: U): U =>
    releasePreview?.image
      ? ({
          ...value,
          image_url: value.image_url || releasePreview.image,
          image_ipfs_uri:
            value.image_ipfs_uri ||
            releasePreview.product?.image_ipfs_uri ||
            releasePreview.creativeRelease?.cover_image_uri ||
            null,
          preview_uri: value.preview_uri || releasePreview.image,
        } as U)
      : value;

  const existingImage =
    withDefaults.preview_uri ||
    withDefaults.image_url ||
    withDefaults.image_ipfs_uri ||
    extractImageUriFromMetadata((withDefaults.metadata as Record<string, any> | undefined) || null) ||
    releasePreview?.image;

  const baseDrop = applyReleaseImageFallback(attachReleaseData(withDefaults));

  if (existingImage || !withDefaults.metadata_ipfs_uri) {
    return baseDrop;
  }

  const metadata = await fetchMetadataJson(withDefaults.metadata_ipfs_uri);
  if (!metadata) {
    return baseDrop;
  }

  const metadataImage = extractImageUriFromMetadata(metadata);
  if (!metadataImage) {
    return applyReleaseImageFallback({
      ...baseDrop,
      metadata: baseDrop.metadata || metadata,
    });
  }

  return applyReleaseImageFallback({
    ...baseDrop,
    metadata: baseDrop.metadata || metadata,
    image_ipfs_uri: baseDrop.image_ipfs_uri || metadataImage,
    image_url: baseDrop.image_url || ipfsToHttp(metadataImage),
    preview_uri: baseDrop.preview_uri || metadataImage,
  });
}

async function enrichDropsMediaFromMetadata<T extends Record<string, any>>(drops: T[]) {
  return Promise.all((drops || []).map((drop) => enrichDropMediaFromMetadata(drop)));
}

async function enrichArtistPortfolioEntries<T extends Record<string, any>>(artist: T) {
  const portfolio = Array.isArray(artist.portfolio) ? artist.portfolio : [];
  if (portfolio.length === 0) {
    return artist;
  }

  const nextPortfolio = await Promise.all(
    portfolio.map(async (piece) => {
      if (!piece || typeof piece !== "object" || Array.isArray(piece)) {
        return piece;
      }

      const resolvedImage = resolvePortfolioImage(piece as Record<string, unknown>);
      if (resolvedImage) {
        return piece;
      }

      const metadataUri =
        (typeof (piece as Record<string, any>).metadataUri === "string" && (piece as Record<string, any>).metadataUri) ||
        (typeof (piece as Record<string, any>).metadata_uri === "string" && (piece as Record<string, any>).metadata_uri) ||
        "";

      if (!metadataUri) {
        return piece;
      }

      const metadata = await fetchMetadataJson(metadataUri);
      const metadataImage = extractImageUriFromMetadata(metadata);
      if (!metadataImage) {
        return piece;
      }

      return {
        ...piece,
        image: (piece as Record<string, any>).image || ipfsToHttp(metadataImage),
        imageUri:
          (piece as Record<string, any>).imageUri ||
          (piece as Record<string, any>).image_uri ||
          metadataImage,
      };
    })
  );

  return {
    ...artist,
    portfolio: nextPortfolio,
  };
}

async function enrichArtistsPortfolioEntries<T extends Record<string, any>>(artists: T[]) {
  return Promise.all((artists || []).map((artist) => enrichArtistPortfolioEntries(artist)));
}

async function fetchArtistsByIdsFromSupabase(artistIds: Array<string | null | undefined>) {
  const uniqueArtistIds = Array.from(
    new Set(artistIds.filter((artistId): artistId is string => Boolean(artistId)))
  );

  if (uniqueArtistIds.length === 0) {
    return new Map<string, Record<string, any>>();
  }

  const { data, error } = await supabase
    .from("artists")
    .select("id, name, handle, avatar_url")
    .in("id", uniqueArtistIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((artist) => [artist.id, artist]));
}

async function attachArtistsToDrops<T extends Record<string, any>>(drops: T[]) {
  try {
    const artistMap = await fetchArtistsByIdsFromSupabase((drops || []).map((drop) => drop.artist_id));
    return (drops || []).map((drop) => ({
      ...withDropDefaults(drop),
      artists: artistMap.get(drop.artist_id) || null,
    }));
  } catch (error: any) {
    console.warn("Failed to attach artist records to drops:", error?.message || error);
    return (drops || []).map((drop) => ({
      ...withDropDefaults(drop),
      artists: null,
    }));
  }
}

async function fetchApprovedArtistWalletsFromSupabase() {
  const { data, error } = await supabase
    .from("whitelist")
    .select("wallet")
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  return Array.from(
    new Set(
      (data || [])
        .map((entry) => entry.wallet?.toLowerCase?.())
        .filter((wallet): wallet is string => Boolean(wallet))
    )
  );
}

function shouldUseNativeArtistStatusFilter() {
  return artistsStatusMode !== "legacy";
}

function updateArtistSchemaMode(error: { message?: string } | null | undefined) {
  if (isMissingColumnError(error, "artists", "status")) {
    artistsStatusMode = "legacy";
  }
}

async function fetchPublicArtistsFromSupabase(artistId?: string) {
  const approvedWallets = await fetchApprovedArtistWalletsFromSupabase();
  const approvedWalletSet = new Set(approvedWallets);

  let statusData: Record<string, any>[] | null = null;
  let statusError: { message?: string } | null = null;

  if (shouldUseNativeArtistStatusFilter()) {
    let statusQuery = supabase
      .from("artists")
      .select("*")
      .in("status", ["approved", "active"])
      .order("created_at", { ascending: false });

    if (artistId) {
      statusQuery = statusQuery.eq("id", artistId);
    }

    const result = await statusQuery;
    statusData = result.data;
    statusError = result.error;
    updateArtistSchemaMode(statusError);

    if (!statusError) {
      artistsStatusMode = "native";
    }
  }

  let whitelistData: Record<string, any>[] = [];
  if (approvedWallets.length > 0) {
    let whitelistQuery = supabase
      .from("artists")
      .select("*")
      .in("wallet", approvedWallets)
      .order("created_at", { ascending: false });

    if (artistId) {
      whitelistQuery = whitelistQuery.eq("id", artistId);
    }

    const { data, error } = await whitelistQuery;
    if (error) {
      if (statusError) {
        throw statusError;
      }
      throw error;
    }

    whitelistData = data || [];
  }

  if (statusError && artistsStatusMode !== "legacy") {
    throw statusError;
  }

  const merged = [...(statusData || []), ...whitelistData]
    .filter((artist) => {
      const normalizedWallet = artist.wallet?.toLowerCase?.();
      return (
        artist?.status === "approved" ||
        artist?.status === "active" ||
        (normalizedWallet ? approvedWalletSet.has(normalizedWallet) : false)
      );
    })
    .reduce<Record<string, any>[]>((acc, artist) => {
      const key = artist.id || artist.wallet;
      if (!key) return acc;
      if (acc.some((existing) => (existing.id || existing.wallet) === key)) {
        return acc;
      }
      acc.push(artist);
      return acc;
    }, []);

  const enriched = await enrichArtistsPortfolioEntries(merged);
  return artistId ? (enriched[0] ?? null) : enriched;
}

function isReleaseBackedProduct(product: Record<string, any> | null | undefined) {
  return Boolean(product?.creative_release_id);
}

function isStandaloneMarketplaceProduct(product: Record<string, any> | null | undefined) {
  return !isReleaseBackedProduct(product);
}

function sortDropsByNewest<T extends Record<string, any>>(drops: T[]) {
  return [...(drops || [])].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

async function fetchCreativeReleasesByIdsFromSupabase(releaseIds: Array<string | null | undefined>) {
  const uniqueReleaseIds = Array.from(
    new Set(releaseIds.filter((releaseId): releaseId is string => Boolean(releaseId)))
  );

  if (uniqueReleaseIds.length === 0) {
    return new Map<string, Record<string, any>>();
  }

  const { data, error } = await supabase
    .from("creative_releases")
    .select(
      [
        "id",
        "artist_id",
        "title",
        "description",
        "release_type",
        "status",
        "price_eth",
        "supply",
        "sold",
        "art_metadata_uri",
        "cover_image_uri",
        "contract_kind",
        "contract_address",
        "contract_listing_id",
        "contract_drop_id",
        "metadata",
        "published_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .in("id", uniqueReleaseIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((release) => [release.id, release]));
}

async function fetchReleaseLinkedProductsForDropSurface(options: { artistId?: string; productId?: string } = {}) {
  if (productColumnsMode === "legacy") {
    return [];
  }

  let query = supabase
    .from("products")
    .select(getPublicProductSelectClause())
    .in("status", [...PUBLIC_PRODUCT_STATUSES])
    .not("creative_release_id", "is", null)
    .order("created_at", { ascending: false });

  if (options.artistId) {
    query = query.eq("artist_id", options.artistId);
  }

  if (options.productId) {
    query = query.eq("id", options.productId);
  }

  const { data, error } = await query;
  updateProductSchemaMode(error);

  if (error && productColumnsMode === "legacy") {
    return [];
  }

  if (error) {
    throw error;
  }

  const uniqueProducts = new Map<string, Record<string, any>>();
  for (const product of data || []) {
    const releaseId = product.creative_release_id || product.id;
    if (!uniqueProducts.has(releaseId)) {
      uniqueProducts.set(releaseId, product);
    }
  }

  return Array.from(uniqueProducts.values());
}

function buildReleaseBackedSyntheticDrop(
  product: Record<string, any>,
  release: Record<string, any> | null | undefined
) {
  const productMetadata =
    product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata)
      ? product.metadata
      : {};
  const releaseMetadata =
    release?.metadata && typeof release.metadata === "object" && !Array.isArray(release.metadata)
      ? release.metadata
      : {};

  return withDropDefaults({
    id: product.id,
    artist_id: product.artist_id || release?.artist_id || null,
    creative_release_id: product.creative_release_id || release?.id || null,
    title: release?.title || product.name || "Untitled Release",
    description: release?.description || product.description || "",
    price_eth: product.price_eth ?? release?.price_eth ?? 0,
    supply: product.stock ?? release?.supply ?? 1,
    sold: product.sold ?? release?.sold ?? 0,
    image_url:
      product.image_url ||
      (typeof release?.cover_image_uri === "string" && release.cover_image_uri
        ? ipfsToHttp(release.cover_image_uri)
        : null),
    image_ipfs_uri: product.image_ipfs_uri || release?.cover_image_uri || null,
    metadata_ipfs_uri: product.metadata_uri || release?.art_metadata_uri || null,
    preview_uri: product.preview_uri || release?.cover_image_uri || null,
    delivery_uri:
      product.delivery_uri ||
      (typeof releaseMetadata.delivery_uri === "string" ? releaseMetadata.delivery_uri : null),
    asset_type: product.asset_type || "image",
    is_gated: Boolean(product.is_gated),
    status: release?.status || product.status || "published",
    type: "drop",
    contract_address: release?.contract_address || null,
    contract_drop_id:
      release?.contract_drop_id !== null && release?.contract_drop_id !== undefined
        ? Number(release.contract_drop_id)
        : null,
    contract_kind: release?.contract_kind || product.contract_kind || "creativeReleaseEscrow",
    created_at: release?.published_at || product.created_at || release?.created_at || null,
    updated_at: product.updated_at || release?.updated_at || null,
    metadata: {
      ...releaseMetadata,
      ...productMetadata,
      source_kind: "release_product",
      source_product_id: product.id,
    },
    source_kind: "release_product",
    source_product_id: product.id,
    linked_product: product,
    creative_release: release || null,
  });
}

async function appendReleaseBackedDrops<T extends Record<string, any>>(
  drops: T[],
  options: { artistId?: string } = {}
) {
  const baseDrops = [...(drops || [])];

  let releaseProducts: Record<string, any>[] = [];
  try {
    releaseProducts = await fetchReleaseLinkedProductsForDropSurface({ artistId: options.artistId });
  } catch (error: any) {
    console.warn("Failed to fetch release-linked products for drop surface:", error?.message || error);
    return sortDropsByNewest(baseDrops);
  }

  if (releaseProducts.length === 0) {
    return sortDropsByNewest(baseDrops);
  }

  const existingReleaseIds = new Set(
    baseDrops
      .map((drop) => drop.creative_release_id)
      .filter((releaseId): releaseId is string => Boolean(releaseId))
  );

  const missingReleaseProducts = releaseProducts.filter((product) => {
    const releaseId = product.creative_release_id;
    return releaseId ? !existingReleaseIds.has(releaseId) : false;
  });

  if (missingReleaseProducts.length === 0) {
    return sortDropsByNewest(baseDrops);
  }

  let releaseMap = new Map<string, Record<string, any>>();
  try {
    releaseMap = await fetchCreativeReleasesByIdsFromSupabase(
      missingReleaseProducts.map((product) => product.creative_release_id)
    );
  } catch (error: any) {
    console.warn("Failed to fetch creative releases for synthetic drops:", error?.message || error);
  }

  let syntheticDrops = missingReleaseProducts.map((product) =>
    buildReleaseBackedSyntheticDrop(product, releaseMap.get(product.creative_release_id) || null)
  );

  syntheticDrops = await attachArtistsToDrops(syntheticDrops);
  syntheticDrops = await enrichDropsMediaFromMetadata(syntheticDrops);

  return sortDropsByNewest([...baseDrops, ...syntheticDrops]) as T[];
}

async function fetchSyntheticDropByProductId(productId: string) {
  if (!productId) {
    return null;
  }

  let product: Record<string, any> | null = null;
  try {
    product = await fetchProductByIdFromSupabase(productId);
  } catch (error: any) {
    console.warn("Failed to fetch product-backed drop:", error?.message || error);
    return null;
  }

  if (!isReleaseBackedProduct(product)) {
    return null;
  }

  let release: Record<string, any> | null = null;
  try {
    const releaseMap = await fetchCreativeReleasesByIdsFromSupabase([product?.creative_release_id]);
    release = releaseMap.get(product?.creative_release_id) || null;
  } catch (error: any) {
    console.warn("Failed to fetch creative release for product-backed drop:", error?.message || error);
  }

  let [syntheticDrop] = await attachArtistsToDrops([
    buildReleaseBackedSyntheticDrop(product, release),
  ]);
  syntheticDrop = await enrichDropMediaFromMetadata(syntheticDrop);
  return syntheticDrop;
}

export async function searchPublicCatalogFromSupabase(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { artists: [], drops: [], products: [] };
  }

  const [artists, drops, products] = await Promise.all([
    fetchPublicArtistsFromSupabase(),
    fetchLiveDropsFromSupabase(),
    fetchPublishedProductsFromSupabase(),
  ]);

  return {
    artists: (artists || [])
      .filter((artist) =>
        [artist.name, artist.handle, artist.tag]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 4),
    drops: (drops || [])
      .filter((drop) =>
        [
          drop.title,
          drop.type,
          drop.asset_type,
          drop.artists && !Array.isArray(drop.artists) ? drop.artists.name : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 4),
    products: (products || [])
      .filter((product) => isStandaloneMarketplaceProduct(product))
      .filter((product) =>
        [product.name, product.description, product.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 4),
  };
}

function shouldUseFullDropColumns() {
  return dropsColumnsMode !== "legacy";
}

function shouldUseEmbeddedArtistRelation() {
  return dropsArtistRelationMode !== "detached";
}

function updateDropSchemaModes(error: { message?: string } | null | undefined) {
  if (!error) {
    return;
  }

  if (
    isMissingColumnError(error, "drops", "creative_release_id") ||
    isMissingColumnError(error, "drops", "preview_uri") ||
    isMissingColumnError(error, "drops", "is_gated") ||
    isMissingColumnError(error, "drops", "delivery_uri") ||
    isMissingColumnError(error, "drops", "asset_type") ||
    isMissingColumnError(error, "drops", "contract_kind")
  ) {
    dropsColumnsMode = "legacy";
  }

  if (isMissingRelationError(error, "drops", "artists")) {
    dropsArtistRelationMode = "detached";
  }
}

function getLiveDropsSelectClause() {
  const columns = [
    "id",
    "artist_id",
    "title",
    "price_eth",
    "image_url",
    "image_ipfs_uri",
    "metadata_ipfs_uri",
    "status",
    "type",
    "ends_at",
    "supply",
    "sold",
    "contract_address",
    "contract_drop_id",
    "metadata",
  ];

  if (shouldUseFullDropColumns()) {
    columns.splice(2, 0, "creative_release_id");
    columns.splice(8, 0, "preview_uri", "asset_type");
    columns.splice(15, 0, "delivery_uri", "is_gated");
    columns.push("contract_kind");
  }

  if (shouldUseEmbeddedArtistRelation()) {
    columns.push(`
      artists (
        id,
        name,
        avatar_url
      )
    `);
  }

  return columns.join(",\n        ");
}

function getDropDetailSelectClause() {
  const columns = [
    "id",
    "artist_id",
    "title",
    "description",
    "price_eth",
    "supply",
    "sold",
    "image_url",
    "image_ipfs_uri",
    "metadata_ipfs_uri",
    "status",
    "type",
    "ends_at",
    "contract_address",
    "contract_drop_id",
    "metadata",
  ];

  if (shouldUseFullDropColumns()) {
    columns.splice(2, 0, "creative_release_id");
    columns.splice(10, 0, "preview_uri", "asset_type");
    columns.splice(15, 0, "delivery_uri", "is_gated");
    columns.push("contract_kind");
  }

  if (shouldUseEmbeddedArtistRelation()) {
    columns.push(`
      artists (
        id,
        name,
        handle,
        avatar_url
      )
    `);
  }

  return columns.join(",\n        ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTISTS - Fetch from Supabase
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchAllArtistsFromSupabase() {
  try {
    console.log("📖 Fetching all artists from Supabase...");
    const data = await fetchPublicArtistsFromSupabase();

    console.log(`✅ Fetched ${data?.length || 0} artists from Supabase`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchAllArtistsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchArtistByWalletFromSupabase(wallet: string) {
  try {
    console.log(`📖 Fetching artist by wallet from Supabase: ${wallet}`);
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("wallet", wallet.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("❌ Error fetching artist:", error.message);
      throw error;
    }

    if (data) console.log(`✅ Found artist: ${data.name || wallet}`);
    return data || null;
  } catch (error: any) {
    console.error("❌ fetchArtistByWalletFromSupabase failed:", error.message);
    return [];
  }
}

export async function fetchArtistByIdFromSupabase(artistId: string) {
  try {
    console.log(`📖 Fetching artist by ID from Supabase: ${artistId}`);
    const data = await fetchPublicArtistsFromSupabase(artistId);

    if (data) console.log(`✅ Found artist: ${data.name || artistId}`);
    return data || null;
  } catch (error: any) {
    console.error("❌ fetchArtistByIdFromSupabase failed:", error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS - Fetch from Supabase
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchAllProductsFromSupabase() {
  try {
    console.log("📖 Fetching all products from Supabase...");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} products from Supabase`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchAllProductsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchPublishedProductsFromSupabase() {
  try {
    console.log("📖 Fetching public products from Supabase...");
    let { data, error } = await supabase
      .from("products")
      .select(getPublicProductSelectClause())
      .in("status", [...PUBLIC_PRODUCT_STATUSES])
      .order("created_at", { ascending: false });

    updateProductSchemaMode(error);

    if (error && productColumnsMode === "legacy") {
      ({ data, error } = await supabase
        .from("products")
        .select(getPublicProductSelectClause())
        .in("status", [...PUBLIC_PRODUCT_STATUSES])
        .order("created_at", { ascending: false }));
    }

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} public products from Supabase`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchPublishedProductsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchProductByIdFromSupabase(productId: string) {
  try {
    console.log(`📦 Fetching product by ID from Supabase: ${productId}`);
    let { data, error } = await supabase
      .from("products")
      .select(getPublicProductSelectClause())
      .eq("id", productId)
      .in("status", [...PUBLIC_PRODUCT_STATUSES])
      .maybeSingle();

    updateProductSchemaMode(error);

    if (error && productColumnsMode === "legacy") {
      ({ data, error } = await supabase
        .from("products")
        .select(getPublicProductSelectClause())
        .eq("id", productId)
        .in("status", [...PUBLIC_PRODUCT_STATUSES])
        .maybeSingle());
    }

    if (error) {
      console.error("❌ Error fetching product:", error.message);
      throw error;
    }

    return data || null;
  } catch (error: any) {
    console.error("❌ fetchProductByIdFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchProductsByCreatorFromSupabase(creatorWallet: string) {
  try {
    console.log(`📖 Fetching products for creator: ${creatorWallet}`);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("creator_wallet", creatorWallet.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} products for creator`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchProductsByCreatorFromSupabase failed:", error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPS - Fetch from Supabase
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchAllDropsFromSupabase() {
  try {
    console.log("📖 Fetching all drops from Supabase...");
    const { data, error } = await supabase
      .from("drops")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    const attached = await attachArtistsToDrops(data || []);
    const merged = await appendReleaseBackedDrops(attached);
    console.log(`✅ Fetched ${merged.length || 0} drops from Supabase`);
    return merged;
  } catch (error: any) {
    console.error("❌ fetchAllDropsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchLiveDropsFromSupabase() {
  try {
    console.log("📖 Fetching live drops from Supabase...");
    let { data, error } = await supabase
      .from("drops")
      .select(getLiveDropsSelectClause())
      .order("created_at", { ascending: false });

    updateDropSchemaModes(error);
    if (error && shouldUseEmbeddedArtistRelation()) {
      dropsArtistRelationMode = "detached";
    }

    const needsFallback = Boolean(error && (dropsColumnsMode === "legacy" || dropsArtistRelationMode === "detached"));

    if (needsFallback) {
      ({ data, error } = await supabase
        .from("drops")
        .select(getLiveDropsSelectClause())
        .order("created_at", { ascending: false }));

      if (!error && dropsArtistRelationMode === "detached") {
        data = await attachArtistsToDrops(data || []);
      }
    } else {
      dropsColumnsMode = shouldUseFullDropColumns() ? "full" : "legacy";
      dropsArtistRelationMode = shouldUseEmbeddedArtistRelation() ? "embedded" : "detached";
    }

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    const enriched = await enrichDropsMediaFromMetadata(data || []);
    const merged = await appendReleaseBackedDrops(enriched);
    const filtered = filterNonExpiredLiveDrops(merged);
    console.log(`✅ Fetched ${filtered.length || 0} live drops from Supabase`);
    return filtered;
  } catch (error: any) {
    console.error("❌ fetchLiveDropsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchDropByIdFromSupabase(dropId: string) {
  try {
    console.log(`📖 Fetching drop by ID from Supabase: ${dropId}`);
    let { data, error } = await supabase
      .from("drops")
      .select(getDropDetailSelectClause())
      .eq("id", dropId)
      .maybeSingle();

    updateDropSchemaModes(error);
    if (error && shouldUseEmbeddedArtistRelation()) {
      dropsArtistRelationMode = "detached";
    }

    const needsFallback = Boolean(error && (dropsColumnsMode === "legacy" || dropsArtistRelationMode === "detached"));

    if (needsFallback) {
      ({ data, error } = await supabase
        .from("drops")
        .select(getDropDetailSelectClause())
        .eq("id", dropId)
        .maybeSingle());

      if (!error && dropsArtistRelationMode === "detached") {
        const dropsWithArtists = await attachArtistsToDrops(data ? [data] : []);
        data = dropsWithArtists[0] || null;
      }
    } else {
      dropsColumnsMode = shouldUseFullDropColumns() ? "full" : "legacy";
      dropsArtistRelationMode = shouldUseEmbeddedArtistRelation() ? "embedded" : "detached";
    }

    if (error) {
      console.error("❌ Error fetching drop:", error.message);
      throw error;
    }

    if (data) {
      return await enrichDropMediaFromMetadata(data);
    }

    return await fetchSyntheticDropByProductId(dropId);
  } catch (error: any) {
    console.error("❌ fetchDropByIdFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchDropsByArtistFromSupabase(artistId: string) {
  try {
    console.log(`📖 Fetching drops for artist: ${artistId}`);
    let { data, error } = await supabase
      .from("drops")
      .select(getDropDetailSelectClause())
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });

    updateDropSchemaModes(error);
    if (error && shouldUseEmbeddedArtistRelation()) {
      dropsArtistRelationMode = "detached";
    }

    const needsFallback = Boolean(error && (dropsColumnsMode === "legacy" || dropsArtistRelationMode === "detached"));

    if (needsFallback) {
      ({ data, error } = await supabase
        .from("drops")
        .select(getDropDetailSelectClause())
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false }));

      if (!error && dropsArtistRelationMode === "detached") {
        data = await attachArtistsToDrops(data || []);
      }
    } else {
      dropsColumnsMode = shouldUseFullDropColumns() ? "full" : "legacy";
      dropsArtistRelationMode = shouldUseEmbeddedArtistRelation() ? "embedded" : "detached";
    }

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    const enriched = await enrichDropsMediaFromMetadata(data || []);
    const merged = await appendReleaseBackedDrops(enriched, { artistId });
    console.log(`✅ Fetched ${merged.length || 0} drops for artist`);
    return merged;
  } catch (error: any) {
    console.error("❌ fetchDropsByArtistFromSupabase failed:", error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS - Fetch from Supabase
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchOrdersByBuyerFromSupabase(buyerWallet: string) {
  try {
    console.log(`📖 Fetching orders for buyer: ${buyerWallet}`);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_wallet", buyerWallet.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching orders:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} orders for buyer`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchOrdersByBuyerFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchOrdersByProductFromSupabase(productId: string) {
  try {
    console.log(`📖 Fetching orders for product: ${productId}`);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching orders:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} orders for product`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchOrdersByProductFromSupabase failed:", error.message);
    throw error;
  }
}
