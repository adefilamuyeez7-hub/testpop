import { supabase } from "./db";

/**
 * Migrate data from localStorage to Supabase
 * Run this once to move all existing data
 */

export async function migrateWhitelistToSupabase() {
  try {
    console.log("🚀 Starting whitelist migration...");

    const whitelist = localStorage.getItem("popup_admin_whitelist");
    if (!whitelist) {
      console.log("ℹ️  No local whitelist data found");
      return;
    }

    const parsedWhitelist = JSON.parse(whitelist);
    console.log(`📊 Found ${parsedWhitelist.length} whitelist entries in localStorage`);

    for (const entry of parsedWhitelist) {
      await supabase.from("whitelist").upsert(
        {
          wallet: entry.wallet?.toLowerCase(),
          name: entry.name,
          tag: entry.tag,
          status: entry.status,
          joined_at: entry.joinedAt ? new Date(entry.joinedAt).toISOString() : new Date().toISOString(),
          notes: entry.notes,
        },
        { onConflict: "wallet" }
      );
    }

    console.log("✅ Whitelist migrated successfully!");
  } catch (error) {
    console.error("❌ Whitelist migration failed:", error);
    throw error;
  }
}

export async function migrateArtistsToSupabase() {
  try {
    console.log("🚀 Starting artist migration...");

    const artists = localStorage.getItem("popup_artist_profiles");
    if (!artists) {
      console.log("ℹ️  No local artist data found");
      return;
    }

    const parsedArtists = JSON.parse(artists);
    console.log(`📊 Found ${parsedArtists.length} artists in localStorage`);

    for (const artist of parsedArtists) {
      await supabase.from("artists").upsert(
        {
          id: artist.id,
          wallet: artist.wallet?.toLowerCase(),
          name: artist.name,
          handle: artist.handle,
          bio: artist.bio,
          tag: artist.tag,
          subscription_price: artist.subscriptionPrice,
          avatar_url: artist.avatar,
          banner_url: artist.banner,
          twitter_url: artist.twitterUrl,
          instagram_url: artist.instagramUrl,
          website_url: artist.websiteUrl,
          poap_allocation: artist.defaultPoapAllocation || {
            subscribers: 40,
            bidders: 35,
            creators: 25,
          },
          portfolio: artist.portfolio || [],
          created_at: artist.createdAt || new Date().toISOString(),
        },
        { onConflict: "wallet" }
      );
    }

    console.log("✅ Artists migrated successfully!");
  } catch (error) {
    console.error("❌ Artist migration failed:", error);
    throw error;
  }
}

export async function migrateDropsToSupabase() {
  try {
    console.log("🚀 Starting drops migration...");

    const drops = localStorage.getItem("popup_artist_drops");
    if (!drops) {
      console.log("ℹ️  No local drops found");
      return;
    }

    const parsedDrops = JSON.parse(drops);
    console.log(`📊 Found ${parsedDrops.length} drops in localStorage`);

    for (const drop of parsedDrops) {
      // Get artist ID by wallet
      const { data: artist } = await supabase
        .from("artists")
        .select("id")
        .eq("wallet", drop.wallet?.toLowerCase())
        .single();

      if (!artist) {
        console.warn(`⚠️  Artist not found for drop: ${drop.id}`);
        continue;
      }

      await supabase.from("drops").upsert(
        {
          id: drop.id,
          artist_id: artist.id,
          title: drop.title,
          description: drop.description,
          price_eth: drop.priceEth,
          supply: drop.maxBuy || 1,
          sold: drop.bought || 0,
          image_url: drop.image,
          image_ipfs_uri: drop.imageUri,
          metadata_ipfs_uri: drop.metadataUri,
          status: drop.status || "draft",
          type: drop.type || "drop",
          contract_address: drop.contractAddress,
          contract_drop_id: drop.contractDropId,
          contract_kind: drop.contractKind,
          revenue: drop.revenue || 0,
          created_at: drop.createdAt || new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    console.log("✅ Drops migrated successfully!");
  } catch (error) {
    console.error("❌ Drops migration failed:", error);
    throw error;
  }
}

export async function migrateProductsToSupabase() {
  try {
    console.log("🚀 Starting products migration...");

    const products = localStorage.getItem("popup_admin_products");
    if (!products) {
      console.log("ℹ️  No local products found");
      return;
    }

    const parsedProducts = JSON.parse(products);
    console.log(`📊 Found ${parsedProducts.length} products in localStorage`);

    for (const product of parsedProducts) {
      await supabase.from("products").upsert(
        {
          id: product.id,
          creator_wallet: product.creator?.toLowerCase() || "",
          name: product.name,
          description: product.description,
          category: product.category,
          price_eth: product.priceEth,
          stock: product.stock || 0,
          sold: product.sold || 0,
          image_url: product.image,
          image_ipfs_uri: product.imageUri,
          status: product.status || "draft",
          metadata: product.metadata || {},
          created_at: product.createdAt || new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    console.log("✅ Products migrated successfully!");
  } catch (error) {
    console.error("❌ Products migration failed:", error);
    throw error;
  }
}

export async function migrateWhitelistToSupabase() {
  try {
    console.log("🚀 Starting whitelist migration...");

    const whitelist = localStorage.getItem("popup_admin_whitelist");
    if (!whitelist) {
      console.log("ℹ️  No local whitelist found");
      return;
    }

    const parsedWhitelist = JSON.parse(whitelist);
    console.log(`📊 Found ${parsedWhitelist.length} entries in localStorage`);

    for (const entry of parsedWhitelist) {
      await supabase.from("whitelist").upsert(
        {
          id: entry.id,
          wallet: entry.wallet?.toLowerCase(),
          name: entry.name,
          tag: entry.tag,
          status: entry.status || "pending",
          joined_at: entry.joinedAt || new Date().toISOString(),
        },
        { onConflict: "wallet" }
      );
    }

    console.log("✅ Whitelist migrated successfully!");
  } catch (error) {
    console.error("❌ Whitelist migration failed:", error);
    throw error;
  }
}

/**
 * Run ALL migrations
 * Usage: call this once after Supabase is set up
 */
export async function migrateAllData() {
  try {
    console.log("🚀🚀🚀 STARTING FULL DATA MIGRATION 🚀🚀🚀\n");

    await migrateArtistsToSupabase();
    await migrateDropsToSupabase();
    await migrateProductsToSupabase();
    await migrateWhitelistToSupabase();

    console.log("\n✅✅✅ ALL DATA MIGRATED SUCCESSFULLY! ✅✅✅");
    console.log(
      "You can now safely remove localStorage fallbacks if desired."
    );
  } catch (error) {
    console.error("\n❌ Migration failed at some point:", error);
    throw error;
  }
}

// Optional: Add this to a debug page or admin command
if (import.meta.hot) {
  // Only in dev mode
  (window as any).migrateAllData = migrateAllData;
  console.log("Migration available: window.migrateAllData()");
}
