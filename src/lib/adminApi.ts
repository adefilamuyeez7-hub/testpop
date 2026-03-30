/**
 * Admin API Hooks
 *
 * Hooks for admin-only operations like approving artists and managing whitelist.
 */

import { useState } from "react";
import { getRuntimeApiToken } from "@/lib/runtimeSession";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

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

      const data = (await response.json()) as ApprovalResponse;
      return data;
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

export interface AdminArtistsResponse {
  artists: Array<{
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

  const fetch_artists = async () => {
    setIsLoading(true);
    setError(null);

    try {
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
    } finally {
      setIsLoading(false);
    }
  };

  return { fetch_artists, data, isLoading, error };
}
