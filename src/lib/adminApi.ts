/**
 * Admin API Hooks
 *
 * Hooks for admin-only operations like approving artists and managing whitelist.
 */

import { useCallback, useState } from "react";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { SECURE_API_BASE } from "@/lib/apiBase";

const API_BASE = SECURE_API_BASE;

function getAuthHeaders() {
  const headers = new Headers();
  const token = getRuntimeApiToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export interface ApprovalResponse {
  success: boolean;
  warning?: string | null;
  artist: {
    id: string;
    wallet: string;
    name: string;
    contract_address?: string;
    whitelisted_at?: string;
  };
  deployment?: {
    status: "deployed" | "pending" | "failed";
    address?: string;
    tx?: string;
    error?: string;
  };
}

export interface RejectArtistResponse {
  success: boolean;
  artist: {
    id: string;
    wallet: string;
    name: string;
    contract_address?: string;
    whitelisted_at?: string;
  };
  rejection?: {
    reason?: string;
    rejectedAt?: string;
  };
}

export function useApproveArtist() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async (
    wallet: string,
    approveArtist: boolean = true,
    deployContract: boolean = true
  ): Promise<ApprovalResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!API_BASE) {
        throw new Error("Admin API is not configured. Set VITE_SECURE_API_BASE_URL in Vercel.");
      }

      const headers = getAuthHeaders();
      headers.set("Content-Type", "application/json");

      const response = await fetch(`${API_BASE}/admin/approve-artist`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          wallet,
          approve: approveArtist,
          deployContract,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Approval failed");
      }

      return (await response.json()) as ApprovalResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Approval error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { approve, isLoading, error };
}

export function useRejectArtist() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reject = async (wallet: string, reason = ""): Promise<RejectArtistResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!API_BASE) {
        throw new Error("Admin API is not configured. Set VITE_SECURE_API_BASE_URL in Vercel.");
      }

      const headers = getAuthHeaders();
      headers.set("Content-Type", "application/json");

      const response = await fetch(`${API_BASE}/admin/reject-artist`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ wallet, reason }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Rejection failed");
      }

      return (await response.json()) as RejectArtistResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Reject error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { reject, isLoading, error };
}

export interface AdminArtistsResponse {
  artists: Array<{
    id: string;
    wallet: string;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    status_updated_at?: string;
    artists?: {
      id: string;
      name: string;
      avatar?: string;
      bio?: string;
      contract_address?: string;
    };
  }>;
  total: number;
}

export function useAdminArtists(status?: "pending" | "approved" | "rejected") {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminArtistsResponse | null>(null);

  const fetch_artists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!API_BASE) {
        throw new Error("Admin API is not configured. Set VITE_SECURE_API_BASE_URL in Vercel.");
      }

      const params = new URLSearchParams();
      if (status) params.append("status", status);

      const response = await fetch(`${API_BASE}/admin/artists?${params}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to fetch artists");
      }

      const result = (await response.json()) as AdminArtistsResponse;
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Fetch error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  return { fetch_artists, data, isLoading, error };
}
