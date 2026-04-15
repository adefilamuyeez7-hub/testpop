import { ethers } from "ethers";
import { supabase, POAP_CAMPAIGN_V2_ADDRESS, DEPLOYER_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL } from "./config.js";
import { sameWalletOrAdmin } from "./auth.js";

// Campaign-related constants and utilities
const POAP_CAMPAIGN_V2_ABI = [
  "function grantContentCredits(uint256 campaignId, address wallet, uint256 quantity)",
  "function revokeContentCredits(uint256 campaignId, address wallet, uint256 quantity)",
  "function campaigns(uint256 campaignId) view returns (address artist, string metadataURI, uint8 entryMode, uint8 status, uint256 maxSupply, uint256 minted, uint256 ticketPriceWei, uint64 startTime, uint64 endTime, uint64 redeemStartTime)",
];

let campaignSubmissionsTableReady = null;
let campaignSigner = null;
let campaignProvider = null;

function getCampaignSigner() {
  if (campaignSigner) return campaignSigner;
  if (!DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not configured");
  campaignProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  campaignSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, campaignProvider);
  return campaignSigner;
}

function getCampaignProvider() {
  if (campaignProvider) return campaignProvider;
  campaignProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  return campaignProvider;
}

async function ensureCampaignSubmissionsTableReady() {
  if (campaignSubmissionsTableReady !== null) {
    return campaignSubmissionsTableReady;
  }

  try {
    const { data, error } = await supabase
      .from("campaign_submissions")
      .select("id")
      .limit(1);

    if (error && !isMissingCampaignSubmissionTableError(error)) {
      throw error;
    }

    campaignSubmissionsTableReady = !error;
    return campaignSubmissionsTableReady;
  } catch (error) {
    campaignSubmissionsTableReady = false;
    throw new Error(`Unable to verify campaign submissions table: ${error.message}`);
  }
}

function isMissingCampaignSubmissionTableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("relation") && message.includes("campaign_submissions") ||
    message.includes("does not exist") && message.includes("campaign_submissions")
  );
}

async function findCampaignDropById(dropId) {
  const { data, error } = await supabase
    .from("drops")
    .select("id, artist_id, title, type, status, ends_at, artists!inner(wallet)")
    .eq("id", dropId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getCampaignWindow(drop) {
  if (drop?.contract_address && drop?.contract_drop_id !== null && drop?.contract_drop_id !== undefined) {
    try {
      const contract = new ethers.Contract(drop.contract_address, POAP_CAMPAIGN_V2_ABI, getCampaignProvider());
      const campaign = await contract.campaigns(BigInt(drop.contract_drop_id));
      return {
        startTime: Number(campaign.startTime ?? 0n),
        endTime: Number(campaign.endTime ?? 0n),
        redeemStartTime: Number(campaign.redeemStartTime ?? 0n),
      };
    } catch (error) {
      console.warn("Failed to fetch campaign window from contract:", error);
      return null;
    }
  }
  return null;
}

// Campaign routes
const campaignRoutes = (app, authRequired) => {
  // Create campaign submission
  app.post("/campaigns/submissions", authRequired, async (req, res) => {
    try {
      const tableReady = await ensureCampaignSubmissionsTableReady();
      if (!tableReady) {
        return res.status(503).json({
          error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
        });
      }

      const dropId = req.body?.dropId;
      const contentUrl = req.body?.contentUrl?.trim() || null;
      const caption = req.body?.caption?.trim() || null;

      if (!dropId) {
        return res.status(400).json({ error: "dropId is required" });
      }

      if (!contentUrl && !caption) {
        return res.status(400).json({ error: "contentUrl or caption is required" });
      }

      const drop = await findCampaignDropById(dropId);
      if (drop.type !== "campaign") {
        return res.status(400).json({ error: "Submissions are only supported for campaign drops" });
      }

      const campaignWindow = await getCampaignWindow(drop);
      const now = Math.floor(Date.now() / 1000);
      if (
        campaignWindow.startTime &&
        campaignWindow.endTime &&
        (now < campaignWindow.startTime || now > campaignWindow.endTime)
      ) {
        return res.status(400).json({ error: "Campaign submissions are only accepted during the live campaign window." });
      }

      const { data, error } = await supabase
        .from("campaign_submissions")
        .insert({
          drop_id: dropId,
          submitter_wallet: req.auth.wallet,
          content_url: contentUrl,
          caption,
          status: "pending",
        })
        .select("*")
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to submit campaign content" });
    }
  });

  // List campaign submissions
  app.get("/campaigns/:dropId/submissions", authRequired, async (req, res) => {
    try {
      const tableReady = await ensureCampaignSubmissionsTableReady();
      if (!tableReady) {
        return res.status(503).json({
          error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
        });
      }

      const dropId = req.params.dropId;
      const scope = String(req.query.scope || "").toLowerCase();
      const drop = await findCampaignDropById(dropId);

      let query = supabase
        .from("campaign_submissions")
        .select("*")
        .eq("drop_id", dropId)
        .order("created_at", { ascending: false });

      if (scope === "mine") {
        query = query.eq("submitter_wallet", req.auth.wallet);
      } else {
        const ownerWallet = drop.artists?.wallet;
        if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
          return res.status(403).json({ error: "Artist or admin access required" });
        }
      }

      const { data, error } = await query;
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json(data || []);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch campaign submissions" });
    }
  });

  // Review campaign submission
  app.patch("/campaigns/:dropId/submissions/:submissionId/review", authRequired, async (req, res) => {
    try {
      const tableReady = await ensureCampaignSubmissionsTableReady();
      if (!tableReady) {
        return res.status(503).json({
          error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
        });
      }

      const { dropId, submissionId } = req.params;
      const { status } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }

      const drop = await findCampaignDropById(dropId);
      const ownerWallet = drop.artists?.wallet;
      if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
        return res.status(403).json({ error: "Artist or admin access required" });
      }

      // Update submission status
      const { data: updated, error: updateError } = await supabase
        .from("campaign_submissions")
        .update({ status })
        .eq("id", submissionId)
        .eq("drop_id", dropId)
        .select("*")
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      // If approved, grant content credits on-chain
      if (status === "approved" && drop.contract_address && drop.contract_drop_id !== null) {
        try {
          const signer = getCampaignSigner();
          const contract = new ethers.Contract(drop.contract_address, POAP_CAMPAIGN_V2_ABI, signer);

          const tx = await contract.grantContentCredits(
            BigInt(drop.contract_drop_id),
            updated.submitter_wallet,
            1n
          );
          await tx.wait();

          console.log(`Granted content credit to ${updated.submitter_wallet} for campaign ${drop.contract_drop_id}`);
        } catch (contractError) {
          console.error("Failed to grant content credits:", contractError);
          // Don't fail the request, just log the error
        }
      }

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to review campaign submission" });
    }
  });
};

export {
  ensureCampaignSubmissionsTableReady,
  findCampaignDropById,
  getCampaignWindow,
  campaignRoutes,
};