import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Award, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWallet, useCreateCampaign } from "@/hooks/useContracts";
import { POAP_CAMPAIGN_ADDRESS } from "@/lib/contracts/poapCampaign";
import { Web3Error } from "@/lib/types";
import { uploadMetadataToPinata } from "@/lib/pinata";

const campaignTypes = [
  { value: "Auction", label: "Auction", desc: "Random POAP to bidders" },
  { value: "Content", label: "Content", desc: "Raffle for fan submissions" },
  { value: "Subscriber", label: "Subscriber", desc: "Reward loyal fans" },
];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const isPoapCampaignConfigured = POAP_CAMPAIGN_ADDRESS !== ZERO_ADDRESS;
const campaignTypeValue = {
  Auction: 0,
  Content: 1,
  Subscriber: 2,
} as const;

const CreateCampaignDialog = () => {
  const { isConnected, connectWallet } = useWallet();
  const { createCampaign, isPending, isConfirming, isSuccess, error } = useCreateCampaign();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "Auction",
    totalPOAPs: "50",
    subscriberPct: 40,
    bidderPct: 35,
    creatorPct: 25,
  });

  // Auto-balance: when one slider moves, distribute the remainder evenly across the other two
  const handlePctChange = (changed: "subscriberPct" | "bidderPct" | "creatorPct", newVal: number) => {
    const others = (["subscriberPct", "bidderPct", "creatorPct"] as const).filter((k) => k !== changed);
    const remainder = 100 - newVal;
    const currentOtherSum = form[others[0]] + form[others[1]];

    let a: number;
    let b: number;
    if (currentOtherSum === 0) {
      a = Math.round(remainder / 2);
      b = remainder - a;
    } else {
      a = Math.round((form[others[0]] / currentOtherSum) * remainder);
      b = remainder - a;
    }

    setForm((prev) => ({
      ...prev,
      [changed]: newVal,
      [others[0]]: Math.max(0, a),
      [others[1]]: Math.max(0, b),
    }));
  };

  const handleCreate = async () => {
    if (isPoapCampaignConfigured && !isConnected) {
      connectWallet();
      return;
    }
    if (!form.title) {
      toast.error("Campaign title is required");
      return;
    }

    setIsUploading(true);
    try {
      toast.info("Pinning campaign metadata to IPFS…");
      const metadataUri = await uploadMetadataToPinata({
        name: form.title,
        type: form.type,
        totalPOAPs: Number(form.totalPOAPs),
        allocation: {
          subscribers: form.subscriberPct,
          bidders: form.bidderPct,
          creators: form.creatorPct,
        },
      });

      if (!isPoapCampaignConfigured) {
        toast.error("POAPCampaign contract address not configured. Cannot create campaign.");
        return;
      }

      createCampaign(
        metadataUri,
        campaignTypeValue[form.type as keyof typeof campaignTypeValue],
        Number(form.totalPOAPs),
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000 + 7 * 24 * 60 * 60),
        form.subscriberPct,
        form.bidderPct,
        form.creatorPct
      );
    } catch (err: any) {
      toast.error(err.message || "Metadata upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(0);
      setIsUploading(false);
      setIsCreated(false);
      setForm({ title: "", type: "Auction", totalPOAPs: "50", subscriberPct: 40, bidderPct: 35, creatorPct: 25 });
    }, 300);
  };

  useEffect(() => {
    if (isSuccess && !isCreated) {
      setIsCreated(true);
      toast.success("Campaign created! 🏆");
    }
  }, [isSuccess, isCreated]);

  const totalPct = form.subscriberPct + form.bidderPct + form.creatorPct;
  const isProcessing = isUploading || isPending || isConfirming;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">New Campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {step === 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Campaign Title</Label>
                <Input
                  placeholder="e.g. Summer Collection POAP"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-9 rounded-lg text-sm"
                />
              </div>

              <div>
                <Label className="text-xs mb-2 block">Campaign Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {campaignTypes.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm({ ...form, type: t.value })}
                      className={`p-3 rounded-xl border text-center transition-colors ${
                        form.type === t.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/50"
                      }`}
                    >
                      <p className="text-xs font-semibold text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground font-body mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Total POAPs to Issue</Label>
                <Input
                  placeholder="50"
                  value={form.totalPOAPs}
                  onChange={(e) => setForm({ ...form, totalPOAPs: e.target.value })}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-body">
                Adjust any slider — the others auto-balance to keep total at 100%.
              </p>

              {(
                [
                  { key: "subscriberPct" as const, label: "Subscribers", color: "bg-primary" },
                  { key: "bidderPct" as const, label: "Bidders", color: "bg-accent-foreground" },
                  { key: "creatorPct" as const, label: "Content Creators", color: "bg-warning" },
                ] as const
              ).map((tier) => (
                <div key={tier.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tier.label}</Label>
                    <span className="text-xs font-semibold text-foreground">{form[tier.key]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={form[tier.key]}
                    onChange={(e) => handlePctChange(tier.key, Number(e.target.value))}
                    className="w-full h-2 accent-primary"
                  />
                </div>
              ))}

              <div className={`text-center text-sm font-bold ${totalPct === 100 ? "text-primary" : "text-destructive"}`}>
                Total: {totalPct}%
              </div>

              <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm text-foreground">{form.title || "Untitled"}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">{form.type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{form.totalPOAPs} POAPs</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isPoapCampaignConfigured ? "Campaign will be created on-chain." : "Contract not configured - cannot create campaign."}
                </p>
              </div>

              {error && (
                <p className="text-xs text-destructive">
                  {(error as Web3Error).shortMessage || (error as Web3Error).message || "Transaction failed"}
                </p>
              )}

              {isCreated ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="font-bold text-foreground">Campaign Created!</p>
                  <p className="text-xs text-muted-foreground font-body mt-1">POAP distribution is active</p>
                </div>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={isProcessing || totalPct !== 100 || !form.title}
                  className="w-full rounded-xl gradient-primary text-primary-foreground font-bold h-11"
                >
                  {isUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading metadata…</>
                  ) : isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirm in wallet…</>
                  ) : isConfirming ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
                  ) : (
                    <><Award className="h-4 w-4 mr-2" /> {isPoapCampaignConfigured ? "Launch Campaign" : "Upload Campaign Draft"}</>
                  )}
                </Button>
              )}
            </div>
          )}

          {!isCreated && (
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setStep(0)}>
                  Back
                </Button>
              )}
              {step === 0 && (
                <Button
                  size="sm"
                  className="rounded-xl flex-1 gradient-primary text-primary-foreground font-semibold"
                  disabled={!form.title}
                  onClick={() => setStep(1)}
                >
                  Continue
                </Button>
              )}
            </div>
          )}

          {isCreated && (
            <Button variant="outline" className="w-full rounded-xl" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
