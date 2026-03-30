/**
 * Supabase Store - Complete integration for artists, products, drops, and orders
 * Replaces localStorage with real Supabase database queries
 */

import { supabase } from "./db";
import { toast } from "sonner";

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
    const { data, error } = await supabase
      .from("drops")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching drops:", error.message);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} live drops from Supabase`);

    // Enrich drops with artist information
    const enrichedData = await Promise.all(
      (data || []).map(async (drop) => {
        try {
          if (drop.artist_id) {
            const { data: artistData } = await supabase
              .from("artists")
              .select("id, name, avatar_url")
              .eq("id", drop.artist_id)
              .single();

            return {
              ...drop,
              artists: artistData || null,
            };
          }
          return drop;
        } catch (err) {
          console.warn(`⚠️  Could not fetch artist for drop ${drop.id}:`, err);
          return drop;
        }
      })
    );

    return enrichedData || [];
  } catch (error: any) {
    console.error("❌ fetchLiveDropsFromSupabase failed:", error.message);
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
