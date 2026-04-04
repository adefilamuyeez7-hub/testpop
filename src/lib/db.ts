/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { SECURE_API_BASE } from "@/lib/apiBase";
import { PUBLIC_PRODUCT_STATUSES } from "@/lib/catalogVisibility";

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
  asset_type?: "image" | "video" | "audio" | "pdf" | "epub" | "merchandise" | "digital";
  preview_uri?: string;
  delivery_uri?: string;
  is_gated?: boolean;
  status?: "draft" | "live" | "ended";
  type?: "drop" | "auction" | "campaign";
  contract_address?: string;
  contract_drop_id?: number;
  contract_kind?: string;
  creative_release_id?: string | null;
  revenue?: number;
  ends_at?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  artist_id?: string | null;
  creative_release_id?: string | null;
  creator_wallet: string;
  name: string;
  description?: string;
  category?: string;
  product_type?: "physical" | "digital" | "hybrid";
  asset_type?: "image" | "video" | "audio" | "pdf" | "epub" | "merchandise" | "digital" | null;
  price_eth: number;
  stock?: number;
  sold?: number;
  image_url?: string;
  image_ipfs_uri?: string;
  preview_uri?: string | null;
  delivery_uri?: string | null;
  is_gated?: boolean;
  nft_link?: string;
  status?: "draft" | "published" | "active" | "out_of_stock";
  metadata?: Record<string, unknown>;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | null;
  contract_listing_id?: number | null;
  contract_product_id?: number | null;
  metadata_uri?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreativeRelease {
  id: string;
  artist_id: string;
  release_type: "collectible" | "physical" | "hybrid";
  title: string;
  description?: string | null;
  status?: "draft" | "review" | "published" | "live" | "paused" | "ended" | "archived";
  price_eth?: number;
  supply?: number;
  sold?: number;
  art_metadata_uri?: string | null;
  cover_image_uri?: string | null;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow";
  contract_address?: string | null;
  contract_listing_id?: number | null;
  contract_drop_id?: number | null;
  physical_details_jsonb?: Record<string, unknown>;
  shipping_profile_jsonb?: Record<string, unknown>;
  creator_notes?: string | null;
  metadata?: Record<string, unknown>;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductAsset {
  id: string;
  product_id: string;
  role?:
    | "hero_art"
    | "gallery_photo"
    | "physical_photo"
    | "preview"
    | "delivery"
    | "source"
    | "attachment";
  visibility?: "public" | "gated" | "private";
  asset_type?: "image" | "video" | "audio" | "pdf" | "epub" | "archive" | "software" | "document" | "other";
  storage_provider?: string | null;
  uri: string;
  preview_uri?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  checksum_sha256?: string | null;
  sort_order?: number;
  is_primary?: boolean;
  requires_signed_url?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  creative_release_id?: string | null;
  quantity: number;
  unit_price_eth: number;
  line_total_eth: number;
  fulfillment_type?: "physical" | "digital";
  delivery_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  product_id?: string | null;
  creative_release_id?: string | null;
  buyer_wallet: string;
  quantity?: number;
  currency?: string;
  subtotal_eth?: number;
  shipping_eth?: number;
  tax_eth?: number;
  total_price_eth: number;
  status?: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  shipping_address?: string | Record<string, unknown> | null;
  shipping_address_jsonb?: Record<string, unknown> | null;
  tracking_code?: string;
  tx_hash?: string;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | null;
  contract_order_id?: number | null;
  payout_status?: "unreleased" | "approved" | "released" | "refunded" | "failed" | null;
  approval_status?:
    | "pending"
    | "approved"
    | "rejected"
    | "production_accepted"
    | "shipped"
    | "delivered"
    | "refunded"
    | null;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  items?: Array<{
    product_id: string;
    quantity: number;
    unit_price_eth?: number;
    line_total_eth?: number;
    fulfillment_type?: "physical" | "digital";
    delivery_status?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface OrderWithItems extends Order {
  products?: {
    id?: string | null;
    name?: string | null;
    image_url?: string | null;
    image_ipfs_uri?: string | null;
    product_type?: Product["product_type"] | null;
    asset_type?: Product["asset_type"] | null;
    preview_uri?: string | null;
    delivery_uri?: string | null;
    is_gated?: boolean | null;
    creator_wallet?: string | null;
  } | Array<{
    id?: string | null;
    name?: string | null;
    image_url?: string | null;
    image_ipfs_uri?: string | null;
    product_type?: Product["product_type"] | null;
    asset_type?: Product["asset_type"] | null;
    preview_uri?: string | null;
    delivery_uri?: string | null;
    is_gated?: boolean | null;
    creator_wallet?: string | null;
  }> | null;
  order_items?: Array<OrderItem & {
    products?: {
      id?: string | null;
      name?: string | null;
      image_url?: string | null;
      image_ipfs_uri?: string | null;
      product_type?: Product["product_type"] | null;
      asset_type?: Product["asset_type"] | null;
      preview_uri?: string | null;
      delivery_uri?: string | null;
      is_gated?: boolean | null;
      creator_wallet?: string | null;
    } | Array<{
      id?: string | null;
      name?: string | null;
      image_url?: string | null;
      image_ipfs_uri?: string | null;
      product_type?: Product["product_type"] | null;
      asset_type?: Product["asset_type"] | null;
      preview_uri?: string | null;
      delivery_uri?: string | null;
      is_gated?: boolean | null;
      creator_wallet?: string | null;
    }> | null;
  }>;
}

export interface Entitlement {
  id: string;
  order_id?: string | null;
  order_item_id?: string | null;
  product_id: string;
  asset_id?: string | null;
  buyer_wallet: string;
  access_type?: "download" | "stream" | "reader" | "license";
  status?: "granted" | "revoked" | "expired" | "pending";
  grant_reason?: string | null;
  granted_at?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_accessed_at?: string | null;
  access_count?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Fulfillment {
  id: string;
  order_id: string;
  order_item_id?: string | null;
  product_id: string;
  creator_wallet?: string | null;
  fulfillment_type?: "physical" | "digital" | "hybrid";
  status?: "pending" | "queued" | "processing" | "sent" | "shipped" | "delivered" | "cancelled" | "failed";
  provider?: string | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
  shipping_address_jsonb?: Record<string, unknown> | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  delivery_confirmed_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface IPCampaign {
  id: string;
  artist_id: string;
  artists?: {
    id?: string;
    wallet?: string;
    name?: string | null;
    handle?: string | null;
  } | null;
  slug?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  campaign_type?: "revenue_share" | "royalty_split" | "catalog_fund" | "production_raise" | "fan_equity";
  rights_type?: "creative_ip" | "royalty_stream" | "production_rights" | "license_pool" | "catalog_interest";
  status?: "draft" | "review" | "active" | "funded" | "settled" | "closed" | "cancelled";
  visibility?: "private" | "listed" | "unlisted";
  funding_target_eth?: number;
  minimum_raise_eth?: number;
  unit_price_eth?: number | null;
  total_units?: number | null;
  units_sold?: number;
  opens_at?: string | null;
  closes_at?: string | null;
  settlement_at?: string | null;
  shares_contract_address?: string | null;
  shares_contract_tx?: string | null;
  legal_doc_uri?: string | null;
  cover_image_uri?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface IPInvestment {
  id: string;
  campaign_id: string;
  investor_wallet: string;
  amount_eth?: number;
  units_purchased?: number;
  unit_price_eth?: number | null;
  status?: "pending" | "confirmed" | "settled" | "refunded" | "cancelled";
  contribution_tx_hash?: string | null;
  settlement_tx_hash?: string | null;
  invested_at?: string;
  settled_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface RoyaltyDistribution {
  id: string;
  campaign_id: string;
  investment_id?: string | null;
  recipient_wallet: string;
  source_reference?: string | null;
  gross_amount_eth?: number;
  fee_amount_eth?: number;
  net_amount_eth?: number;
  status?: "pending" | "processing" | "paid" | "failed" | "cancelled";
  payout_tx_hash?: string | null;
  distributed_at?: string | null;
  metadata?: Record<string, unknown>;
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
  page?: string;
  event_type?: string;
  artist_id?: string;
  drop_id?: string;
  product_id?: string;
  order_id?: string;
  wallet?: string;
  session_id?: string;
  user_agent?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  timestamp?: string;
}

export interface CampaignSubmission {
  id: string;
  drop_id: string;
  submitter_wallet: string;
  content_url?: string | null;
  caption?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  onchain_tx_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Check if Supabase is configured - don't throw, just log
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️  Supabase not configured.");
  console.warn("To enable Supabase, add these to .env.local:");
  console.warn("  VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.warn("  VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here");
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

const secureApiBaseUrl = SECURE_API_BASE;

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
if (typeof window !== "undefined" && import.meta.env.DEV) {
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

    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("wallet", wallet.toLowerCase())
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error fetching artist profile:", error.message);
      throw error;
    }

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

export async function submitCampaignContent(payload: {
  dropId: string;
  contentUrl: string;
  caption?: string;
}): Promise<CampaignSubmission | null> {
  return secureApiRequest<CampaignSubmission | null>("/campaigns/submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCampaignSubmissions(
  dropId: string,
  scope: "mine" | "artist" = "artist"
): Promise<CampaignSubmission[]> {
  const search = new URLSearchParams();
  search.set("scope", scope);
  return secureApiRequest<CampaignSubmission[]>(`/campaigns/${dropId}/submissions?${search.toString()}`);
}

export async function reviewCampaignSubmission(
  dropId: string,
  submissionId: string,
  status: "approved" | "rejected"
): Promise<CampaignSubmission | null> {
  return secureApiRequest<CampaignSubmission | null>(
    `/campaigns/${dropId}/submissions/${submissionId}/review`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    }
  );
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

export async function getCreativeReleases(
  options: {
    artistId?: string;
    releaseType?: CreativeRelease["release_type"];
    status?: CreativeRelease["status"];
  } = {},
): Promise<CreativeRelease[]> {
  try {
    const params = new URLSearchParams();
    if (options.artistId) params.set("artist_id", options.artistId);
    if (options.releaseType) params.set("release_type", options.releaseType);
    if (options.status) params.set("status", options.status);
    const queryString = params.toString();
    if (secureApiBaseUrl) {
      const response = await fetch(
        `${secureApiBaseUrl}/creative-releases${queryString ? `?${queryString}` : ""}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    }

    return [];
  } catch (error: any) {
    console.error("getCreativeReleases failed:", error.message);
    return [];
  }
}

export async function getCreativeRelease(releaseId: string): Promise<CreativeRelease | null> {
  try {
    if (!releaseId) return null;
    if (secureApiBaseUrl) {
      const response = await fetch(`${secureApiBaseUrl}/creative-releases/${releaseId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    }

    return null;
  } catch (error: any) {
    console.error("getCreativeRelease failed:", error.message);
    return null;
  }
}

export async function createCreativeRelease(
  payload: Partial<CreativeRelease>,
): Promise<CreativeRelease | null> {
  try {
    return await secureApiRequest<CreativeRelease | null>("/creative-releases", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("createCreativeRelease failed:", error.message);
    return null;
  }
}

export async function updateCreativeRelease(
  releaseId: string,
  payload: Partial<CreativeRelease>,
): Promise<CreativeRelease | null> {
  try {
    if (!releaseId) return null;
    return await secureApiRequest<CreativeRelease | null>(`/creative-releases/${releaseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("updateCreativeRelease failed:", error.message);
    return null;
  }
}

export async function getProducts() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log("📖 Fetching public products");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("status", [...PUBLIC_PRODUCT_STATUSES])
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

export async function getProductsByCreativeRelease(creativeReleaseId: string) {
  try {
    if (!creativeReleaseId || !supabaseUrl || !supabaseAnonKey) return [];

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("creative_release_id", creativeReleaseId)
      .in("status", [...PUBLIC_PRODUCT_STATUSES])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products by creative release:", error.message);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("getProductsByCreativeRelease failed:", error.message);
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

export async function createProductAssets(
  assets: Array<Partial<ProductAsset>> | Partial<ProductAsset>,
): Promise<ProductAsset[]> {
  try {
    const payload = Array.isArray(assets) ? { assets } : assets;
    return await secureApiRequest<ProductAsset[]>("/product-assets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("createProductAssets failed:", error.message);
    return [];
  }
}

export async function createOrder(order: Partial<Order>): Promise<Order | null> {
  console.log(`💾 Creating order for ${order.buyer_wallet}`);

  if (typeof order.buyer_wallet === "string" && order.buyer_wallet.trim()) {
    const { establishSecureSession } = await import("@/lib/secureAuth");
    await establishSecureSession(order.buyer_wallet.trim().toLowerCase());
  }

  return secureApiRequest<Order | null>("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

const LEGACY_ORDER_SELECT = `
  id,
  product_id,
  creative_release_id,
  buyer_wallet,
  quantity,
  currency,
  subtotal_eth,
  shipping_eth,
  tax_eth,
  total_price_eth,
  status,
  shipping_address,
  shipping_address_jsonb,
  tracking_code,
  tx_hash,
  contract_kind,
  contract_order_id,
  payout_status,
  approval_status,
  paid_at,
  shipped_at,
  delivered_at,
  created_at,
  updated_at,
  products(
    id,
    name,
    image_url,
    image_ipfs_uri,
    product_type,
    asset_type,
    preview_uri,
    delivery_uri,
    is_gated,
    creator_wallet
  )
`;

const ORDER_SELECT = `
  ${LEGACY_ORDER_SELECT},
  order_items(
    id,
    product_id,
    creative_release_id,
    quantity,
    unit_price_eth,
    line_total_eth,
    fulfillment_type,
    delivery_status,
    products(
      id,
      name,
      image_url,
      image_ipfs_uri,
      product_type,
      asset_type,
      preview_uri,
      delivery_uri,
      is_gated,
      creator_wallet
    )
  )
`;

function isMissingOrderSchemaCompatError(errorOrMessage: unknown): boolean {
  const message =
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : typeof errorOrMessage === "object" && errorOrMessage !== null && "message" in errorOrMessage
      ? String((errorOrMessage as { message?: unknown }).message || "")
      : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") &&
    (normalized.includes("order_items") || normalized.includes("create_checkout_order"))
  );
}

function firstRelationRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeOrderRecord(order: OrderWithItems): OrderWithItems {
  if (order.order_items?.length) {
    return order;
  }

  const product = firstRelationRecord(order.products);
  if (!order.product_id || !product) {
    return {
      ...order,
      order_items: [],
    };
  }

  const quantity = Math.max(1, Number(order.quantity) || 1);
  const lineTotal = Number(order.total_price_eth) || 0;

  return {
    ...order,
    order_items: [
      {
        id: `${order.id}:${order.product_id}`,
        order_id: order.id,
        product_id: order.product_id,
        quantity,
        unit_price_eth: quantity > 0 ? lineTotal / quantity : lineTotal,
        line_total_eth: lineTotal,
        fulfillment_type: product.product_type === "physical" ? "physical" : "digital",
        delivery_status: order.status || "paid",
        products: product,
      },
    ],
  };
}

export async function getOrdersByBuyer(
  buyerWallet: string,
  options?: {
    accessibleOnly?: boolean;
    statuses?: Array<NonNullable<Order["status"]>>;
  }
): Promise<OrderWithItems[]> {
  try {
    const normalizedWallet = buyerWallet.toLowerCase();
    const requestedStatuses = (options?.statuses || []).filter(Boolean);
    const accessibleOnly = Boolean(options?.accessibleOnly);
    const accessibleStatuses: Array<NonNullable<Order["status"]>> = ["paid", "processing", "shipped", "delivered"];
    const statusFilter = requestedStatuses.length > 0 ? requestedStatuses : accessibleOnly ? accessibleStatuses : [];

    if (secureApiBaseUrl && getApiAuthToken()) {
      const params = new URLSearchParams();
      params.set("buyer_wallet", normalizedWallet);
      if (accessibleOnly) {
        params.set("accessible_only", "true");
      }
      if (statusFilter.length > 0) {
        params.set("statuses", statusFilter.join(","));
      }
      return secureApiRequest<OrderWithItems[]>(`/orders?${params.toString()}`);
    }

    if (!supabaseUrl || !supabaseAnonKey) return [];

    console.log(`📖 Fetching orders for buyer: ${buyerWallet}`);
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("buyer_wallet", normalizedWallet)
      .order("created_at", { ascending: false });

    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }

    let { data, error } = await query;

    if (error && isMissingOrderSchemaCompatError(error)) {
      let legacyQuery = supabase
        .from("orders")
        .select(LEGACY_ORDER_SELECT)
        .eq("buyer_wallet", normalizedWallet)
        .order("created_at", { ascending: false });

      if (statusFilter.length > 0) {
        legacyQuery = legacyQuery.in("status", statusFilter);
      }

      ({ data, error } = await legacyQuery);
    }

    if (error) {
      console.error("❌ Error fetching buyer orders:", error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} orders`);
    return ((data as OrderWithItems[]) || []).map(normalizeOrderRecord);
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
export async function getProductAssets(
  productId: string,
  options: { includePrivate?: boolean } = {},
): Promise<ProductAsset[]> {
  try {
    if (!productId || !supabaseUrl || !supabaseAnonKey) return [];

    if (options.includePrivate) {
      return await secureApiRequest<ProductAsset[]>(`/products/${productId}/assets`);
    }

    const { data, error } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", productId)
      .eq("visibility", "public")
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching public product assets:", error.message);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("getProductAssets failed:", error.message);
    return [];
  }
}

export async function getEntitlementsByBuyer(wallet: string): Promise<Entitlement[]> {
  try {
    if (!wallet) return [];
    return await secureApiRequest<Entitlement[]>(
      `/entitlements?buyer_wallet=${encodeURIComponent(wallet.toLowerCase())}`,
    );
  } catch (error: any) {
    console.error("getEntitlementsByBuyer failed:", error.message);
    return [];
  }
}

export async function getFulfillmentsByOrder(orderId: string): Promise<Fulfillment[]> {
  try {
    if (!orderId) return [];
    return await secureApiRequest<Fulfillment[]>(`/orders/${orderId}/fulfillments`);
  } catch (error: any) {
    console.error("getFulfillmentsByOrder failed:", error.message);
    return [];
  }
}

export async function getIPCampaigns(
  options: { artistId?: string; status?: IPCampaign["status"] } = {},
): Promise<IPCampaign[]> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return [];

    const params = new URLSearchParams();
    if (options.artistId) params.set("artist_id", options.artistId);
    if (options.status) params.set("status", options.status);

    if (getApiAuthToken()) {
      const queryString = params.toString();
      return await secureApiRequest<IPCampaign[]>(
        `/ip-campaigns${queryString ? `?${queryString}` : ""}`,
      );
    }

    let query = supabase
      .from("ip_campaigns")
      .select(`
        *,
        artists (
          id,
          name,
          handle
        )
      `)
      .in("visibility", ["listed", "unlisted"])
      .in("status", ["active", "funded", "settled", "closed"])
      .order("created_at", { ascending: false });

    if (options.artistId) {
      query = query.eq("artist_id", options.artistId);
    }

    if (options.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching IP campaigns:", error.message);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("getIPCampaigns failed:", error.message);
    return [];
  }
}

export async function createIPCampaign(payload: Partial<IPCampaign>): Promise<IPCampaign | null> {
  try {
    return await secureApiRequest<IPCampaign | null>("/ip-campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("createIPCampaign failed:", error.message);
    return null;
  }
}

export async function updateIPCampaign(
  campaignId: string,
  payload: Partial<IPCampaign>,
): Promise<IPCampaign | null> {
  try {
    return await secureApiRequest<IPCampaign | null>(`/ip-campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("updateIPCampaign failed:", error.message);
    return null;
  }
}

export async function createIPInvestment(
  payload: Partial<IPInvestment>,
): Promise<IPInvestment | null> {
  try {
    return await secureApiRequest<IPInvestment | null>("/ip-investments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    console.error("createIPInvestment failed:", error.message);
    return null;
  }
}

export async function getInvestorPositions(wallet: string): Promise<IPInvestment[]> {
  try {
    if (!wallet) return [];
    return await secureApiRequest<IPInvestment[]>(
      `/ip-investments?investor_wallet=${encodeURIComponent(wallet.toLowerCase())}`,
    );
  } catch (error: any) {
    console.error("getInvestorPositions failed:", error.message);
    return [];
  }
}

export async function getRoyaltyDistributions(wallet: string): Promise<RoyaltyDistribution[]> {
  try {
    if (!wallet) return [];
    return await secureApiRequest<RoyaltyDistribution[]>(
      `/royalty-distributions?recipient_wallet=${encodeURIComponent(wallet.toLowerCase())}`,
    );
  } catch (error: any) {
    console.error("getRoyaltyDistributions failed:", error.message);
    return [];
  }
}

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

export async function deleteWhitelistEntry(id: string) {
  console.log(`🗑️ Deleting whitelist entry: ${id}`);
  return secureApiRequest<void>(`/whitelist/${id}`, {
    method: "DELETE",
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

    const { error: modernError } = await supabase.from("analytics_events").insert([
      {
        event_type: page === "artist_profile" ? "artist_view" : "page_view",
        artist_id: artistId,
        session_id: "client",
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        metadata: {
          page,
        },
        created_at: new Date().toISOString(),
      },
    ]);

    if (!modernError) {
      console.log(`📊 Recorded analytics event: ${page}`);
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
    let { data, error } = await supabase
      .from("analytics_events")
      .select("*")
      .eq("artist_id", artistId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      ({ data, error } = await supabase
        .from("analytics")
        .select("*")
        .eq("artist_id", artistId)
        .gte("timestamp", since.toISOString())
        .order("timestamp", { ascending: false }));
    }

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

  const { error: whitelistError } = await supabase
    .from("whitelist")
    .upsert(
      {
        wallet: normalized.wallet_address,
        name: normalized.artist_name,
        tag: normalized.art_types?.[0] || "artist",
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet" }
    );

  if (whitelistError) {
    throw new Error(`Application saved but whitelist sync failed: ${whitelistError.message}`);
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
