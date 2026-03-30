import { getServerArtistWhitelist, getStoredArtistWhitelist } from "@/lib/whitelist";
import {
  getArtistProfile as dbGetArtistProfile,
  saveArtistProfile as dbSaveArtistProfile,
  getArtistDrops as dbGetArtistDrops,
  createDrop as dbCreateDrop,
  updateDrop as dbUpdateDrop,
  deleteDrop as dbDeleteDrop,
} from "@/lib/db";

export type ArtistPortfolioItem = {
  id: string;
  image: string;
  imageUri?: string;
  metadataUri?: string;
  title: string;
  medium: string;
  year: string;
};

export type ArtistCampaignRecord = {
  id: string;
  artistId: string;
  title: string;
  type: "Auction" | "Content" | "Subscriber";
  totalPOAPs: number;
  distributed: number;
  status: "active" | "completed" | "draft";
  subPct: number;
  bidPct: number;
  creatorPct: number;
  metadataUri?: string;
};

export type ArtistDropRecord = {
  id: string;
  artistId: string;
  title: string;
  artist: string;
  artistAvatar: string;
  image: string;
  imageUri?: string;
  metadataUri: string;
  priceEth: string;
  currentBidEth?: string | null;
  endsIn: string;
  type: "Auction" | "Drop" | "Campaign";
  description: string;
  edition: string;
  bids: number;
  poap: boolean;
  poapNote?: string;
  contractAddress: string | null;
  contractDropId?: number | null;
  contractKind?: "artDrop" | "poapCampaign" | null;
  maxBuy?: number;
  bought?: number;
  status: "live" | "upcoming" | "ended" | "draft";
};

export type ArtistPublicProfile = {
  id: string;
  wallet?: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  tag: string;
  subscribers: number;
  bio: string;
  subscriptionPrice: string;
  twitterUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  investGoals: { label: string; eth: number }[];
  investRaised: number;
  investTotal: number;
  portfolio: ArtistPortfolioItem[];
  defaultPoapAllocation: {
    subscribers: number;
    bidders: number;
    creators: number;
  };
  contractAddress?: string | null; // Artist's deployed NFT contract address
};

// Check if Supabase is configured
const SUPABASE_ENABLED =
  typeof import.meta.env.VITE_SUPABASE_URL === "string" &&
  import.meta.env.VITE_SUPABASE_URL.length > 0;

const EMPTY_ARTISTS: ArtistPublicProfile[] = [];
const EMPTY_DROPS: ArtistDropRecord[] = [];
const EMPTY_CAMPAIGNS: ArtistCampaignRecord[] = [];

// Cache for in-memory state
let _artistsCache: ArtistPublicProfile[] | null = null;
let _dropsCache: ArtistDropRecord[] | null = null;
let _campaignsCache: ArtistCampaignRecord[] | null = null;
// Supabase-first runtime cache for artist data.
async function getSupabaseArtist(wallet?: string): Promise<ArtistPublicProfile | null> {
  if (!SUPABASE_ENABLED || !wallet) return null;

  try {
    const profile = await dbGetArtistProfile(wallet);
    if (!profile) return null;

    // Convert from DB format to app format
    return {
      id: profile.id,
      wallet: profile.wallet,
      name: profile.name || "",
      handle: profile.handle || "",
      avatar: profile.avatar_url || "",
      banner: profile.banner_url || "",
      tag: profile.tag || "Other",
      subscribers: 0,
      bio: profile.bio || "",
      subscriptionPrice: profile.subscription_price?.toString() || "0.02",
      twitterUrl: profile.twitter_url || "",
      instagramUrl: profile.instagram_url || "",
      websiteUrl: profile.website_url || "",
      investGoals: [{ label: "Studio growth", eth: 5 }],
      investRaised: 0,
      investTotal: 5,
      portfolio: profile.portfolio || [],
      defaultPoapAllocation: profile.poap_allocation || {
        subscribers: 40,
        bidders: 35,
        creators: 25,
      },
      contractAddress: profile.contract_address || null,
    };
  } catch (error) {
    console.warn("Supabase read failed:", error);
    return null;
  }
}

async function saveSupabaseArtist(
  wallet: string | undefined,
  record: ArtistPublicProfile
): Promise<void> {
  if (!SUPABASE_ENABLED || !wallet) return;

  try {
    await dbSaveArtistProfile(wallet, {
      name: record.name,
      handle: record.handle,
      bio: record.bio,
      tag: record.tag,
      subscription_price: record.subscriptionPrice,
      avatar_url: record.avatar,
      banner_url: record.banner,
      twitter_url: record.twitterUrl,
      instagram_url: record.instagramUrl,
      website_url: record.websiteUrl,
      portfolio: record.portfolio,
      poap_allocation: record.defaultPoapAllocation,
      contract_address: record.contractAddress || null,
    });
  } catch (error) {
    console.warn("Supabase write failed:", error);
  }
}

function normalizeWallet(wallet?: string) {
  return wallet?.trim().toLowerCase();
}

function createDefaultArtistRecord(wallet?: string, name?: string, tag?: string): ArtistPublicProfile {
  const normalizedWallet = normalizeWallet(wallet);
  const fallbackHandle = normalizedWallet ? normalizedWallet.slice(2, 10) : "artist";

  return {
    id: normalizedWallet ? `artist-${normalizedWallet.slice(-6)}` : "artist-draft",
    wallet: normalizedWallet,
    name: name?.trim() || "",
    handle: fallbackHandle,
    avatar: "",
    banner: "",
    tag: tag?.trim() || "Other",
    subscribers: 0,
    bio: "",
    subscriptionPrice: "0.02",
    twitterUrl: "",
    instagramUrl: "",
    websiteUrl: "",
    investGoals: [{ label: "Studio growth", eth: 5 }],
    investRaised: 0,
    investTotal: 5,
    portfolio: [],
    defaultPoapAllocation: { subscribers: 40, bidders: 35, creators: 25 },
    contractAddress: null, // No deployed contract yet
  };
}

function getApprovedWallets() {
  return new Set(
    getStoredArtistWhitelist()
      .filter((entry) => entry.status === "approved")
      .map((entry) => normalizeWallet(entry.wallet))
      .filter((wallet): wallet is string => Boolean(wallet))
  );
}

function getApprovedWhitelistEntry(wallet?: string) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return null;

  return (
    getStoredArtistWhitelist().find(
      (entry) => entry.status === "approved" && normalizeWallet(entry.wallet) === normalized
    ) ?? null
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sync Functions (use cache or localStorage, trigger async Supabase loads)
// ═══════════════════════════════════════════════════════════════════════════════

export function getAllArtists() {
  const artists = _artistsCache || EMPTY_ARTISTS;
  const approvedWallets = getApprovedWallets();

  return artists.filter((artist) => {
    const wallet = normalizeWallet(artist.wallet);
    return wallet ? approvedWallets.has(wallet) : true;
  });
}

export function getAllDrops() {
  const drops = _dropsCache || EMPTY_DROPS;
  const allowedArtistIds = new Set(getAllArtists().map((artist) => artist.id));
  return drops.filter((drop) => allowedArtistIds.has(drop.artistId));
}

export async function updateArtistDropContractId(dropId: string, contractDropId: number) {
  try {
    if (!dropId) throw new Error("Invalid drop ID");

    const updated = await dbUpdateDrop(dropId, {
      contract_drop_id: contractDropId,
      contract_kind: "artDrop",
    });

    if (updated) {
      _dropsCache = (_dropsCache || EMPTY_DROPS).map((drop) =>
        drop.id === dropId ? { ...drop, contractDropId, contractKind: "artDrop" } : drop
      );
      return updated;
    }

    return null;
  } catch (error) {
    console.error("❌ updateArtistDropContractId failed:", error);
    return null;
  }
}

export function getAllCampaigns() {
  return _campaignsCache || EMPTY_CAMPAIGNS;
}

export function getArtistById(id: string) {
  return getAllArtists().find((artist) => artist.id === id) ?? null;
}

export function getArtistDrops(artistId: string) {
  return getAllDrops().filter((drop) => drop.artistId === artistId);
}

export function getArtistCampaigns(artistId: string) {
  return getAllCampaigns().filter((campaign) => campaign.artistId === artistId);
}

export function getDropById(id: string) {
  return getAllDrops().find((drop) => drop.id === id) ?? null;
}

export function resolveArtistForWallet(wallet?: string) {
  const normalizedWallet = normalizeWallet(wallet);
  const artists = _artistsCache || EMPTY_ARTISTS;

  if (!normalizedWallet) {
    return createDefaultArtistRecord();
  }

  const direct = artists.find((artist) => normalizeWallet(artist.wallet) === normalizedWallet);
  if (direct) return direct;

  const whitelistEntry = getApprovedWhitelistEntry(normalizedWallet);
  const created = createDefaultArtistRecord(
    normalizedWallet,
    whitelistEntry?.name,
    whitelistEntry?.tag
  );

  saveArtistRecord(created);
  return created;
}

export async function saveArtistRecord(record: ArtistPublicProfile) {
  const artists = _artistsCache || EMPTY_ARTISTS;
  const next = artists.some((artist) => artist.id === record.id)
    ? artists.map((artist) => (artist.id === record.id ? record : artist))
    : [...artists, record];

  _artistsCache = next;

  // Save to Supabase (wait for it to complete)
  if (record.wallet) {
    try {
      await saveSupabaseArtist(record.wallet, record);
      console.log(`✅ Artist profile saved to Supabase: ${record.name}`);
    } catch (err) {
      console.error("❌ Failed to save artist to Supabase:", err);
      throw err;
    }
  }

  return record;
}

export async function updateArtistProfile(
  wallet: string | undefined,
  updates: Partial<ArtistPublicProfile>
) {
  const current = resolveArtistForWallet(wallet);
  const next = { ...current, ...updates, id: current.id };
  return await saveArtistRecord(next);
}

export async function saveArtistPortfolio(
  wallet: string | undefined,
  portfolio: ArtistPortfolioItem[]
) {
  const current = resolveArtistForWallet(wallet);
  return await saveArtistRecord({ ...current, portfolio });
}

export function createArtistDrop(drop: ArtistDropRecord) {
  const drops = _dropsCache || EMPTY_DROPS;
  const next = [drop, ...drops.filter((existing) => existing.id !== drop.id)];

  _dropsCache = next;

  // Async Supabase backup
  dbCreateDrop({
    id: drop.id,
    artist_id: drop.artistId,
    title: drop.title,
    description: drop.description,
    price_eth: drop.priceEth,
    supply: drop.maxBuy || 1,
    sold: drop.bought || 0,
    image_url: drop.image,
    image_ipfs_uri: drop.imageUri,
    metadata_ipfs_uri: drop.metadataUri,
    status: drop.status,
    type: drop.type,
    contract_address: drop.contractAddress,
    contract_drop_id: drop.contractDropId,
    contract_kind: drop.contractKind,
  }).catch((err) => console.error("Failed to backup drop to Supabase:", err));

  return drop;
}

export function deleteArtistDrop(dropId: string) {
  const drops = _dropsCache || EMPTY_DROPS;
  const next = drops.filter((drop) => drop.id !== dropId);

  _dropsCache = next;

  // Async Supabase backup
  dbDeleteDrop(dropId).catch((err) =>
    console.error("Failed to delete drop from Supabase:", err)
  );
}

export function createArtistCampaign(campaign: ArtistCampaignRecord) {
  const campaigns = _campaignsCache || EMPTY_CAMPAIGNS;
  const next = [campaign, ...campaigns.filter((existing) => existing.id !== campaign.id)];

  _campaignsCache = next;

  // TODO: Implement Supabase campaigns table if needed
  return campaign;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Async initialization - load from Supabase on app startup
// ═══════════════════════════════════════════════════════════════════════════════

export async function initializeFromSupabase() {
  if (!SUPABASE_ENABLED) {
    console.log("ℹ️  Supabase not configured, artist bootstrap skipped");
    return;
  }

  try {
    console.log("📡 Loading data from Supabase...");

    // Load approved artists from Supabase into the in-memory runtime cache.
    const whitelistEntries = await getServerArtistWhitelist();
    const approvedWallets = whitelistEntries
      .filter((entry) => entry.status === "approved")
      .map((entry) => normalizeWallet(entry.wallet))
      .filter((wallet): wallet is string => Boolean(wallet));

    const dbArtists = await Promise.all(
      approvedWallets.map(async (wallet) => {
        try {
          return await getSupabaseArtist(wallet);
        } catch {
          return null;
        }
      })
    );

    const validDbArtists = dbArtists.filter((a): a is ArtistPublicProfile => Boolean(a));
    _artistsCache = validDbArtists;

    console.log(`✅ Loaded ${validDbArtists.length} artists from Supabase`);
  } catch (error) {
    console.error("Failed to initialize from Supabase:", error);
  }
}
