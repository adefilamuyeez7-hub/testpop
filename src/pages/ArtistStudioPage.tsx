import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Web3Error, StatCardProps } from "@/lib/types";
import {
  Palette, LogOut, Home, Camera, CheckCircle2, Loader2, Plus,
  TrendingUp, Users, Award, Package, Clock, BarChart3, Image,
  Edit3, ExternalLink, Trash2, Eye, EyeOff, Copy, Check,
  Bell, Settings, ChevronRight, Zap, Star, ArrowUpRight,
  Upload, AlertTriangle, Wallet, DollarSign, Activity, ArrowLeft,
} from "lucide-react";
import { useWallet, useCreateCampaign, useGetSubscriberCountFromArtistContract } from "@/hooks/useContracts";
import { useCreateDropArtist } from "@/hooks/useContractsArtist";
import { useGetArtistContract } from "@/hooks/useContractIntegrations";
import { ipfsToHttp, uploadFileToPinata, uploadMetadataToPinata } from "@/lib/pinata";
import { formatEther } from "viem";
import { toast } from "sonner";
import { POAP_CAMPAIGN_ADDRESS } from "@/lib/contracts/poapCampaign";
import {
  deleteArtistDrop,
  getArtistDrops,
  resolveArtistForWallet,
  saveArtistPortfolio,
  syncArtistDropCache,
  updateArtistProfile,
  updateDrop as dbUpdateDrop,
  updateArtistDropContractId,
  type ArtistPortfolioItem,
} from "@/lib/artistStore";
import { createDrop as dbCreateDrop } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────
type StudioArtistProfile = {
  name: string;
  handle: string;
  bio: string;
  tag: string;
  subscriptionPrice: string;
  twitterUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  avatarPreview: string | null;
  bannerPreview: string | null;
  defaultPoapAllocation: {
    subscribers: number;
    bidders: number;
    creators: number;
  };
  portfolio: ArtistPortfolioItem[];
};

type Drop = {
  id: string;
  title: string;
  price: string;
  supply: number;
  sold: number;
  status: "live" | "draft" | "ended";
  type: "buy" | "auction" | "campaign";
  endsIn: string;
  revenue: string;
  image: string | null;
  metadataUri: string;
  imageUri?: string;
  contractAddress?: string | null;
  contractDropId?: number | null;
  contractKind?: "artDrop" | "poapCampaign" | null;
};

type DropMode = Drop["type"];

const toStoredDropType = (mode: DropMode): "drop" | "auction" | "campaign" =>
  mode === "buy" ? "drop" : mode;

const fromStoredDropType = (type?: string | null): DropMode =>
  type === "auction" ? "auction" : type === "campaign" ? "campaign" : "buy";

type Notification = {
  id: string;
  text: string;
  time: string;
  read: boolean;
  type: "bid" | "subscriber" | "sale" | "poap";
};

const seedDrops: Drop[] = [];
const seedNotifications: Notification[] = [];

const ART_TYPES = ["Digital Art", "Sculpture", "Photography", "Mixed Media", "Generative", "Illustration", "3D", "Other"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const toGatewayUrl = (cidOrUri: string) => ipfsToHttp(cidOrUri.startsWith("ipfs://") ? cidOrUri : `ipfs://${cidOrUri}`);

// ─── Small helpers ────────────────────────────────────────────────────────────
const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    live: "bg-green-100 text-green-800",
    active: "bg-green-100 text-green-800",
    draft: "bg-secondary text-muted-foreground",
    ended: "bg-secondary text-muted-foreground",
    completed: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${map[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, accent }: StatCardProps) => (
  <div className={`p-4 rounded-2xl border ${accent ? "bg-primary text-primary-foreground border-primary/30" : "bg-card border-border"}`}>
    <Icon className={`h-4 w-4 mb-2 ${accent ? "text-primary-foreground/70" : "text-primary"}`} />
    <p className={`text-xl font-bold ${accent ? "text-primary-foreground" : "text-foreground"}`}>{value}</p>
    <p className={`text-xs mt-0.5 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
    {sub && <p className={`text-[10px] mt-1 font-medium ${accent ? "text-primary-foreground/80" : "text-primary"}`}>{sub}</p>}
  </div>
);

// ─── Create Drop Sheet ────────────────────────────────────────────────────────
const CreateDropSheet = ({
  open,
  onClose,
  onCreated,
  artistContractAddress,
  defaultPoapAllocation,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (d: Drop) => void;
  artistContractAddress?: string | null;
  defaultPoapAllocation: {
    subscribers: number;
    bidders: number;
    creators: number;
  };
}) => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{ metadataUri: string; imageUri: string; mode: DropMode } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isConnected, connectWallet, address } = useWallet();
  const {
    createDrop,
    createdDropId,
    isPending: isCreateDropPending,
    isConfirming: isCreateDropConfirming,
    isSuccess: isCreateDropSuccess,
    error: createDropError,
  } = useCreateDropArtist(artistContractAddress);
  const {
    createCampaign,
    createdCampaignId,
    isPending: isCreateCampaignPending,
    isConfirming: isCreateCampaignConfirming,
    isSuccess: isCreateCampaignSuccess,
    error: createCampaignError,
  } = useCreateCampaign();
  const [form, setForm] = useState({ title: "", description: "", price: "", duration: "24", supply: "1", type: "buy" as Drop["type"] });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setFile(f);
    const r = new FileReader();
    r.onload = ev => setPreview(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  const handlePublish = async () => {
    if (!file) return;
    
    // Validate form before uploading
    if (!form.title.trim()) {
      toast.error("Drop title is required");
      return;
    }
    
    if (!form.price || form.price.trim() === "") {
      toast.error("Price is required");
      return;
    }
    
    // Validate price is a valid decimal number
    if (!/^\d+(\.\d+)?$/.test(form.price.trim())) {
      toast.error(`Invalid price format: "${form.price}". Use a decimal number (e.g., "0.05")`);
      return;
    }
    
    if (!form.supply || Number(form.supply) <= 0) {
      toast.error("Supply must be greater than 0");
      return;
    }
    
    if (!form.duration || Number(form.duration) <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    if (form.type === "campaign") {
      toast.error("Campaign drops need a dedicated allocation workflow and are not publishable yet.");
      return;
    }

    if (form.type === "buy" && (!artistContractAddress || artistContractAddress === ZERO_ADDRESS)) {
      alert("Your artist contract has not been deployed yet. Please ask an admin to approve and deploy your contract first.");
      return;
    }
    
    if (!isConnected) {
      connectWallet();
      return;
    }
    setIsUploading(true); setUploadErr(null);
    try {
      toast.info("Uploading artwork to IPFS…");
      const imageCid = await uploadFileToPinata(file);
      const imageUri = `ipfs://${imageCid}`;
      toast.info("Pinning metadata…");
      const uri = await uploadMetadataToPinata({ name: form.title, description: form.description, image: imageUri });
      setPendingResult({ metadataUri: uri, imageUri, mode: form.type });
      
      const now = Math.floor(Date.now() / 1000);
      try {
        if (form.type === "buy") {
          createDrop(uri, form.price, Number(form.supply), now, now + Number(form.duration) * 3600);
        } else if (form.type === "auction") {
          createCampaign(
            uri,
            0,
            Number(form.supply),
            now,
            now + Number(form.duration) * 3600,
            defaultPoapAllocation.subscribers,
            defaultPoapAllocation.bidders,
            defaultPoapAllocation.creators
          );
        }
      } catch (contractError: unknown) {
        const errorMessage = contractError instanceof Error ? contractError.message : "Contract call failed";
        setUploadErr(errorMessage);
        toast.error(errorMessage);
        setIsUploading(false);
        return;
      }
    } catch (e: unknown) { 
      const errorMessage = e instanceof Error ? e.message : "Upload failed";
      setUploadErr(errorMessage); 
      toast.error(errorMessage); 
    }
    // Don't set isUploading to false here - let the useEffect handle it
  };

  useEffect(() => {
    const publishedId =
      pendingResult?.mode === "auction"
        ? createdCampaignId
        : createdDropId;
    const publishSucceeded =
      pendingResult?.mode === "auction"
        ? isCreateCampaignSuccess
        : isCreateDropSuccess;

    if (!publishSucceeded || publishedId === null || publishedId === undefined || !pendingResult?.metadataUri) return;
    
    (async () => {
      try {
        const storedType = toStoredDropType(pendingResult.mode);
        const contractKind = pendingResult.mode === "auction" ? "poapCampaign" : "artDrop";
        const contractAddress = pendingResult.mode === "auction" ? POAP_CAMPAIGN_ADDRESS : artistContractAddress;

        const savedDrop = await dbCreateDrop({
          artist_id: resolveArtistForWallet(address).id, // Get artist ID from wallet
          title: form.title,
          description: form.description,
          price_eth: parseFloat(form.price),
          supply: Number(form.supply),
          status: "live",
          type: storedType,
          image_url: preview || undefined,
          metadata_ipfs_uri: pendingResult.metadataUri,
          image_ipfs_uri: pendingResult.imageUri,
          contract_address: contractAddress,
          contract_drop_id: publishedId,
          contract_kind: contractKind,
          ends_at: new Date(Date.now() + Number(form.duration) * 3600 * 1000).toISOString(),
        });

        if (savedDrop) {
          if (contractKind === "artDrop") {
            await updateArtistDropContractId(savedDrop.id, publishedId);
          }

          onCreated({
            id: savedDrop.id,
            title: form.title,
            price: form.price,
            supply: Number(form.supply),
            sold: 0,
            status: "live",
            type: pendingResult.mode,
            endsIn: `${form.duration}h`,
            revenue: "0",
            image: preview,
            metadataUri: pendingResult.metadataUri,
            imageUri: pendingResult.imageUri,
            contractAddress: contractAddress ?? null,
            contractDropId: publishedId,
            contractKind,
          });
          toast.success("Drop minted and saved to database! 🎉");
          
          // Clear pending mint state so this effect cannot replay on rerender.
          setPendingResult(null);
          setForm({ title: "", description: "", price: "", duration: "24", supply: "1", type: "buy" });
          setPreview(null);
          setFile(null);
          setStep(0);
          setUploadErr(null);
          setIsUploading(false);
          onClose();
        }
      } catch (dbError) {
        console.error("❌ Failed to save drop to database:", dbError);
        toast.error("Drop minted but failed to save to database. Please refresh.");
        setPendingResult(null);
        setIsUploading(false);
      }
    })();
  }, [
    address,
    artistContractAddress,
    createdCampaignId,
    createdDropId,
    form,
    isCreateCampaignSuccess,
    isCreateDropSuccess,
    onClose,
    onCreated,
    pendingResult,
    preview,
  ]);

  const activePublishError = form.type === "auction" ? createCampaignError : createDropError;
  const isPending = isCreateDropPending || isCreateCampaignPending;
  const isConfirming = isCreateDropConfirming || isCreateCampaignConfirming;
  const busy =
    isUploading ||
    isCreateDropPending ||
    isCreateDropConfirming ||
    isCreateCampaignPending ||
    isCreateCampaignConfirming;
  const publishButtonContent = isUploading
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading to IPFS...</>
    : isCreateDropPending || isCreateCampaignPending
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirm in wallet...</>
    : isCreateDropConfirming || isCreateCampaignConfirming
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publishing...</>
    : form.type === "buy"
    ? <><Zap className="h-4 w-4 mr-2" />Mint & Publish</>
    : <><Gavel className="h-4 w-4 mr-2" />Create Auction</>;
  const canNext0 = !!preview;
  const canNext1 = !!(form.title && form.price);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>New Drop</DialogTitle>
          {/* Step dots */}
          <div className="flex gap-2 mt-2">
            {["Artwork", "Details", "Publish"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
                <span className={`text-[10px] ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
                {i < 2 && <div className="w-3 h-px bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {step === 0 && (
            <div>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
              {preview ? (
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={preview} className="w-full h-full object-cover" />
                  <button onClick={() => { setPreview(null); setFile(null); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full aspect-square rounded-xl border-2 border-dashed border-border bg-secondary/40 flex flex-col items-center justify-center gap-3 hover:bg-secondary/70 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload artwork</p>
                    <p className="text-xs text-muted-foreground">PNG · JPG · GIF · MP4 · Max 10MB</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {preview && <img src={preview} className="h-16 w-16 rounded-xl object-cover" />}
              <div>
                <Label className="text-xs">Drop type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["buy", "auction", "campaign"] as Drop["type"][]).map(t => (
                    <button key={t} onClick={() => setForm({ ...form, type: t })}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${form.type === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input placeholder="e.g. Chromatic Dreams" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-9 rounded-lg text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell collectors about this piece…"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none min-h-[72px]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Price (ETH)</Label><Input placeholder="0.1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                <div><Label className="text-xs">Duration (h)</Label><Input placeholder="24" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                <div><Label className="text-xs">Supply</Label><Input placeholder="1" value={form.supply} onChange={e => setForm({ ...form, supply: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/50 p-3 flex gap-3">
                {preview && <img src={preview} className="h-16 w-16 rounded-lg object-cover shrink-0" />}
                <div>
                  <p className="font-bold text-sm text-foreground">{form.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{form.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{form.price} ETH</Badge>
                    <Badge variant="secondary" className="text-[10px]">{form.duration}h</Badge>
                    <Badge variant="secondary" className="text-[10px]">×{form.supply}</Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-xs space-y-2">
                {[["Network", "Base Sepolia"], ["Storage", "IPFS via Pinata"], ["Platform fee", "2.5%"], ["Est. gas", "~$0.02"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-muted-foreground"><span>{k}</span><span className="font-semibold text-foreground">{v}</span></div>
                ))}
              </div>
              {uploadErr && <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs"><AlertTriangle className="h-4 w-4 shrink-0" />{uploadErr}</div>}
              {form.type === "campaign" && <div className="flex gap-2 p-3 rounded-xl bg-secondary text-muted-foreground text-xs"><AlertTriangle className="h-4 w-4 shrink-0" />Campaign mode is being redesigned before launch. Buy and auction are supported right now.</div>}
              {activePublishError && <p className="text-xs text-destructive">{(activePublishError as Web3Error).shortMessage ?? (activePublishError as Web3Error).message}</p>}
              <Button onClick={handlePublish} disabled={busy || form.type === "campaign"} className="w-full rounded-xl gradient-primary text-primary-foreground font-bold h-11">
                {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading to IPFS…</>
                  : isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirm in wallet…</>
                  : isConfirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Minting…</>
                  : <><Zap className="h-4 w-4 mr-2" />Mint & Publish</>}
              </Button>
            </div>
          )}

          {step < 2 && (
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setStep(s => s - 1)}>Back</Button>}
              <Button size="sm" className="flex-1 rounded-xl gradient-primary text-primary-foreground font-semibold"
                disabled={step === 0 ? !canNext0 : !canNext1}
                onClick={() => setStep(s => s + 1)}>Continue</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Studio Page ─────────────────────────────────────────────────────────
const ArtistStudioPage = () => {
  const { address, balance, disconnect } = useWallet();
  const [tab, setTab] = useState("home");
  const [drops, setDrops] = useState<Drop[]>(seedDrops);
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const [showDropSheet, setShowDropSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [copied, setCopied] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<{ avatar?: File; banner?: File }>({});
  const [portfolioMedium, setPortfolioMedium] = useState("Digital");
  const [portfolioYear, setPortfolioYear] = useState(String(new Date().getFullYear()));
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [portfolioUploading, setPortfolioUploading] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<StudioArtistProfile>({
    name: "", handle: "", bio: "", tag: "Digital Art", subscriptionPrice: "0.02",
    twitterUrl: "", instagramUrl: "", websiteUrl: "",
    avatarPreview: null, bannerPreview: null,
    defaultPoapAllocation: { subscribers: 40, bidders: 35, creators: 25 },
    portfolio: [],
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [publicArtistId, setPublicArtistId] = useState("1");

  const deployedContractAddress = useGetArtistContract(address); // Fetch deployed contract address
  const deploymentPending = false;
  const deploymentSuccess = false;
  const deploymentError = null;
  const deploymentReceipt = null;
  const deploymentHash = null;
  const deploy = async (_wallet: string) => {};
  const setDeployingArtistWallet = (_wallet: string | null) => {};

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const artist = resolveArtistForWallet(address);
    const artistDrops = getArtistDrops(artist.id);
    setPublicArtistId(artist.id);
    setProfile({
      name: artist.name,
      handle: artist.handle,
      bio: artist.bio,
      tag: artist.tag,
      subscriptionPrice: artist.subscriptionPrice,
      twitterUrl: artist.twitterUrl,
      instagramUrl: artist.instagramUrl,
      websiteUrl: artist.websiteUrl,
      avatarPreview: artist.avatar,
      bannerPreview: artist.banner,
      defaultPoapAllocation: artist.defaultPoapAllocation,
      portfolio: artist.portfolio,
    });
    setDrops(artistDrops.map((drop) => ({
      id: drop.id,
      title: drop.title,
      price: drop.priceEth,
      supply: drop.maxBuy ?? 1,
      sold: drop.bought ?? 0,
      status: drop.status === "upcoming" ? "draft" : drop.status === "ended" ? "ended" : "live",
      type: fromStoredDropType(drop.type),
      endsIn: drop.endsIn,
      revenue: drop.currentBidEth ?? drop.priceEth,
      image: drop.image,
      metadataUri: drop.metadataUri,
      imageUri: drop.imageUri,
      contractAddress: drop.contractAddress,
      contractDropId: drop.contractDropId,
      contractKind: drop.contractKind,
    })));
    setProfileComplete(Boolean(artist.name && artist.handle));
  }, [address]);

  // ─── Handle Contract Deployment Success ─────────────────────────────────────
  useEffect(() => {
    console.log("📊 Deployment status:", { 
      deploymentSuccess, 
      deployedContractAddress, 
      hashExists: !!deploymentHash,
      receiptExists: !!deploymentReceipt,
      deploymentPending,
      deploymentError,
    });

    if (!deploymentSuccess) return;
    if (!deployedContractAddress) return;
    if (!deploymentReceipt) {
      console.warn("⚠️  Receipt not available yet, waiting for confirmation...");
      return;
    }

    (async () => {
      try {
        const contractAddress = deployedContractAddress;
        console.log("✅ Contract deployment confirmed! Address:", contractAddress);

        // Update artist profile with contract address
        await updateArtistProfile(address, {
          contractAddress: contractAddress,
        });

        console.log("💾 Artist profile updated with contract address");
        toast.success("🎉 Artist contract deployed successfully!");
        
        // Re-fetch profile to show contract address
        const updatedArtist = resolveArtistForWallet(address);
        console.log("🔄 Updated artist record:", updatedArtist);
        setProfile((prev) => ({ ...prev })); // Force refresh
      } catch (err) {
        console.error("❌ Failed to update artist with contract address:", err);
        toast.error("Contract deployed but failed to save address");
      } finally {
        setDeployingArtistWallet(null);
      }
    })();
  }, [deploymentSuccess, deploymentReceipt, deployedContractAddress, address, deploymentPending]);

  const handleImageFile = (field: "avatarPreview" | "bannerPreview") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setPendingImages((prev) => ({ ...prev, [field === "avatarPreview" ? "avatar" : "banner"]: f }));
    const r = new FileReader();
    r.onload = ev => setProfile(p => ({ ...p, [field]: ev.target?.result as string }));
    r.readAsDataURL(f);
  };

  const balanceDefaultAllocation = (changed: "subscribers" | "bidders" | "creators", value: number) => {
    const otherKeys = (["subscribers", "bidders", "creators"] as const).filter((key) => key !== changed);
    const remainder = 100 - value;
    const currentOtherSum = profile.defaultPoapAllocation[otherKeys[0]] + profile.defaultPoapAllocation[otherKeys[1]];
    const first = currentOtherSum === 0 ? Math.round(remainder / 2) : Math.round((profile.defaultPoapAllocation[otherKeys[0]] / currentOtherSum) * remainder);

    setProfile((prev) => ({
      ...prev,
      defaultPoapAllocation: {
        ...prev.defaultPoapAllocation,
        [changed]: value,
        [otherKeys[0]]: Math.max(0, first),
        [otherKeys[1]]: Math.max(0, remainder - first),
      },
    }));
  };

  const saveProfile = async () => {
    if (!profile.name || !profile.handle) { toast.error("Name and handle are required"); return; }
    if (!address) { toast.error("Connect wallet to save profile"); return; }
    
    setProfileSaving(true);
    try {
      let avatarPreview = profile.avatarPreview;
      let bannerPreview = profile.bannerPreview;

      if (pendingImages.avatar) {
        const avatarCid = await uploadFileToPinata(pendingImages.avatar);
        avatarPreview = toGatewayUrl(avatarCid);
      }
      if (pendingImages.banner) {
        const bannerCid = await uploadFileToPinata(pendingImages.banner);
        bannerPreview = toGatewayUrl(bannerCid);
      }

      await updateArtistProfile(address, {
        name: profile.name,
        handle: profile.handle,
        bio: profile.bio,
        tag: profile.tag,
        subscriptionPrice: profile.subscriptionPrice,
        twitterUrl: profile.twitterUrl,
        instagramUrl: profile.instagramUrl,
        websiteUrl: profile.websiteUrl,
        avatar: avatarPreview || "",
        banner: bannerPreview || "",
        defaultPoapAllocation: profile.defaultPoapAllocation,
        portfolio: profile.portfolio,
      });
      setProfile((prev) => ({ ...prev, avatarPreview, bannerPreview }));
      setPendingImages({});

      // ✨ Profile saved successfully
      setProfileSaving(false);
      setProfileSaved(true);
      setProfileComplete(true);
      toast.success("Profile saved!");
      setTimeout(() => setProfileSaved(false), 2000);

      // ✨ NEW: Deploy artist contract if not already deployed (async, doesn't block profile save)
      const artist = resolveArtistForWallet(address);
      if (!artist.contractAddress && !deployedContractAddress) {
        toast.info("Profile saved. An admin will deploy your artist contract before you can publish drops.");
      }
      if (deploymentPending && !artist.contractAddress) {
        console.log("🚀 Contract not found for artist, initiating deployment...");
        setDeployingArtistWallet(address);
        toast.info("🚀 Deploying your artist NFT contract in the background...");
        try {
          await deploy(address);
          console.log("📤 Deployment transaction submitted");
          // The useEffect will handle the receipt and completion
        } catch (deployErr) {
          console.error("❌ Contract deployment failed:", deployErr);
          toast.error("Failed to deploy artist contract. You can still create drops.");
          setDeployingArtistWallet(null);
        }
      }
    } catch (error: unknown) {
      setProfileSaving(false);
      const errorMessage = error instanceof Error ? error.message : "Profile save failed";
      console.error("❌ Profile save error:", errorMessage, error);
      toast.error(errorMessage);
      return;
    }
  };

  const addPortfolioPiece = async () => {
    if (!portfolioFiles.length) {
      toast.error("Select one or more portfolio images first");
      return;
    }
    setPortfolioUploading(true);
    try {
      const uploadedPieces: ArtistPortfolioItem[] = [];

      for (const file of portfolioFiles) {
        const imageCid = await uploadFileToPinata(file);
        const imageUri = `ipfs://${imageCid}`;
        const inferredTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || `Portfolio ${uploadedPieces.length + 1}`;
        const metadataUri = await uploadMetadataToPinata({
          name: inferredTitle,
          image: imageUri,
          medium: portfolioMedium,
          year: portfolioYear,
        });

        uploadedPieces.push({
          id: `portfolio-${Date.now()}-${uploadedPieces.length}`,
          image: toGatewayUrl(imageUri),
          imageUri,
          metadataUri,
          title: inferredTitle,
          medium: portfolioMedium,
          year: portfolioYear,
        });
      }

      const nextPortfolio = [...uploadedPieces.reverse(), ...profile.portfolio];
      setProfile((prev) => ({ ...prev, portfolio: nextPortfolio }));
      saveArtistPortfolio(address, nextPortfolio);
      setPortfolioMedium("Digital");
      setPortfolioYear(String(new Date().getFullYear()));
      setPortfolioFiles([]);
      if (portfolioRef.current) portfolioRef.current.value = "";
      toast.success(`${uploadedPieces.length} portfolio piece${uploadedPieces.length > 1 ? "s" : ""} added`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Portfolio upload failed";
      toast.error(errorMessage);
    } finally {
      setPortfolioUploading(false);
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const totalRevenue = drops.reduce((s, d) => s + parseFloat(d.revenue || "0"), 0);
  const liveDrops = drops.filter(d => d.status === "live").length;
  // Note: Artist contract address tracking is coming - for now this will return 0 subscribers
  // Once contract_address is populated in Supabase and passed through artistStore, we'll use it here
  const { count: totalSubscribers = 0 } = useGetSubscriberCountFromArtistContract(null);
  const totalCampaignDrops = drops.filter((d) => d.type === "campaign").length;

  // ── NAV ITEMS ───────────────────────────────────────────────────────────────
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "drops", icon: Package, label: "Drops" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "profile", icon: Palette, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">

      {/* ── Studio Top Bar ── */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            {/* Back button when accessed from in-app */}
            <Link to="/" className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Back to home">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div className="h-7 w-7 rounded-xl bg-primary flex items-center justify-center">
              <Palette className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">Artist Studio</p>
              {profile.handle && <p className="text-[10px] text-muted-foreground leading-none mt-0.5">@{profile.handle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications(true)} className="relative p-2 rounded-full hover:bg-secondary transition-colors">
              <Bell className="h-5 w-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            {profile.handle && (
              <Link to={`/artists/${publicArtistId}`} className="p-2 rounded-full hover:bg-secondary transition-colors" title="View public profile">
                <ExternalLink className="h-5 w-5 text-foreground" />
              </Link>
            )}
            <button onClick={() => disconnect()} className="p-2 rounded-full hover:bg-destructive/10 transition-colors" title="Sign out">
              <LogOut className="h-4.5 w-4.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="pb-24">

        {/* ════════ HOME TAB ════════ */}
        {tab === "home" && (
          <div className="px-4 pt-4 space-y-5">
            {/* Wallet card */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                    {profile.avatarPreview
                      ? <img src={profile.avatarPreview} className="h-full w-full object-cover" />
                      : <Wallet className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{profile.name || "Set up your profile"}</p>
                    <button onClick={copyAddress} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                      {address?.slice(0, 8)}…{address?.slice(-4)}
                      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">wallet balance</p>
                </div>
              </div>
              {!profileComplete && (
                <button onClick={() => setTab("profile")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold">
                  <span>⚡ Complete your profile to go live</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={DollarSign} label="Total revenue" value={`${totalRevenue.toFixed(3)} ETH`} sub="+8% this week" accent />
              <StatCard icon={Users} label="Subscribers" value={totalSubscribers.toLocaleString()} sub="+12% this month" />
              <StatCard icon={Package} label="Active drops" value={String(liveDrops)} />
              <StatCard icon={Award} label="Campaign drops" value={String(totalCampaignDrops)} sub="inside drops" />
            </div>

            {/* Quick actions */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowDropSheet(true)}
                  className="p-4 rounded-2xl bg-card border border-border text-left hover:border-primary/40 transition-colors">
                  <Plus className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">New Drop</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Buy, auction, or campaign</p>
                </button>
                <button onClick={() => setTab("analytics")}
                  className="p-4 rounded-2xl bg-card border border-border text-left hover:border-primary/40 transition-colors">
                  <Activity className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">Analytics</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Revenue & growth</p>
                </button>
                <button onClick={() => setTab("profile")}
                  className="p-4 rounded-2xl bg-card border border-border text-left hover:border-primary/40 transition-colors">
                  <Edit3 className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">Edit Profile</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Bio · links · pricing</p>
                </button>
              </div>
            </div>

            {/* Recent drops preview */}
            {drops.filter(d => d.status === "live").length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Now</p>
                  <button onClick={() => setTab("drops")} className="text-xs text-primary">View all</button>
                </div>
                {drops.filter(d => d.status === "live").map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border mb-2">
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {d.image ? <img src={d.image} className="h-full w-full object-cover rounded-lg" /> : <Image className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-primary font-bold">{d.price} ETH</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{d.endsIn}</span>
                      </div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ DROPS TAB ════════ */}
        {tab === "drops" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">My Drops</h2>
              <Button size="sm" onClick={() => setShowDropSheet(true)} className="rounded-full gradient-primary text-primary-foreground text-xs h-8 px-3">
                <Plus className="h-3.5 w-3.5 mr-1" /> New Drop
              </Button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {["all", "live", "draft", "ended"].map(f => (
                <button key={f} className="px-3 py-1 rounded-full text-xs whitespace-nowrap capitalize bg-secondary text-muted-foreground">
                  {f}
                </button>
              ))}
            </div>

            {drops.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <Package className="h-12 w-12 text-border mb-4" />
                <p className="text-sm font-semibold text-foreground mb-1">No drops yet</p>
                <p className="text-xs text-muted-foreground mb-4">Mint your first artwork on Base</p>
                <Button onClick={() => setShowDropSheet(true)} size="sm" className="rounded-full gradient-primary text-primary-foreground">Create First Drop</Button>
              </div>
            )}

            {drops.map(d => (
              <div key={d.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    {d.image ? <img src={d.image} className="h-full w-full object-cover" /> : <Image className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{d.title}</p>
                      <StatusPill status={d.status} />
                      <Badge variant="outline" className="text-[10px] capitalize">{d.type}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[["Price", `${d.price} ETH`], ["Sold", `${d.sold}/${d.supply}`], ["Revenue", `${d.revenue} ETH`]].map(([k, v]) => (
                        <div key={k} className="text-center p-1.5 rounded-lg bg-secondary">
                          <p className="text-xs font-bold text-foreground">{v}</p>
                          <p className="text-[9px] text-muted-foreground">{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {d.endsIn}
                  </div>
                  <div className="flex gap-3">
                    {d.contractAddress && (
                      <a href={`https://sepolia.basescan.org/address/${d.contractAddress}`} target="_blank" rel="noreferrer"
                        className="text-[10px] text-primary flex items-center gap-0.5">
                        <ExternalLink className="h-3 w-3" /> Basescan
                      </a>
                    )}
                    <button onClick={() => {
                      deleteArtistDrop(d.id);
                      setDrops(prev => prev.filter(x => x.id !== d.id));
                    }}
                      className="text-[10px] text-destructive flex items-center gap-0.5">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ ANALYTICS TAB ════════ */}
        {tab === "analytics" && (
          <div className="px-4 pt-4 space-y-5">
            <h2 className="text-lg font-bold">Analytics</h2>
            <p className="text-xs text-muted-foreground">Studio analytics currently blend your saved drop data with lightweight local estimates while deeper platform reporting is still being wired.</p>

            {/* Revenue summary */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total earnings</p>
              <p className="text-3xl font-bold text-foreground">{totalRevenue.toFixed(4)} <span className="text-lg text-muted-foreground font-normal">ETH</span></p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                <p className="text-xs text-green-600 font-medium">+8% vs last month</p>
              </div>
            </div>

            {/* Breakdown grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Drop sales", value: "3.7 ETH", sub: "6 transactions" },
                { label: "Subscriptions", value: "0.48 ETH", sub: "24 active" },
                { label: "Platform fee", value: "0.1 ETH", sub: "2.5% per drop" },
                { label: "Net earnings", value: "4.08 ETH", sub: "after fees" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-2xl bg-card border border-border">
                  <p className="text-base font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-[10px] text-primary mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Subscriber growth */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Subscriber growth</p>
                <span className="text-xs text-green-600 font-medium flex items-center gap-0.5"><ArrowUpRight className="h-3.5 w-3.5" />+12%</span>
              </div>
              {/* Simple bar chart approximation */}
              <div className="flex items-end gap-2 h-20">
                {[60, 72, 65, 80, 88, 95, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-primary/20 relative" style={{ height: `${h}%` }}>
                    {i === 6 && <div className="absolute inset-0 rounded-t-sm bg-primary" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map(m => (
                  <p key={m} className="text-[9px] text-muted-foreground">{m}</p>
                ))}
              </div>
            </div>

            {/* Drop performance */}
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <p className="text-sm font-semibold text-foreground">Drop performance</p>
              {drops.filter(d => d.status !== "draft").map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    {d.image ? <img src={d.image} className="h-full w-full rounded-lg object-cover" /> : <Image className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground">{d.title}</p>
                    <div className="h-1.5 rounded-full bg-secondary mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${d.sold / d.supply * 100}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-primary shrink-0">{d.revenue} ETH</p>
                </div>
              ))}
            </div>

            {/* Platform fees note */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm font-semibold text-foreground mb-3">Revenue split</p>
              {[["You (artist)", "70%"], ["Investors", "20%"], ["Platform", "10%"]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="text-xs font-bold text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ PROFILE SETUP TAB ════════ */}
        {tab === "profile" && (
          <div className="px-4 pt-4 pb-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Profile Setup</h2>
              {profileComplete && <Badge className="bg-green-100 text-green-800 text-[10px]">✓ Complete</Badge>}
            </div>

            {/* Banner + Avatar upload */}
            <div className="relative">
              {/* Banner */}
              <button onClick={() => bannerRef.current?.click()} className="w-full h-32 rounded-2xl overflow-hidden bg-secondary border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors relative">
                {profile.bannerPreview
                  ? <img src={profile.bannerPreview} className="w-full h-full object-cover" />
                  : <div className="text-center"><Camera className="h-6 w-6 text-muted-foreground mx-auto mb-1" /><p className="text-xs text-muted-foreground">Upload banner</p></div>}
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </button>
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile("bannerPreview")} />

              {/* Avatar overlapping banner */}
              <button onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-8 left-4 h-20 w-20 rounded-2xl bg-secondary border-4 border-background overflow-hidden hover:opacity-90 transition-opacity">
                {profile.avatarPreview
                  ? <img src={profile.avatarPreview} className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex flex-col items-center justify-center"><Camera className="h-5 w-5 text-muted-foreground" /><p className="text-[9px] text-muted-foreground mt-0.5">Avatar</p></div>}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile("avatarPreview")} />
            </div>

            {/* Spacer for avatar overflow */}
            <div className="h-10" />

            {/* Basic info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</p>
              <div>
                <Label className="text-xs">Display name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Kai Monet" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Handle <span className="text-destructive">*</span></Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                  <Input placeholder="kaimonet" value={profile.handle} onChange={e => setProfile(p => ({ ...p, handle: e.target.value.toLowerCase().replace(/\s/g, "") }))} className="h-10 rounded-xl text-sm pl-7" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bio</Label>
                <textarea
                  value={profile.bio}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Tell collectors who you are and what you create…"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none min-h-[88px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={280}
                />
                <p className="text-[10px] text-muted-foreground text-right">{profile.bio.length}/280</p>
              </div>
              <div>
                <Label className="text-xs">Art type</Label>
                <select value={profile.tag} onChange={e => setProfile(p => ({ ...p, tag: e.target.value }))}
                  className="w-full mt-1 h-10 rounded-xl border border-border bg-background px-3 text-sm">
                  {ART_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Subscription pricing */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscription</p>
              <div>
                <Label className="text-xs">Monthly price (ETH)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number" placeholder="0.02" value={profile.subscriptionPrice}
                    onChange={e => setProfile(p => ({ ...p, subscriptionPrice: e.target.value }))}
                    className="h-10 rounded-xl text-sm pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ETH/mo</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Subscribers get POAP priority access and exclusive content.</p>
              </div>
            </div>

            {/* Social links */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Links</p>
              {[
                { key: "twitterUrl", label: "X / Twitter", placeholder: "https://x.com/yourhandle" },
                { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
                { key: "websiteUrl", label: "Website / Portfolio", placeholder: "https://yoursite.com" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={profile[key]}
                    onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                    className="h-10 rounded-xl text-sm mt-1"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portfolio</p>
              <input
                ref={portfolioRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => setPortfolioFiles(Array.from(e.target.files ?? []))}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Medium</Label>
                  <Input value={portfolioMedium} onChange={e => setPortfolioMedium(e.target.value)} className="h-10 rounded-xl text-sm mt-1" placeholder="Digital" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Year</Label>
                  <Input value={portfolioYear} onChange={e => setPortfolioYear(e.target.value)} className="h-10 rounded-xl text-sm mt-1" placeholder="2026" />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => portfolioRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> {portfolioFiles.length ? `${portfolioFiles.length} selected` : "Select images"}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Upload as many artworks as you want. Titles are generated from filenames and each piece is pinned to Pinata.
              </p>
              <Button onClick={addPortfolioPiece} disabled={portfolioUploading} variant="outline" className="w-full rounded-xl">
                {portfolioUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : <><Plus className="h-4 w-4 mr-2" />Add Portfolio Piece</>}
              </Button>
              {profile.portfolio.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {profile.portfolio.slice(0, 6).map((piece) => (
                    <div key={piece.id} className="rounded-xl overflow-hidden bg-card border border-border">
                      <img src={piece.image} alt={piece.title} className="h-24 w-full object-cover" />
                      <div className="p-2">
                        <p className="text-[10px] font-semibold truncate text-foreground">{piece.title}</p>
                        <p className="text-[9px] text-muted-foreground">{piece.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* POAP allocation defaults */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default POAP Allocation</p>
              <p className="text-xs text-muted-foreground">These are your default percentages when creating campaign-type drops. You can override them later if needed.</p>
              {([
                ["subscribers", "Subscribers"],
                ["bidders", "Bidders"],
                ["creators", "Content Creators"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{label}</Label>
                    <span className="text-xs font-bold text-foreground">{profile.defaultPoapAllocation[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={profile.defaultPoapAllocation[key]}
                    onChange={e => balanceDefaultAllocation(key, Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              ))}
              <p className={`text-sm font-bold text-center ${profile.defaultPoapAllocation.subscribers + profile.defaultPoapAllocation.bidders + profile.defaultPoapAllocation.creators === 100 ? "text-primary" : "text-destructive"}`}>
                {profile.defaultPoapAllocation.subscribers + profile.defaultPoapAllocation.bidders + profile.defaultPoapAllocation.creators}% total
              </p>
            </div>

            {/* Save button */}
            <Button onClick={saveProfile} disabled={profileSaving}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm">
              {profileSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                : deploymentPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deploying contract…</>
                : profileSaved ? <><CheckCircle2 className="h-4 w-4 mr-2" />Saved!</>
                : "Save Profile"}
            </Button>

            {/* Profile preview link */}
            {profileComplete && (
              <Link to={`/artists/${publicArtistId}`}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-primary font-medium">
                <Eye className="h-4 w-4" /> Preview your public profile
              </Link>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border max-w-lg mx-auto">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${tab === item.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className={`h-5 w-5 ${tab === item.id ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Notification Drawer ── */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && (
                <button onClick={() => setNotifications(n => n.map(x => ({ ...x, read: true })))}
                  className="text-xs text-primary font-normal">Mark all read</button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
            {notifications.map(n => (
              <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${n.read ? "bg-secondary/30" : "bg-primary/5 border border-primary/20"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${n.type === "bid" ? "bg-blue-100" : n.type === "sale" ? "bg-green-100" : n.type === "subscriber" ? "bg-purple-100" : "bg-amber-100"}`}>
                  {n.type === "bid" ? <TrendingUp className="h-4 w-4 text-blue-600" />
                    : n.type === "sale" ? <DollarSign className="h-4 w-4 text-green-600" />
                    : n.type === "subscriber" ? <Users className="h-4 w-4 text-purple-600" />
                    : <Award className="h-4 w-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{n.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Drop sheet ── */}
      <CreateDropSheet
        open={showDropSheet}
        onClose={() => setShowDropSheet(false)}
        artistContractAddress={deployedContractAddress}
        defaultPoapAllocation={profile.defaultPoapAllocation}
        onCreated={d => {
          setDrops(prev => [d, ...prev]);
          syncArtistDropCache({
            id: d.id,
            artistId: publicArtistId,
            title: d.title,
            artist: profile.name || "Studio Artist",
            artistAvatar: profile.avatarPreview || "",
            image: d.image || profile.bannerPreview || "",
            imageUri: d.imageUri,
            metadataUri: d.metadataUri,
            priceEth: d.price,
            currentBidEth: d.type === "auction" ? d.price : null,
            endsIn: d.endsIn,
            type: d.type === "auction" ? "Auction" : d.type === "campaign" ? "Campaign" : "Drop",
            description: profile.bio || `${d.title} by ${profile.name || "Studio Artist"}`,
            edition: `1 of ${d.supply}`,
            bids: 0,
            poap: d.type !== "buy",
            poapNote: d.type === "campaign" ? "Studio campaign with subscriber, bidder, and creator participation." : undefined,
            contractAddress: d.contractAddress ?? null,
            contractDropId: d.contractDropId ?? null,
            contractKind: d.contractKind ?? null,
            maxBuy: d.supply,
            bought: d.sold,
            status: d.status === "draft" ? "upcoming" : d.status,
          });
        }}
      />
    </div>
  );
};

export default ArtistStudioPage;
