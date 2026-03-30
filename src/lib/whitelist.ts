import { supabase } from "@/lib/db";

export type ArtistWhitelistEntry = {
  id: string;
  wallet: string;
  name: string;
  tag: string;
  status: "approved" | "pending" | "rejected";
  joinedAt: string;
  joined_at?: string;
  approved_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export const ARTIST_WHITELIST_STORAGE_KEY = "popup_whitelist_cache";

let whitelistCache: ArtistWhitelistEntry[] = [];

function normalizeWallet(address: string | undefined) {
  return address?.trim().toLowerCase() ?? "";
}

function normalizeEntry(
  entry: Partial<ArtistWhitelistEntry> & { wallet?: string }
): ArtistWhitelistEntry | null {
  const wallet = normalizeWallet(entry.wallet);
  if (!wallet) return null;

  return {
    id: entry.id ?? `w${Date.now()}-${wallet.slice(-4)}`,
    wallet,
    name: entry.name?.trim() || "Unnamed Artist",
    tag: entry.tag?.trim() || "Other",
    status: entry.status ?? "pending",
    joinedAt:
      entry.joinedAt ??
      entry.joined_at ??
      new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    joined_at: entry.joined_at,
    approved_at: entry.approved_at,
    notes: entry.notes,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

function dedupeEntries(entries: ArtistWhitelistEntry[]) {
  const byWallet = new Map<string, ArtistWhitelistEntry>();

  entries.forEach((entry) => {
    byWallet.set(normalizeWallet(entry.wallet), entry);
  });

  return Array.from(byWallet.values());
}

export function getStoredArtistWhitelist(): ArtistWhitelistEntry[] {
  return whitelistCache;
}

export async function getServerArtistWhitelist(): Promise<ArtistWhitelistEntry[]> {
  const { data, error } = await supabase
    .from("whitelist")
    .select("*")
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch whitelist from Supabase:", error);
    throw error;
  }

  const normalized = (data || [])
    .map((entry) =>
      normalizeEntry({
        id: entry.id,
        wallet: entry.wallet,
        name: entry.name,
        tag: entry.tag,
        status: entry.status,
        joinedAt: entry.joined_at,
        joined_at: entry.joined_at,
        approved_at: entry.approved_at,
        notes: entry.notes,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      })
    )
    .filter((entry): entry is ArtistWhitelistEntry => Boolean(entry));

  const deduped = dedupeEntries(normalized);
  whitelistCache = deduped;
  return deduped;
}

export async function getArtistWhitelist(): Promise<ArtistWhitelistEntry[]> {
  return getServerArtistWhitelist();
}

export function syncArtistWhitelist(entries: ArtistWhitelistEntry[]) {
  const normalized = dedupeEntries(
    entries
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is ArtistWhitelistEntry => Boolean(entry))
  );

  whitelistCache = normalized;
  return normalized;
}

export async function getApprovedArtistWallets(): Promise<string[]> {
  const whitelist = await getArtistWhitelist();
  return whitelist
    .filter((entry) => entry.status === "approved")
    .map((entry) => normalizeWallet(entry.wallet));
}

export async function isWhitelistedArtist(address: string | undefined): Promise<boolean> {
  const wallet = normalizeWallet(address);
  if (!wallet) return false;

  const approvedWallets = await getApprovedArtistWallets();
  return approvedWallets.includes(wallet);
}

export async function addArtistToWhitelist(
  wallet: string,
  name: string,
  tag?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedWallet = normalizeWallet(wallet);
    if (!normalizedWallet) {
      return { success: false, error: "Invalid wallet address" };
    }

    const { error } = await supabase.from("whitelist").upsert(
      {
        wallet: normalizedWallet,
        name: name.trim(),
        tag: tag?.trim(),
        status: "pending",
        notes: notes?.trim(),
        joined_at: new Date().toISOString(),
      },
      {
        onConflict: "wallet",
      }
    );

    if (error) {
      console.error("Failed to add artist to whitelist:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding artist to whitelist:", error);
    return { success: false, error: "Failed to add artist to whitelist" };
  }
}

export async function updateArtistWhitelistStatus(
  wallet: string,
  status: "approved" | "pending" | "rejected",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedWallet = normalizeWallet(wallet);
    if (!normalizedWallet) {
      return { success: false, error: "Invalid wallet address" };
    }

    const updateData: Record<string, string | null> = {
      status,
      updated_at: new Date().toISOString(),
      approved_at: status === "approved" ? new Date().toISOString() : null,
    };

    if (notes !== undefined) {
      updateData.notes = notes.trim();
    }

    const { error } = await supabase.from("whitelist").update(updateData).eq("wallet", normalizedWallet);

    if (error) {
      console.error("Failed to update artist whitelist status:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating artist whitelist status:", error);
    return { success: false, error: "Failed to update artist status" };
  }
}

export function isWhitelistedArtistSync(address: string | undefined): boolean {
  const wallet = normalizeWallet(address);
  if (!wallet) return false;

  return getStoredArtistWhitelist()
    .filter((entry) => entry.status === "approved")
    .map((entry) => normalizeWallet(entry.wallet))
    .includes(wallet);
}
