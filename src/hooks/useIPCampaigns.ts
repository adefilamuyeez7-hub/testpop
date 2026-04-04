import { useEffect, useState } from "react";
import { supabase, type IPCampaign } from "@/lib/db";

interface UseIPCampaignsOptions {
  artist_id?: string;
  status?: string;
  visibility?: string[];
  isAdmin?: boolean;
}

export function useIPCampaigns(options?: UseIPCampaignsOptions) {
  const [data, setData] = useState<IPCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from("ip_campaigns")
          .select("*, artists(id, wallet, name, handle, avatar_url)")
          .order("created_at", { ascending: false });

        // Filter by artist if provided
        if (options?.artist_id) {
          query = query.eq("artist_id", options.artist_id);
        }

        // Filter by status if provided
        if (options?.status) {
          query = query.eq("status", options.status);
        }

        // Filter by visibility if not admin
        if (!options?.isAdmin) {
          const visibilities = options?.visibility || ["listed", "unlisted"];
          const statuses = ["active", "funded", "settled", "closed"];

          query = query
            .in("visibility", visibilities)
            .in("status", statuses);
        }

        const { data: campaigns, error: err } = await query;

        if (err) throw err;
        setData((campaigns || []) as IPCampaign[]);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch campaigns");
        setError(error);
        console.error("Error fetching campaigns:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [options?.artist_id, options?.status, options?.visibility, options?.isAdmin]);

  return { data, loading, error };
}

export function useIPCampaign(campaignId: string | undefined) {
  const [data, setData] = useState<IPCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    const fetchCampaign = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: campaign, error: err } = await supabase
          .from("ip_campaigns")
          .select("*, artists(id, wallet, name, handle, avatar_url)")
          .eq("id", campaignId)
          .single();

        if (err) throw err;
        setData(campaign as IPCampaign);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch campaign");
        setError(error);
        console.error("Error fetching campaign:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  return { data, loading, error };
}

export function useIPCampaignInvestments(campaignId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    const fetchInvestments = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: investments, error: err } = await supabase
          .from("ip_investments")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false });

        if (err) throw err;
        setData((investments || []) as any[]);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch investments");
        setError(error);
        console.error("Error fetching investments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvestments();
  }, [campaignId]);

  return { data, loading, error };
}
