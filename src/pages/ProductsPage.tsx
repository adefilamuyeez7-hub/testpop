import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Coins, Search, Sparkles } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getIPCampaigns,
  getInvestorPositions,
  getRoyaltyDistributions,
  type IPCampaign,
  type RoyaltyDistribution,
} from "@/lib/db";
import { getRuntimeApiToken } from "@/lib/runtimeSession";

function formatEthAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.00";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatLabel(value?: string | null) {
  return String(value || "").replace(/_/g, " ").trim();
}

function getCampaignArtistName(campaign: IPCampaign) {
  return campaign.artists?.name || campaign.artists?.handle || "Creator";
}

function getCampaignCommittedAmount(campaign: IPCampaign) {
  return Number(campaign.metadata?.committed_amount_eth || 0);
}

function getCampaignProgress(campaign: IPCampaign) {
  const targetAmount = Number(campaign.funding_target_eth || 0);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return 0;
  return Math.min(100, (getCampaignCommittedAmount(campaign) / targetAmount) * 100);
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "target-high", label: "Target High" },
  { value: "unit-low", label: "Unit Low" },
  { value: "progress", label: "Progress" },
] as const;

export function ProductsPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const hasApiSession = Boolean(getRuntimeApiToken());

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");
  const [rightsFilter, setRightsFilter] = useState("all");
  const [campaigns, setCampaigns] = useState<IPCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [investorPositions, setInvestorPositions] = useState<Record<string, number>>({});
  const [royaltyDistributions, setRoyaltyDistributions] = useState<RoyaltyDistribution[]>([]);

  useEffect(() => {
    let isMounted = true;
    setCampaignsLoading(true);
    setMarketplaceError(null);

    getIPCampaigns()
      .then((data) => {
        if (isMounted) setCampaigns(data || []);
      })
      .catch((error) => {
        console.error("Failed to load marketplace campaigns:", error);
        if (isMounted) {
          setCampaigns([]);
          setMarketplaceError(error instanceof Error ? error.message : "Failed to load creator investment cards.");
        }
      })
      .finally(() => {
        if (isMounted) setCampaignsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!address || !hasApiSession) {
      setInvestorPositions({});
      setRoyaltyDistributions([]);
      return;
    }

    let isMounted = true;

    Promise.all([getInvestorPositions(address), getRoyaltyDistributions(address)])
      .then(([positions, distributions]) => {
        if (!isMounted) return;

        const nextPositions = (positions || []).reduce<Record<string, number>>((acc, position) => {
          acc[position.campaign_id] = (acc[position.campaign_id] || 0) + Number(position.units_purchased || 0);
          return acc;
        }, {});

        setInvestorPositions(nextPositions);
        setRoyaltyDistributions(distributions || []);
      })
      .catch((error) => {
          console.error("Failed to load investor data:", error);
        if (isMounted) {
          setInvestorPositions({});
          setRoyaltyDistributions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [address, hasApiSession]);

  const publicCampaigns = useMemo(
    () => campaigns.filter((campaign) => ["active", "funded", "settled", "closed"].includes(String(campaign.status || "").toLowerCase())),
    [campaigns]
  );
  const rightsOptions = useMemo(() => {
    const rights = new Set(publicCampaigns.map((campaign) => campaign.rights_type || "creative_ip"));
    return ["all", ...Array.from(rights).sort((left, right) => left.localeCompare(right))];
  }, [publicCampaigns]);
  const filteredCampaigns = useMemo(() => {
    let nextCampaigns = [...publicCampaigns];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (normalizedQuery) {
      nextCampaigns = nextCampaigns.filter((campaign) =>
        [campaign.title, campaign.summary, campaign.description, campaign.rights_type, campaign.campaign_type, getCampaignArtistName(campaign)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      );
    }

    if (rightsFilter !== "all") {
      nextCampaigns = nextCampaigns.filter((campaign) => (campaign.rights_type || "creative_ip") === rightsFilter);
    }

    switch (sortOrder) {
      case "target-high":
        nextCampaigns.sort((left, right) => Number(right.funding_target_eth || 0) - Number(left.funding_target_eth || 0));
        break;
      case "unit-low":
        nextCampaigns.sort((left, right) => Number(left.unit_price_eth || Number.MAX_SAFE_INTEGER) - Number(right.unit_price_eth || Number.MAX_SAFE_INTEGER));
        break;
      case "progress":
        nextCampaigns.sort((left, right) => getCampaignProgress(right) - getCampaignProgress(left));
        break;
      case "newest":
      default:
        nextCampaigns.sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime());
        break;
    }

    return nextCampaigns;
  }, [publicCampaigns, rightsFilter, searchQuery, sortOrder]);

  const featuredCampaign = filteredCampaigns[0] ?? publicCampaigns[0] ?? null;
  const totalOwnedUnits = useMemo(
    () => Object.values(investorPositions).reduce((sum, units) => sum + units, 0),
    [investorPositions]
  );
  const totalRevenueDistributed = useMemo(
    () => royaltyDistributions.reduce((sum, distribution) => sum + Number(distribution.net_amount_eth || 0), 0),
    [royaltyDistributions]
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f7fbff_0%,#e9f3ff_100%)] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.10)]">
          <div className="rounded-[1.8rem] bg-white/92 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Invest</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Discover creator IP raises, collectible proof-of-investment cards, and revenue-sharing positions in one board.
                </p>
              </div>

              <div className="relative min-w-[260px] flex-1 lg:max-w-md">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search creators, rights, campaigns..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 rounded-full border-black/8 bg-white pl-11 pr-4"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {rightsOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRightsFilter(option)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition-colors ${
                  rightsFilter === option ? "bg-[#dbeafe] text-foreground" : "bg-secondary/60 text-foreground"
                }`}
              >
                <span>{option === "all" ? "All rights" : formatLabel(option)}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {option === "all" ? publicCampaigns.length : publicCampaigns.filter((campaign) => (campaign.rights_type || "creative_ip") === option).length}
                </span>
              </button>
            ))}

            <div className="rounded-[1.5rem] border border-[#dbeafe] bg-[#f8fbff] p-4 text-sm text-muted-foreground">
              Approved creator IP cards live here, giving collectors a transferable position they can hold as raises progress and revenue gets distributed.
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] p-6">
              {featuredCampaign ? (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-foreground/60">Creator IP Card</p>
                    <h2 className="text-4xl font-black leading-tight text-foreground">{featuredCampaign.title}</h2>
                    <p className="text-lg font-semibold text-foreground/80">
                      {getCampaignArtistName(featuredCampaign)} · {formatLabel(featuredCampaign.campaign_type || "production_raise")}
                    </p>
                    <p className="max-w-2xl text-sm leading-7 text-foreground/70">
                      {featuredCampaign.summary || featuredCampaign.description || "Track creator raises, proof-of-investment positions, transferable units, and future revenue participation from one marketplace board."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-white/90 text-[#1d4ed8] hover:bg-white/90">
                        {formatLabel(featuredCampaign.rights_type || "creative_ip")}
                      </Badge>
                      <Badge variant="outline" className="border-white/70 bg-white/55 uppercase">
                        {featuredCampaign.status || "active"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => navigate(`/artists/${featuredCampaign.artist_id}`)} className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
                        Open creator
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/drops")} className="rounded-full bg-white/70">
                        Browse drops
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] bg-white/75 p-4 shadow-sm sm:col-span-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-[#1d4ed8]">Funding Progress</p>
                          <p className="mt-2 text-3xl font-black text-foreground">{getCampaignProgress(featuredCampaign).toFixed(0)}%</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatEthAmount(getCampaignCommittedAmount(featuredCampaign))} ETH committed of {formatEthAmount(Number(featuredCampaign.funding_target_eth || 0))} ETH
                          </p>
                        </div>
                        <Coins className="h-6 w-6 text-[#1d4ed8]" />
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-[#dbeafe]">
                        <div className="h-2 rounded-full bg-[#1d4ed8]" style={{ width: `${getCampaignProgress(featuredCampaign)}%` }} />
                      </div>
                    </div>

                    <div className="rounded-[1.4rem] bg-white/75 p-4 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[#1d4ed8]">Unit Price</p>
                      <p className="mt-2 text-2xl font-black text-foreground">{formatEthAmount(Number(featuredCampaign.unit_price_eth || 0))} ETH</p>
                    </div>
                    <div className="rounded-[1.4rem] bg-white/75 p-4 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[#1d4ed8]">Holder Rights</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {(investorPositions[featuredCampaign.id] || 0) > 0
                          ? "Your held units stay eligible for future distributions."
                          : "Held units can participate in future distributions."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.8rem] bg-white/75 p-8 text-center">
                  <Sparkles className="mx-auto mb-4 h-10 w-10 text-[#1d4ed8]" />
                  <p className="text-lg font-semibold text-foreground">No public creator cards are live yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">Approved raises will appear here as soon as creators open their marketplace listings.</p>
                </div>
              )}
            </section>

            <section className="hidden gap-3 md:grid md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Live Creator Cards</p>
                <p className="mt-2 text-2xl font-black text-foreground">{publicCampaigns.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Owned Units</p>
                <p className="mt-2 text-2xl font-black text-foreground">{hasApiSession ? totalOwnedUnits : "--"}</p>
              </div>
              <div className="rounded-[1.4rem] border border-[#dbeafe] bg-white/90 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Revenue Distributed</p>
                <p className="mt-2 text-2xl font-black text-foreground">{formatEthAmount(totalRevenueDistributed)} ETH</p>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as (typeof SORT_OPTIONS)[number]["value"])}
                className="h-11 rounded-full border border-black/8 bg-white px-4 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {rightsOptions.filter((option) => option !== "all").map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRightsFilter(option)}
                  className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    rightsFilter === option ? "bg-[#1d4ed8] text-white" : "bg-secondary/60 text-foreground"
                  }`}
                >
                  {formatLabel(option)}
                </button>
              ))}

              {rightsFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setRightsFilter("all")}
                  className="h-11 rounded-full bg-[#dbeafe] px-4 text-sm font-medium text-foreground"
                >
                  Clear filter
                </button>
              )}
            </div>

            {campaignsLoading ? (
              <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center text-muted-foreground">
                Loading creator IP cards...
              </div>
            ) : marketplaceError ? (
              <div className="rounded-[1.8rem] bg-secondary/50 px-6 py-16 text-center">
                <p className="mb-4 text-destructive">{marketplaceError}</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Retry
                </Button>
              </div>
            ) : filteredCampaigns.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredCampaigns.map((campaign) => {
                  const committedAmount = getCampaignCommittedAmount(campaign);
                  const progress = getCampaignProgress(campaign);
                  const ownedUnits = investorPositions[campaign.id] || 0;

                  return (
                    <article key={campaign.id} className="rounded-[1.7rem] border border-[#dbeafe] bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]">
                          {formatLabel(campaign.rights_type || "creative_ip")}
                        </Badge>
                        <Badge variant="outline" className="uppercase">
                          {campaign.status || "active"}
                        </Badge>
                        {ownedUnits > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Position held
                          </Badge>
                        )}
                      </div>

                      <h3 className="mt-4 text-xl font-black text-foreground">{campaign.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getCampaignArtistName(campaign)} · {formatLabel(campaign.campaign_type || "production_raise")}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {campaign.summary || campaign.description || "A creator-backed IP listing for funding, revenue participation, and transferable catalog upside."}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{formatEthAmount(Number(campaign.funding_target_eth || 0))}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Target</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{formatEthAmount(Number(campaign.unit_price_eth || 0))} ETH</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Unit</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fbff] px-3 py-3">
                          <p className="text-sm font-bold text-foreground">{ownedUnits || Number(campaign.total_units || 0)}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{ownedUnits > 0 ? "Owned" : "Units"}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatEthAmount(committedAmount)} ETH committed</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[#dbeafe]">
                          <div className="h-2 rounded-full bg-[#1d4ed8]" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <p className="mt-4 rounded-[1.2rem] bg-[#f8fbff] px-4 py-3 text-sm text-muted-foreground">
                        {ownedUnits > 0
                          ? "Your proof-of-investment position stays visible here so you can track creator progress and future revenue distributions."
                          : "Open the creator page to review terms, back the raise, and follow how the creator IP card evolves over time."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button onClick={() => navigate(`/artists/${campaign.artist_id}`)} className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
                          {ownedUnits > 0 ? "Manage position" : "Open creator"}
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/drops")} className="rounded-full">
                          Browse linked drops
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.8rem] border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-6 py-16 text-center">
                <Sparkles className="mx-auto mb-4 h-10 w-10 text-[#1d4ed8]" />
                <p className="text-lg font-semibold text-foreground">No creator cards match this view</p>
                <p className="mt-2 text-sm text-muted-foreground">Try a different rights filter or search term.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
