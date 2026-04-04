import { useEffect, useMemo, useState } from "react";
import { Clock, Gift, Loader2, Send } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCampaignSubmissions,
  submitCampaignContent,
} from "@/lib/db";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { establishSecureSession } from "@/lib/secureAuth";
import {
  useBuyCampaignEntriesV2,
  useCampaignV2State,
  useRedeemCampaignV2,
} from "@/hooks/useCampaignV2";
import { useWallet } from "@/hooks/useContracts";
import { ACTIVE_CHAIN } from "@/lib/wagmi";

type CampaignActionPanelProps = {
  dropId: string;
  fallbackTitle: string;
  fallbackPriceEth?: string;
  contractCampaignId?: number | null;
  contractAddress?: string | null;
  campaignMetadata?: Record<string, unknown> | null;
};

type CampaignDisplayState = {
  entryMode: number;
  startTime: number;
  endTime: number;
  redeemStartTime: number;
  ticketPriceWei?: bigint;
};

function formatTimeDistance(targetMs: number): string {
  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return "now";
  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (totalHours < 24) return `${totalHours}h`;
  return `${Math.ceil(totalHours / 24)}d`;
}

function getCampaignDisplayStatus(campaign: {
  startTime: number;
  endTime: number;
  redeemStartTime: number;
} | null) {
  if (!campaign) return "unavailable";
  const now = Math.floor(Date.now() / 1000);
  if (campaign.startTime && now < campaign.startTime) return "upcoming";
  if (!campaign.endTime || now <= campaign.endTime) return "live";
  if (campaign.redeemStartTime && now < campaign.redeemStartTime) return "cooldown";
  return "redeemable";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readCampaignWindowValue(
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  const campaignWindow = toRecord(metadata?.campaign_window);
  for (const key of keys) {
    const value = campaignWindow?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function parseEntryMode(value: unknown): 0 | 1 | 2 | null {
  if (typeof value === "number" && [0, 1, 2].includes(value)) {
    return value as 0 | 1 | 2;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "0" || normalized === "eth") return 0;
    if (normalized === "1" || normalized === "content") return 1;
    if (normalized === "2" || normalized === "both") return 2;
  }

  return null;
}

function parseTimestamp(value: string) {
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric > 1_000_000_000_000 ? Math.floor(numeric / 1000) : numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function buildFallbackCampaign(metadata?: Record<string, unknown> | null): CampaignDisplayState | null {
  const campaignWindow = toRecord(metadata?.campaign_window);
  if (!campaignWindow) return null;

  const entryMode = parseEntryMode(
    campaignWindow.entry_mode ?? campaignWindow.entryMode ?? metadata?.entry_mode ?? metadata?.entryMode
  );
  const startTime = parseTimestamp(readCampaignWindowValue(metadata, "start_at", "startAt"));
  const endTime = parseTimestamp(readCampaignWindowValue(metadata, "end_at", "endAt"));
  const redeemStartTime = parseTimestamp(readCampaignWindowValue(metadata, "redeem_at", "redeemAt"));

  if (entryMode === null && startTime === null && endTime === null && redeemStartTime === null) {
    return null;
  }

  return {
    entryMode: entryMode ?? 2,
    startTime: startTime ?? 0,
    endTime: endTime ?? 0,
    redeemStartTime: redeemStartTime ?? endTime ?? 0,
  };
}

function formatCampaignDate(timestampSeconds?: number) {
  if (!timestampSeconds) return "--";
  return new Date(timestampSeconds * 1000).toLocaleString();
}

export function CampaignActionPanel({
  dropId,
  fallbackTitle,
  fallbackPriceEth = "0",
  contractCampaignId,
  contractAddress,
  campaignMetadata,
}: CampaignActionPanelProps) {
  const {
    address,
    isConnected,
    connectWallet,
    chain,
    requestActiveChainSwitch,
    isSwitchingNetwork,
  } = useWallet();
  const [entryQuantity, setEntryQuantity] = useState("1");
  const [contentUrl, setContentUrl] = useState("");
  const [contentCaption, setContentCaption] = useState("");
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState<
    Awaited<ReturnType<typeof getCampaignSubmissions>>
  >([]);

  const {
    campaign,
    ethCredits,
    contentCredits,
    redeemedCredits,
    redeemableCredits,
    isLoading,
    refetchAll,
  } = useCampaignV2State(contractCampaignId, address, contractAddress);

  const {
    buyEntries,
    isPending: isBuyPending,
    isConfirming: isBuyConfirming,
    isSuccess: isBuySuccess,
    error: buyError,
  } = useBuyCampaignEntriesV2();

  const {
    redeem,
    isPending: isRedeemPending,
    isConfirming: isRedeemConfirming,
    isSuccess: isRedeemSuccess,
    error: redeemError,
  } = useRedeemCampaignV2();

  const hasContractCampaignId = contractCampaignId !== null && contractCampaignId !== undefined;
  const fallbackCampaign = useMemo(() => buildFallbackCampaign(campaignMetadata), [campaignMetadata]);
  const displayCampaign = campaign ?? fallbackCampaign;
  const hasOnchainCampaign = Boolean(campaign);
  const status = getCampaignDisplayStatus(displayCampaign);
  const supportsEthEntries = displayCampaign?.entryMode === 0 || displayCampaign?.entryMode === 2;
  const supportsContentEntries = displayCampaign?.entryMode === 1 || displayCampaign?.entryMode === 2;
  const entryModeLabel =
    displayCampaign?.entryMode === 1 ? "content" : displayCampaign?.entryMode === 2 ? "both" : "eth";
  const ticketPriceEth = campaign?.ticketPriceWei ? formatEther(campaign.ticketPriceWei) : fallbackPriceEth;
  const pendingSubmissions = userSubmissions.filter((submission) => submission.status === "pending").length;
  const approvedSubmissions = userSubmissions.filter((submission) => submission.status === "approved").length;
  const rejectedSubmissions = userSubmissions.filter((submission) => submission.status === "rejected").length;
  const hasApiSession = Boolean(getRuntimeApiToken());
  const canSubmitContent = supportsContentEntries && status === "live";
  const canBuyEntries = supportsEthEntries && status === "live" && hasContractCampaignId;
  const canRedeem = status === "redeemable" && hasContractCampaignId;

  useEffect(() => {
    if (!address || !dropId) {
      setUserSubmissions([]);
      return;
    }

    let cancelled = false;
    if (!getRuntimeApiToken()) {
      setUserSubmissions([]);
      return;
    }

    setSubmissionLoading(true);
    getCampaignSubmissions(dropId, "mine")
      .then((submissions) => {
        if (!cancelled) {
          setUserSubmissions(submissions);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load campaign submissions:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSubmissionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, dropId, isBuySuccess, isRedeemSuccess]);

  useEffect(() => {
    if (isBuySuccess || isRedeemSuccess) {
      refetchAll().catch((error) => {
        console.warn("Failed to refresh campaign state:", error);
      });
    }
  }, [isBuySuccess, isRedeemSuccess, refetchAll]);

  useEffect(() => {
    if (buyError) {
      toast.error(buyError.message || "Failed to buy campaign entries.");
    }
  }, [buyError]);

  useEffect(() => {
    if (isBuySuccess) {
      toast.success("Campaign entries purchased successfully.");
    }
  }, [isBuySuccess]);

  useEffect(() => {
    if (redeemError) {
      toast.error(redeemError.message || "Failed to redeem campaign rewards.");
    }
  }, [redeemError]);

  useEffect(() => {
    if (isRedeemSuccess) {
      toast.success("Campaign rewards redeemed successfully.");
    }
  }, [isRedeemSuccess]);

  const summary = useMemo(
    () => ({
      totalCredits: ethCredits + contentCredits,
      approvedContent: contentCredits,
      ethEntries: ethCredits,
      redeemedCredits,
      redeemableCredits,
    }),
    [contentCredits, ethCredits, redeemedCredits, redeemableCredits]
  );

  const quantity = Math.max(1, Number.parseInt(entryQuantity, 10) || 1);

  const handleBuyEntry = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (chain?.id !== ACTIVE_CHAIN.id) {
      try {
        await requestActiveChainSwitch(`Buying campaign entries requires ${ACTIVE_CHAIN.name}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Switch to ${ACTIVE_CHAIN.name} and try again.`);
      }
      return;
    }
    if (!hasContractCampaignId) {
      toast.error("This campaign is still syncing its onchain ID.");
      return;
    }

    buyEntries(contractAddress, contractCampaignId, quantity, ticketPriceEth);
  };

  const handleSubmitContent = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!address) {
      toast.error("Connect your wallet to submit content.");
      return;
    }
    if (!contentUrl.trim()) {
      toast.error("Add a content URL before submitting.");
      return;
    }

    setSubmissionLoading(true);
    try {
      await establishSecureSession(address);
      await submitCampaignContent({
        dropId,
        contentUrl: contentUrl.trim(),
        caption: contentCaption.trim(),
      });
      const nextSubmissions = await getCampaignSubmissions(dropId, "mine");
      setUserSubmissions(nextSubmissions);
      setContentUrl("");
      setContentCaption("");
      toast.success("Content submitted for artist review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit campaign content.");
    } finally {
      setSubmissionLoading(false);
    }
  };

  const handleUnlockSubmissionTools = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (!address) {
      toast.error("Connect your wallet to unlock submission tools.");
      return;
    }
    setUnlocking(true);
    try {
      await establishSecureSession(address);
      const nextSubmissions = await getCampaignSubmissions(dropId, "mine");
      setUserSubmissions(nextSubmissions);
      toast.success("Campaign submission tools unlocked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to unlock campaign tools.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleRedeem = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (chain?.id !== ACTIVE_CHAIN.id) {
      try {
        await requestActiveChainSwitch(`Redeeming campaign rewards requires ${ACTIVE_CHAIN.name}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Switch to ${ACTIVE_CHAIN.name} and try again.`);
      }
      return;
    }
    if (!summary.redeemableCredits) {
      toast.error("No redeemable credits are available for this wallet.");
      return;
    }
    if (!hasContractCampaignId) {
      toast.error("This campaign is still syncing its onchain ID.");
      return;
    }

    redeem(contractAddress, contractCampaignId, summary.redeemableCredits);
  };

  return (
    <div className="space-y-3">
      {!hasOnchainCampaign && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
          Campaign actions for {fallbackTitle} are using the saved campaign setup while onchain reads finish syncing.
        </div>
      )}

      {!hasContractCampaignId && (
        <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          Onchain purchase and redemption are still syncing, but app-based participation is available below.
        </div>
      )}

      <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center justify-between">
          <span>Status</span>
          <span className="font-semibold text-foreground capitalize">{status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Entry mode</span>
          <span className="font-semibold text-foreground capitalize">{entryModeLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Campaign opens</span>
          <span className="font-semibold text-foreground">{formatCampaignDate(displayCampaign?.startTime)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Campaign closes</span>
          <span className="font-semibold text-foreground">{formatCampaignDate(displayCampaign?.endTime)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Redemption opens</span>
          <span className="font-semibold text-foreground">{formatCampaignDate(displayCampaign?.redeemStartTime)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Your ETH entries</span>
          <span className="font-semibold text-foreground">{summary.ethEntries}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Your approved content</span>
          <span className="font-semibold text-foreground">{summary.approvedContent}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Total credits</span>
          <span className="font-semibold text-foreground">{summary.totalCredits}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Redeemed</span>
          <span className="font-semibold text-foreground">{summary.redeemedCredits}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Redeemable now</span>
          <span className="font-semibold text-primary">{summary.redeemableCredits}</span>
        </div>
      </div>

      {supportsEthEntries && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">Buy ETH participation</p>
          <p className="text-xs text-muted-foreground">
            Each ETH entry creates one POAP credit. Redemption happens 24 hours after the campaign closes.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              value={entryQuantity}
              onChange={(event) => setEntryQuantity(event.target.value)}
              className="h-10 rounded-xl"
            />
            <Button
              onClick={handleBuyEntry}
              disabled={!canBuyEntries || isLoading || isBuyPending || isBuyConfirming || isSwitchingNetwork}
              className="rounded-xl gradient-primary text-primary-foreground"
            >
              {isBuyPending || isBuyConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Buy ${ticketPriceEth} ETH`
              )}
            </Button>
          </div>
          {!hasContractCampaignId && (
            <p className="text-xs text-muted-foreground">
              ETH entry checkout will unlock once the campaign ID finishes syncing.
            </p>
          )}
          {status === "upcoming" && (
            <p className="text-xs text-muted-foreground">ETH participation opens when the campaign starts.</p>
          )}
          {status !== "live" && status !== "upcoming" && (
            <p className="text-xs text-muted-foreground">ETH participation is closed for this campaign window.</p>
          )}
        </div>
      )}

      {supportsContentEntries && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">Submit content</p>
          <p className="text-xs text-muted-foreground">
            One approved submission creates one POAP credit. After approval, come back and redeem after the 24-hour lock.
          </p>

          {status === "upcoming" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              Submissions open when the campaign goes live.
            </div>
          )}

          {status !== "live" && status !== "upcoming" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              The submission window is closed, but you can still review your participation history below.
            </div>
          )}

          {!hasApiSession && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              Sign once to submit content and view your submission approval status.
              <Button
                onClick={handleUnlockSubmissionTools}
                disabled={unlocking}
                size="sm"
                variant="outline"
                className="mt-3 w-full rounded-xl"
              >
                {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Unlock Submission Tools
              </Button>
            </div>
          )}

          <Input
            value={contentUrl}
            onChange={(event) => setContentUrl(event.target.value)}
            placeholder="Link to your content submission"
            className="h-10 rounded-xl"
            disabled={!hasApiSession || !canSubmitContent}
          />

          <textarea
            value={contentCaption}
            onChange={(event) => setContentCaption(event.target.value)}
            placeholder="Short note for the artist"
            className="min-h-[96px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            disabled={!hasApiSession || !canSubmitContent}
          />

          <Button
            onClick={handleSubmitContent}
            disabled={submissionLoading || !hasApiSession || !canSubmitContent}
            variant="outline"
            className="w-full rounded-xl"
          >
            {submissionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit for approval
          </Button>

          {(pendingSubmissions > 0 || approvedSubmissions > 0 || rejectedSubmissions > 0) && (
            <div className="rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground space-y-2">
              <p>
                {pendingSubmissions} pending · {approvedSubmissions} approved · {rejectedSubmissions} rejected
              </p>
              <div className="space-y-2">
                {userSubmissions.slice(0, 3).map((submission) => (
                  <div key={submission.id} className="rounded-xl border border-border bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-foreground">
                        {submission.content_url || "Submission"}
                      </span>
                      <span className="capitalize">{submission.status}</span>
                    </div>
                    {submission.caption ? <p className="mt-1 text-muted-foreground">{submission.caption}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === "cooldown" && displayCampaign && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Redemption opens in {formatTimeDistance(displayCampaign.redeemStartTime * 1000)}.
        </div>
      )}

      {status === "redeemable" && summary.redeemableCredits > 0 && (
        <Button
          onClick={handleRedeem}
          disabled={!canRedeem || isRedeemPending || isRedeemConfirming || isSwitchingNetwork}
          className="w-full rounded-xl gradient-primary text-primary-foreground h-11"
        >
          {isRedeemPending || isRedeemConfirming ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Gift className="mr-2 h-4 w-4" />
          )}
          Redeem {summary.redeemableCredits}{" "}
          {summary.redeemableCredits === 1 ? "POAP" : "POAPs"}
        </Button>
      )}

      {status === "redeemable" && summary.redeemableCredits === 0 && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
          No POAP credits are ready to redeem for this wallet yet.
        </div>
      )}
    </div>
  );
}
