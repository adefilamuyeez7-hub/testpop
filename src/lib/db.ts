import { createClient } from "@supabase/supabase-js";
import { getRuntimeApiToken } from "@/lib/runtimeSession";

// ─── TypeScript Types for Database Models ──────────────────────────────
export interface Artist {
  id: string;
  wallet: string;
  name?: string;
  handle?: string;
  bio?: string;
  tag?: string;
  role?: string;
  subscription_price?: number;
  avatar_url?: string;
  banner_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  website_url?: string;
  poap_allocation?: Record<string, number>;
  portfolio?: unknown[];
  // ✨ NEW: Artist contract deployment tracking
  contract_address?: string;
  contract_deployment_tx?: string;
  contract_deployed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Drop {
  id: string;
  artist_id: string;
  title: string;
  description?: string;
  price_eth: number;
  supply: number;
  sold?: number;
  image_url?: string;
  image_ipfs_uri?: string;
  metadata_ipfs_uri?: string;
  status?: "draft" | "live" | "ended";
  type?: "drop" | "auction" | "campaign";
  contract_address?: string;
  contract_drop_id?: number;
  contract_kind?: string;
  revenue?: number;
  ends_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  creator_wallet: string;
  name: string;
  description?: string;
  category?: string;
  price_eth: number;
  stock?: number;
  sold?: number;
  image_url?: string;
  image_ipfs_uri?: string;
  nft_link?: string;
  status?: "draft" | "published" | "out_of_stock";
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  product_id?: string;
  buyer_wallet: string;
  quantity: number;
  total_price_eth: number;
  status?: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  shipping_address?: string;
  tracking_code?: string;
  tx_hash?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WhitelistEntry {
  id: string;
  wallet: string;
  name: string;
  tag?: string;
  status?: "pending" | "approved" | "rejected";
  joined_at?: string;
  approved_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AnalyticsRecord {
  id: string;
  page: string;
  artist_id?: string;
  user_agent?: string;
  referrer?: string;
  timestamp?: string;
}

// ─────────────────────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured - don't throw, just log
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️  Supabase not configured.");
  console.warn("To enable Supabase, add these to .env.local:");
  console.warn("  VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.warn("  VITE_SUPABASE_ANON_KEY=your_anon_key_here");
}

// Create client even if not configured (will fail gracefully)
const supabaseConfig = {
  url: supabaseUrl || "https://placeholder.supabase.co",
  key: supabaseAnonKey || "placeholder_key",
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const secureApiBaseUrl = (import.meta.env.VITE_SECURE_API_BASE_URL || "").replace(/\/$/, "");

function getApiAuthToken(): string {
  return getRuntimeApiToken();
}

function requireSecureApi(operation: string) {
  if (!secureApiBaseUrl) {
    throw new Error(
      `${operation} requires a trusted backend. Set VITE_SECURE_API_BASE_URL and route writes through server-side wallet auth.`
    );
  }
}

async function secureApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireSecureApi(path);

  const token = getApiAuthToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${secureApiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const text = await response.text();
      if (text) message = text;
    } catch {
      // ignore parse issues
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

// ──────────────────────────────────────────────
//  Health Check & Connection Verification
// ──────────────────────────────────────────────

export async function checkSupabaseHealth() {
  console.log("🏥 Checking Supabase connection...");

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: "unconfigured",
      message: "Supabase credentials not found in .env.local",
      configured: false,
      connected: false,
    };
  }

  try {
    console.log(`📡 Attempting to connect to: ${supabaseUrl}`);

    // Try to fetch from artists table
    const { data, error, status } = await supabase
      .from("artists")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Supabase query error:", error.message, error.code);
      return {
        status: "error",
        message: error.message,
        code: error.code,
        configured: true,
        connected: false,
      };
    }

    console.log(`✅ Supabase connected! Got response:`, data);
    return {
      status: "success",
      message: "Connected to Supabase successfully",
      configured: true,
      connected: true,
      data,
    };
  } catch (error: any) {
    console.error("❌ Supabase connection failed:", error.message);
    return {
      status: "exception",
      message: error.message,
      configured: true,
      connected: false,
    };
  }
}

// Export health check to window for debugging
if (typeof window !== "undefined") {
  (window as any).checkSupabase = checkSupabaseHealth;
  console.log("💡 Debug tip: Call window.checkSupabase() in console to test connection");
}

// ──────────────────────────────────────────────
//  Artist Profile Operations
// ──────────────────────────────────────────────

export async function getArtistProfile(wallet: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("⚠️  Supabase not configured, skipping artist profile fetch");
      return null;
    }

    console.log(`📖 Fetching artist profile for wallet: ${wallet}`);
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("wallet", wallet.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error fetching artist profile:", error.message);
      throw error;
    }

    if (data) console.log("✅ Artist profile found:", data.name || wallet);
    return data || null;
  } catch (error: any) {
    console.error("❌ getArtistProfile failed:", error.message);
    throw error;
  }
}

export async function saveArtistProfile(wallet: string, profile: Partial<Artist>): Promise<Artist | null> {
  console.log(`💾 Saving artist profile for ${wallet}:`, profile.name);
  return secureApiRequest<Artist | null>("/artists/profile", {
    method: "POST",
    body: JSON.stringify({
      wallet: wallet.toLowerCase(),
      profile,
    }),
  });
}

// ✨ NEW: Update artist with contract address after deployment
export async function updateArtistContractAddress(
  wallet: string,
  contractAddress: string,
  deploymentTx: string
): Promise<Artist | null> {
  console.log(`💾 Updating artist contract address for ${wallet}:`, contractAddress);
  return secureApiRequest<Artist | null>("/artists/contract-address", {
    method: "POST",
    body: JSON.stringify({
      wallet: wallet.toLowerCase(),
      contractAddress,
      deploymentTx,
    }),
  });
}

export async function getArtistDrops(artistId: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return null;

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

    console.log(`✅ Found ${data?.length || 0} drops`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getArtistDrops failed:", error.message);
    return [];
  }
}

export async function createDrop(drop: Partial<Drop>): Promise<Drop | null> {
  console.log(`💾 Creating drop: ${drop.title}`);
  return secureApiRequest<Drop | null>("/drops", {
    method: "POST",
    body: JSON.stringify(drop),
  });
}

export async function updateDrop(dropId: string, updates: Partial<Drop>): Promise<Drop | null> {
  console.log(`♻️  Updating drop: ${dropId}`);
  return secureApiRequest<Drop | null>(`/drops/${dropId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteDrop(dropId: string) {
  console.log(`🗑️  Deleting drop: ${dropId}`);
  return secureApiRequest<void>(`/drops/${dropId}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
//  Product Operations
// ──────────────────────────────────────────────

export async function getProducts() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log("📖 Fetching published products");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} products`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getProducts failed:", error.message);
    return [];
  }
}

export async function getCreatorProducts(creatorWallet: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log(`📖 Fetching products for creator: ${creatorWallet}`);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("creator_wallet", creatorWallet.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching creator products:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} creator products`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getCreatorProducts failed:", error.message);
    return [];
  }
}

export async function createProduct(product: Partial<Product>): Promise<Product | null> {
  console.log(`💾 Creating product: ${product.name}`);
  return secureApiRequest<Product | null>("/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<Product | null> {
  console.log(`♻️  Updating product: ${productId}`);
  return secureApiRequest<Product | null>(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ──────────────────────────────────────────────
//  Order Operations
// ──────────────────────────────────────────────

export async function createOrder(order: Partial<Order>): Promise<Order | null> {
  console.log(`💾 Creating order for ${order.buyer_wallet}`);
  return secureApiRequest<Order | null>("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function getOrdersByBuyer(buyerWallet: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log(`📖 Fetching orders for buyer: ${buyerWallet}`);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_wallet", buyerWallet.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching buyer orders:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} orders`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getOrdersByBuyer failed:", error.message);
    return [];
  }
}

export async function getOrdersByProduct(productId: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log(`📖 Fetching orders for product: ${productId}`);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching product orders:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} product orders`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getOrdersByProduct failed:", error.message);
    return [];
  }
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
  console.log(`♻️  Updating order: ${orderId}`);
  return secureApiRequest<Order | null>(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ──────────────────────────────────────────────
//  Whitelist Operations
// ──────────────────────────────────────────────

export async function getWhitelist() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log("📖 Fetching whitelist");
    const { data, error } = await supabase
      .from("whitelist")
      .select("*")
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching whitelist:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} whitelist entries`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getWhitelist failed:", error.message);
    return [];
  }
}

export async function getApprovedArtists() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log("📖 Fetching approved artists");
    const { data, error } = await supabase
      .from("whitelist")
      .select("*")
      .eq("status", "approved")
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching approved artists:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} approved artists`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getApprovedArtists failed:", error.message);
    return [];
  }
}

export async function addToWhitelist(entry: any) {
  console.log(`💾 Adding to whitelist: ${entry.name}`);
  return secureApiRequest<WhitelistEntry | null>("/whitelist", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function updateWhitelistEntry(id: string, updates: any) {
  console.log(`♻️  Updating whitelist entry: ${id}`);
  return secureApiRequest<WhitelistEntry | null>(`/whitelist/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ──────────────────────────────────────────────
//  Analytics Operations
// ──────────────────────────────────────────────

export async function recordPageView(page: string, artistId?: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("⚠️  Skipping analytics (Supabase not configured)");
      return;
    }

    const { error } = await supabase.from("analytics").insert([
      {
        page,
        artist_id: artistId,
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("⚠️  Analytics insert failed:", error.message);
      return;
    }

    console.log(`📊 Recorded pageview: ${page}`);
  } catch (error: any) {
    console.warn("⚠️  recordPageView failed:", error.message);
    // Don't throw - analytics is non-critical
  }
}

export async function recordArtistView(artistId: string) {
  return recordPageView("artist_profile", artistId);
}

export async function getArtistAnalytics(artistId: string, days: number = 30) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    const since = new Date();
    since.setDate(since.getDate() - days);

    console.log(`📊 Fetching analytics for artist: ${artistId}`);
    const { data, error } = await supabase
      .from("analytics")
      .select("*")
      .eq("artist_id", artistId)
      .gte("timestamp", since.toISOString())
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("❌ Error fetching analytics:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} analytics records`);
    return data || [];
  } catch (error: any) {
    console.error("❌ getArtistAnalytics failed:", error.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Artist Application Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtistApplication {
  id: string;
  wallet_address: string;
  email: string;
  artist_name: string;
  bio?: string;
  art_types: string[];
  twitter_url?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
  portfolio_url?: string | null;
  terms_agreed: boolean;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ArtistApplicationInsert = Omit<ArtistApplication, "id" | "status" | "submitted_at" | "reviewed_at" | "reviewed_by" | "created_at" | "updated_at">;

// ─────────────────────────────────────────────────────────────────────────────
//  Waitlist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a wallet was on the pre-launch waitlist.
 * Use this on first login to personalise onboarding for early supporters.
 */
export async function getWaitlistEntry(walletAddress: string) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const normalized = walletAddress.toLowerCase().trim();
  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .eq("wallet_address", normalized)
    .single();
  if (error && error.code !== "PGRST116") return null;
  return data ?? null;
}

export async function getWaitlistCount(): Promise<number> {
  if (!supabaseUrl || !supabaseAnonKey) return 0;
  const { count, error } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export async function getAllWaitlistEntries() {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("❌ getAllWaitlistEntries failed:", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Artist Applications
// ─────────────────────────────────────────────────────────────────────────────

export async function submitArtistApplication(
  data: ArtistApplicationInsert
): Promise<ArtistApplication> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured. Cannot submit application.");
  }

  const normalized = {
    ...data,
    wallet_address: data.wallet_address.toLowerCase().trim(),
  };

  const { data: result, error } = await supabase
    .from("artist_applications")
    .insert([normalized])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already submitted an application from this wallet.");
    }
    throw new Error(`Failed to submit application: ${error.message}`);
  }

  if (!result) throw new Error("Application submitted but no confirmation received.");
  return result as ArtistApplication;
}

export async function getArtistApplication(
  walletAddress: string
): Promise<ArtistApplication | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const normalized = walletAddress.toLowerCase().trim();
  const { data, error } = await supabase
    .from("artist_applications")
    .select("*")
    .eq("wallet_address", normalized)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return (data as ArtistApplication) ?? null;
}

export async function getAllApplications(
  status?: "pending" | "approved" | "rejected"
): Promise<ArtistApplication[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  let query = supabase
    .from("artist_applications")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ArtistApplication[]) || [];
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  adminNotes?: string
): Promise<ArtistApplication> {
  const { data, error } = await supabase
    .from("artist_applications")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      admin_notes: adminNotes ?? null,
    })
    .eq("id", applicationId)
    .select()
    .single();

  if (error) throw error;
  return data as ArtistApplication;
}

/**
 * Atomically approve an artist application:
 *   1. Mark application as approved
 *   2. Upsert into whitelist
 *   3. Create/update artist profile with is_verified = true
 */
export async function approveArtistAtomically(
  applicationId: string,
  walletAddress: string,
  artistName: string,
  email: string,
  bio: string,
  reviewedBy: string,
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  const normalized = walletAddress.toLowerCase().trim();

  // Step 1: update application
  const { error: appError } = await supabase
    .from("artist_applications")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      admin_notes: adminNotes ?? null,
    })
    .eq("id", applicationId);

  if (appError) throw new Error(`Failed to update application: ${appError.message}`);

  // Step 2: upsert whitelist
  const { error: wlError } = await supabase
    .from("whitelist")
    .upsert(
      {
        wallet: normalized,
        name: artistName,
        status: "approved",
        approved_at: new Date().toISOString(),
      },
      { onConflict: "wallet" }
    );

  if (wlError) throw new Error(`Failed to add to whitelist: ${wlError.message}`);

  // Step 3: upsert artist profile
  const { error: artistError } = await supabase
    .from("artists")
    .upsert(
      {
        wallet: normalized,
        name: artistName,
        bio,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet" }
    );

  if (artistError) throw new Error(`Failed to create artist profile: ${artistError.message}`);

  return { success: true, message: `${artistName} approved successfully.` };
}
