/**
 * Supabase Store - Complete integration for artists, products, drops, and orders
 * Replaces localStorage with real Supabase database queries
 */

import { supabase } from "./db";
import { toast } from "sonner";

let dropsColumnsMode: "full" | "legacy" | null = null;
let dropsArtistRelationMode: "embedded" | "detached" | null = null;

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

function withDropDefaults<T extends Record<string, any> | null>(drop: T): T {
  if (!drop) return drop;

  return {
    preview_uri: null,
    delivery_uri: null,
    asset_type: "image",
    is_gated: false,
    contract_kind: null,
    ...drop,
  };
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
    isMissingColumnError(error, "drops", "preview_uri") ||
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
  ];

  if (shouldUseFullDropColumns()) {
    columns.splice(7, 0, "preview_uri", "delivery_uri", "asset_type");
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
  ];

  if (shouldUseFullDropColumns()) {
    columns.splice(10, 0, "preview_uri", "delivery_uri", "asset_type");
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
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching artists:", error.message);
      throw error;
    }

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
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("id", artistId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error fetching artist:", error.message);
      throw error;
    }

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
    console.log("📖 Fetching published products from Supabase...");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} published products from Supabase`);
    return data || [];
  } catch (error: any) {
    console.error("❌ fetchPublishedProductsFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchProductByIdFromSupabase(productId: string) {
  try {
    console.log(`📦 Fetching product by ID from Supabase: ${productId}`);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

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

    console.log(`✅ Fetched ${data?.length || 0} drops from Supabase`);
    return data || [];
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
      .eq("status", "live")
      .or("type.eq.campaign,and(contract_address.not.is.null,contract_drop_id.not.is.null)")
      .order("created_at", { ascending: false });

    updateDropSchemaModes(error);
    const needsFallback = Boolean(error && (dropsColumnsMode === "legacy" || dropsArtistRelationMode === "detached"));

    if (needsFallback) {
      ({ data, error } = await supabase
        .from("drops")
        .select(getLiveDropsSelectClause())
        .eq("status", "live")
        .or("type.eq.campaign,and(contract_address.not.is.null,contract_drop_id.not.is.null)")
        .order("created_at", { ascending: false }));

      if (!error) {
        if (dropsArtistRelationMode === "detached") {
          const artistMap = await fetchArtistsByIdsFromSupabase((data || []).map((drop) => drop.artist_id));
          data = (data || []).map((drop) => ({
            ...withDropDefaults(drop),
            artists: artistMap.get(drop.artist_id) || null,
          }));
        }
      }
    } else {
      dropsColumnsMode = shouldUseFullDropColumns() ? "full" : "legacy";
      dropsArtistRelationMode = shouldUseEmbeddedArtistRelation() ? "embedded" : "detached";
    }

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} live drops from Supabase`);
    return data || [];
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
    const needsFallback = Boolean(error && (dropsColumnsMode === "legacy" || dropsArtistRelationMode === "detached"));

    if (needsFallback) {
      ({ data, error } = await supabase
        .from("drops")
        .select(getDropDetailSelectClause())
        .eq("id", dropId)
        .maybeSingle());

      if (!error) {
        if (dropsArtistRelationMode === "detached") {
          const artistMap = await fetchArtistsByIdsFromSupabase([data?.artist_id]);
          data = data
            ? {
                ...withDropDefaults(data),
                artists: artistMap.get(data.artist_id) || null,
              }
            : null;
        }
      }
    } else {
      dropsColumnsMode = shouldUseFullDropColumns() ? "full" : "legacy";
      dropsArtistRelationMode = shouldUseEmbeddedArtistRelation() ? "embedded" : "detached";
    }

    if (error) {
      console.error("❌ Error fetching drop:", error.message);
      throw error;
    }

    return withDropDefaults(data ?? null);
  } catch (error: any) {
    console.error("❌ fetchDropByIdFromSupabase failed:", error.message);
    throw error;
  }
}

export async function fetchDropsByArtistFromSupabase(artistId: string) {
  try {
    console.log(`📖 Fetching drops for artist: ${artistId}`);
    const { data, error } = await supabase
      .from("drops")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} drops for artist`);
    return data || [];
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
