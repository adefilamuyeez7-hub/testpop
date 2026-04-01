type CampaignArchitectureCardProps = {
  className?: string;
};

const liveNowItems = [
  "Campaign rows, timelines, and visibility are stored in the app database.",
  "ETH entries create POAP credits in the app flow.",
  "Content submissions are reviewed by the artist, then approved entries become POAP credits.",
  "Collectors redeem earned POAP credits 24 hours after campaign close.",
];

const onchainNextItems = [
  "Campaign creation and timing rules move into a dedicated V2 contract.",
  "ETH entry credits are recorded onchain per wallet.",
  "Artist approval writes content credits onchain through an operator flow.",
  "POAP redemption mints from the contract using the wallet's earned credit balance.",
];

export function CampaignArchitectureCard({ className }: CampaignArchitectureCardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 space-y-4 ${className ?? ""}`.trim()}>
      <div>
        <p className="text-sm font-semibold text-foreground">Campaign System Map</p>
        <p className="text-xs text-muted-foreground mt-1">
          Campaigns are hybrid right now so the product flow works today, while the trust-critical credit and redemption pieces are the next onchain upgrade.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Live Now</p>
        <div className="space-y-2">
          {liveNowItems.map((item) => (
            <div key={item} className="rounded-xl bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Move Onchain Next</p>
        <div className="space-y-2">
          {onchainNextItems.map((item) => (
            <div key={item} className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
