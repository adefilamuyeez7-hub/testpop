/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Gift, Loader2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useContracts";
import { useSupabaseAllDrops } from "@/hooks/useSupabase";
import { useCampaignV2State, useRedeemCampaignV2 } from "@/hooks/useCampaignV2";
import { trackPOAPsView } from "@/lib/analyticsStore";
import { establishSecureSession } from "@/lib/secureAuth";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import {
  getCampaignSubmissions,
  type CampaignSubmission,
} from "@/lib/db";

function formatRedeemCountdown(targetUnixSeconds: number): string {
  const diffMs = targetUnixSeconds * 1000 - Date.now();
  if (diffMs <= 0) return "Open now";
  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (totalHours < 24) return `${totalHours}h`;
  return `${Math.ceil(totalHours / 24)}d`;
}

function CampaignCreditCard({
  drop,
  wallet,
  submissions,
  hasSubmissionHistory,
}: {
  drop: any;
  wallet: string;
  submissions: CampaignSubmission[];
  hasSubmissionHistory: boolean;
}) {
  const {
    campaign,
    ethCredits,
    contentCredits,
    redeemedCredits,
    redeemableCredits,
    isLoading,
  } = useCampaignV2State(drop.contract_drop_id, wallet, drop.contract_address);
  const { redeem, isPending, isConfirming } = useRedeemCampaignV2();

  const hasOnchainCampaign = drop.contract_drop_id !== null && drop.contract_drop_id !== undefined;
  const approvedSubmissions = submissions.filter((submission) => submission.status === "approved").length;
  const pendingSubmissions = submissions.filter((submission) => submission.status === "pending").length;
  const rejectedSubmissions = submissions.filter((submission) => submission.status === "rejected").length;
  const totalCredits = ethCredits + contentCredits;

  if (!isLoading && totalCredits === 0 && redeemedCredits === 0 && submissions.length === 0) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const status = !hasOnchainCampaign
    ? approvedSubmissions > 0
      ? "syncing"
      : pendingSubmissions > 0
        ? "under review"
        : "unavailable"
    : !campaign
      ? "syncing"
      : now < campaign.startTime
        ? "upcoming"
        : now <= campaign.endTime
          ? "live"
          : now < campaign.redeemStartTime
            ? "cooldown"
            : "redeemable";

  const contentSyncGap = Math.max(0, approvedSubmissions - contentCredits);
  const canRedeem = hasOnchainCampaign && status === "redeemable" && redeemableCredits > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{drop.title}</p>
            <Badge variant="outline" className="text-[10px] capitalize">
              {status}
            </Badge>
          </div>

          {isLoading ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading campaign credits...
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalCredits} onchain credits | {ethCredits} ETH | {contentCredits} content
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {redeemedCredits} redeemed | {redeemableCredits} redeemable now
              </p>

              {hasSubmissionHistory && submissions.length > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pendingSubmissions} pending | {approvedSubmissions} approved | {rejectedSubmissions} rejected
                </p>
              ) : null}

              {contentSyncGap > 0 ? (
                <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-foreground">
                  {contentSyncGap} approved {contentSyncGap === 1 ? "submission is" : "submissions are"} not reflected
                  in onchain content credits yet.
                </div>
              ) : null}

              {!hasOnchainCampaign && approvedSubmissions > 0 ? (
                <div className="mt-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 text-xs text-muted-foreground">
                  Approval was recorded in the app, but this campaign is still missing its onchain campaign ID.
                </div>
              ) : !hasOnchainCampaign && pendingSubmissions > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Submission sent. Waiting for artist review.
                </p>
              ) : canRedeem ? (
                <Button
                  onClick={() => redeem(drop.contract_address, drop.contract_drop_id, redeemableCredits)}
                  disabled={isPending || isConfirming}
                  className="mt-2 h-8 w-full rounded-lg text-xs gradient-primary"
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Redeem {redeemableCredits} {redeemableCredits === 1 ? "POAP" : "POAPs"}
                </Button>
              ) : status === "cooldown" && campaign ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                  <Clock3 className="h-3.5 w-3.5" />
                  Redeem opens in {formatRedeemCountdown(campaign.redeemStartTime)}
                </p>
              ) : status === "live" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Campaign is still live. Redemption starts 24 hours after close.
                </p>
              ) : status === "upcoming" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Campaign has not started yet.
                </p>
              ) : status === "syncing" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Campaign approvals are waiting to sync with onchain credits.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No unredeemed credits left for this campaign.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type MyPOAPsPageProps = {
  embedded?: boolean;
};

const MyPOAPsPage = ({ embedded = false }: MyPOAPsPageProps) => {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const { data: allDrops } = useSupabaseAllDrops(Boolean(address));
  const [submissionsByDropId, setSubmissionsByDropId] = useState<Record<string, CampaignSubmission[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const hasApiSession = Boolean(getRuntimeApiToken());

  useEffect(() => {
    if (isConnected && address) {
      trackPOAPsView(address);
    }
  }, [isConnected, address]);

  const campaignDrops = useMemo(
    () => (allDrops || []).filter((drop) => (drop.type || "").toLowerCase() === "campaign"),
    [allDrops]
  );

  useEffect(() => {
    if (!isConnected || !address || campaignDrops.length === 0 || !hasApiSession) {
      setLoadingSubmissions(false);
      setSubmissionsByDropId({});
      return;
    }

    let cancelled = false;
    setLoadingSubmissions(true);

    Promise.all(
      campaignDrops.map(async (drop) => [drop.id, await getCampaignSubmissions(drop.id, "mine")] as const)
    )
      .then((entries) => {
        if (!cancelled) {
          setSubmissionsByDropId(Object.fromEntries(entries));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load campaign participation history:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, campaignDrops, hasApiSession, isConnected]);

  const visibleCampaignDrops = useMemo(
    () =>
      campaignDrops.filter((drop) => {
        const submissions = submissionsByDropId[drop.id] || [];
        return (
          drop.contract_drop_id !== null &&
          drop.contract_drop_id !== undefined
        ) || submissions.length > 0;
      }),
    [campaignDrops, submissionsByDropId]
  );

  const handleUnlockParticipationHistory = async () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to unlock campaign history.");
      return;
    }

    setUnlocking(true);
    try {
      await establishSecureSession(address);
      const entries = await Promise.all(
        campaignDrops.map(async (drop) => [drop.id, await getCampaignSubmissions(drop.id, "mine")] as const)
      );
      setSubmissionsByDropId(Object.fromEntries(entries));
      toast.success("Campaign participation history unlocked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to unlock campaign history.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="space-y-4 px-4 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground">Connect to see your POAP rewards</p>
        {!embedded && (
          <Button onClick={() => navigate(-1)} className="rounded-full gradient-primary text-primary-foreground">
            Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${embedded ? "pb-6" : "pb-20"}`}>
      {!embedded && (
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 pb-2 pt-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-secondary/50 p-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">My POAP Rewards</h1>
            <p className="text-xs text-muted-foreground">
              Track approval, onchain credit sync, and redemption in one place
            </p>
          </div>
        </div>
      )}

      {!hasApiSession && campaignDrops.length > 0 && (
        <div className="px-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
            <p>Sign once to load approved content submissions alongside your onchain POAP credits.</p>
            <Button
              onClick={handleUnlockParticipationHistory}
              disabled={unlocking}
              size="sm"
              className="mt-3 rounded-xl"
            >
              {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Unlock Participation History
            </Button>
          </div>
        </div>
      )}

      {loadingSubmissions && hasApiSession && (
        <div className="px-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaign approvals and submission history...
          </div>
        </div>
      )}

      {visibleCampaignDrops.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Gift className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-body text-sm text-muted-foreground">No campaign rewards yet.</p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            Join a campaign through ETH entry or an approved content submission.
          </p>
        </div>
      ) : (
        <div className="space-y-2 px-4">
          <p className="text-xs font-semibold text-foreground">Campaign Reward Pipeline</p>
          {visibleCampaignDrops.map((drop) => (
            <CampaignCreditCard
              key={drop.id}
              drop={drop}
              wallet={address}
              submissions={submissionsByDropId[drop.id] || []}
              hasSubmissionHistory={hasApiSession}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPOAPsPage;
