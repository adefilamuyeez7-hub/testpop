import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Upload, AlertTriangle, Wallet, DollarSign, Activity, ArrowLeft, Gavel,
  X,
} from "lucide-react";
import { useWallet, useCreateCampaign, useGetSubscriberCountFromArtistContract } from "@/hooks/useContracts";
import { useCreateDropArtist } from "@/hooks/useContractsArtist";
import { useCreateCampaignV2 } from "@/hooks/useCampaignV2";
import { useGetArtistContract, useResolvedArtistContract } from "@/hooks/useContractIntegrations";
import { useNotifications } from "@/hooks/useNotifications";
import { ipfsToHttp, resolveMediaUrl, uploadFileToPinata, uploadMetadataToPinata } from "@/lib/pinata";
import { establishSecureSession } from "@/lib/secureAuth";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { formatEther } from "viem";
import { toast } from "sonner";
import { CampaignManagementPanel } from "@/components/campaign/CampaignManagementPanel";
import {
  CampaignArchitectureCard,
  DEFAULT_CAMPAIGN_DETAILS,
  type CampaignDetailContent,
} from "@/components/campaign/CampaignArchitectureCard";
import { detectAssetTypeFromFile, getAssetTypeLabel, type AssetType } from "@/lib/assetTypes";
import { POAP_CAMPAIGN_ADDRESS } from "@/lib/contracts/poapCampaign";
import { POAP_CAMPAIGN_V2_ADDRESS } from "@/lib/contracts/poapCampaignV2";
import { resolveDropCoverImage } from "@/lib/mediaPreview";
import { resolvePortfolioImage } from "@/lib/portfolio";
import {
  deleteArtistDrop,
  getArtistDrops,
  resolveArtistForWallet,
  saveArtistPortfolio,
  syncArtistDropCache,
  updateArtistProfile,
  updateArtistDropContractId,
  type ArtistPortfolioItem,
} from "@/lib/artistStore";
import {
  createDrop as dbCreateDrop,
  createCreativeRelease,
  createProduct as dbCreateProduct,
  createProductAssets,
  getArtistProfile as dbGetArtistProfile,
  getIPCampaigns,
  createIPCampaign,
  updateDrop as dbUpdateDrop,
  updateProduct as dbUpdateProduct,
  type IPCampaign,
  type ProductAsset,
  type Product,
} from "@/lib/db";
import { useSupabaseArtistByWallet, useSupabaseDropsByArtist, useSupabaseProductsByCreator } from "@/hooks/useSupabase";
import { ADMIN_WALLET } from "@/lib/admin";
import { createOnchainCreativeRelease } from "@/lib/creativeReleaseEscrowChain";
import { CREATIVE_RELEASE_ESCROW_ADDRESS } from "@/lib/contracts/creativeReleaseEscrow";
import { normalizePublicDropStatus } from "@/lib/catalogVisibility";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  status: "live" | "upcoming" | "draft" | "ended";
  type: "buy" | "auction" | "campaign";
  endsIn: string;
  revenue: string;
  image: string | null;
  metadataUri: string;
  imageUri?: string;
  assetType?: AssetType;
  previewUri?: string;
  deliveryUri?: string;
  isGated?: boolean;
  contractAddress?: string | null;
  contractDropId?: number | null;
  contractKind?: "artDrop" | "poapCampaign" | "poapCampaignV2" | null;
  metadata?: Record<string, unknown>;
};

type DropMode = Drop["type"];
type DropContentKind = "artwork" | "ebook" | "downloadable";
type StudioReleaseType = "collectible" | "physical" | "hybrid";

function toProductAssetKind(assetType: AssetType, contentKind: DropContentKind): ProductAsset["asset_type"] {
  if (assetType === "image" || assetType === "video" || assetType === "audio" || assetType === "pdf" || assetType === "epub") {
    return assetType;
  }

  if (contentKind === "ebook") {
    return "document";
  }

  if (contentKind === "downloadable") {
    return "archive";
  }

  return "other";
}

const getListingReleaseLabel = (value?: string | null) => {
  if (value === "hybrid") return "hybrid collectible";
  if (value === "digital") return "digital release";
  if (value === "physical") return "merchandise";
  return value || "collectible";
};

const toStoredDropType = (mode: DropMode): "drop" | "auction" | "campaign" =>
  mode === "buy" ? "drop" : mode;

const fromStoredDropType = (type?: string | null): DropMode =>
  type === "auction" ? "auction" : type === "campaign" ? "campaign" : "buy";

function isReleaseBackedSyntheticDrop(value: unknown) {
  if (!value || typeof value !== "object") return false;

  const record = value as {
    source_kind?: unknown;
    metadata?: unknown;
  };
  const sourceKind = typeof record.source_kind === "string" ? record.source_kind : "";
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : null;
  const metadataSourceKind = typeof metadata?.source_kind === "string" ? metadata.source_kind : "";
  const normalizedSourceKind = (sourceKind || metadataSourceKind).toLowerCase();

  return normalizedSourceKind === "release_product" || normalizedSourceKind === "catalog_product";
}

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
const LEGACY_AUCTION_DISABLED_MESSAGE =
  "Legacy auctions are paused while POPUP migrates them to the safer POAP campaign flow.";

const toGatewayUrl = (cidOrUri: string) => ipfsToHttp(cidOrUri.startsWith("ipfs://") ? cidOrUri : `ipfs://${cidOrUri}`);

const raiseStatusStyles: Record<string, string> = {
  review: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  funded: "bg-blue-100 text-blue-800",
  settled: "bg-indigo-100 text-indigo-800",
  closed: "bg-secondary text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
  draft: "bg-secondary text-muted-foreground",
};

function getRaiseReviewLabel(campaign: IPCampaign) {
  const reviewStatus = String(campaign.metadata?.review_status || "").toLowerCase();
  if (reviewStatus === "rejected") return "Rejected";
  if (reviewStatus === "approved" || campaign.status === "active") return "Approved";
  if (campaign.status === "review") return "Awaiting admin approval";
  return String(campaign.status || "draft").replace(/_/g, " ");
}

type CampaignDetailForm = Required<CampaignDetailContent>;

function normalizeCampaignDetailItems(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function extractCampaignDetails(metadata?: Record<string, unknown> | null): CampaignDetailForm {
  const raw =
    metadata && typeof metadata === "object" && metadata.campaign_details && typeof metadata.campaign_details === "object"
      ? metadata.campaign_details as CampaignDetailContent
      : {};

  return {
    title: raw.title?.trim() || DEFAULT_CAMPAIGN_DETAILS.title,
    intro: raw.intro?.trim() || DEFAULT_CAMPAIGN_DETAILS.intro,
    primaryLabel: raw.primaryLabel?.trim() || DEFAULT_CAMPAIGN_DETAILS.primaryLabel,
    primaryItems: normalizeCampaignDetailItems(raw.primaryItems, DEFAULT_CAMPAIGN_DETAILS.primaryItems),
    secondaryLabel: raw.secondaryLabel?.trim() || DEFAULT_CAMPAIGN_DETAILS.secondaryLabel,
    secondaryItems: normalizeCampaignDetailItems(raw.secondaryItems, DEFAULT_CAMPAIGN_DETAILS.secondaryItems),
  };
}

function campaignDetailItemsToTextarea(items: string[]) {
  return items.join("\n");
}

function campaignDetailItemsFromTextarea(value: string, fallback: string[]) {
  const items = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

function sanitizeCampaignDetails(details: CampaignDetailContent | CampaignDetailForm): CampaignDetailForm {
  return {
    title: details.title?.trim() || DEFAULT_CAMPAIGN_DETAILS.title,
    intro: details.intro?.trim() || DEFAULT_CAMPAIGN_DETAILS.intro,
    primaryLabel: details.primaryLabel?.trim() || DEFAULT_CAMPAIGN_DETAILS.primaryLabel,
    primaryItems: normalizeCampaignDetailItems(details.primaryItems, DEFAULT_CAMPAIGN_DETAILS.primaryItems),
    secondaryLabel: details.secondaryLabel?.trim() || DEFAULT_CAMPAIGN_DETAILS.secondaryLabel,
    secondaryItems: normalizeCampaignDetailItems(details.secondaryItems, DEFAULT_CAMPAIGN_DETAILS.secondaryItems),
  };
}

function readCampaignWindowValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const campaignWindow =
    metadata?.campaign_window && typeof metadata.campaign_window === "object" && !Array.isArray(metadata.campaign_window)
      ? (metadata.campaign_window as Record<string, unknown>)
      : null;
  const value = campaignWindow?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getStudioDropDisplayStatus(drop: {
  type?: string | null;
  status?: string | null;
  ends_at?: string | null;
  metadata?: Record<string, unknown> | null;
}): Drop["status"] {
  const normalizedStatus = normalizePublicDropStatus(drop.status);
  const normalizedType = (drop.type || "drop").toLowerCase();

  if (normalizedType === "campaign") {
    const now = Date.now();
    const startAt = readCampaignWindowValue(drop.metadata, "start_at") || readCampaignWindowValue(drop.metadata, "startAt");
    const endAt =
      readCampaignWindowValue(drop.metadata, "end_at") ||
      readCampaignWindowValue(drop.metadata, "endAt") ||
      drop.ends_at ||
      "";

    const startMs = startAt ? new Date(startAt).getTime() : Number.NaN;
    const endMs = endAt ? new Date(endAt).getTime() : Number.NaN;

    if (Number.isFinite(endMs) && endMs <= now) {
      return "ended";
    }

    if (Number.isFinite(startMs) && startMs > now) {
      return "upcoming";
    }
  }

  return normalizedStatus;
}

// â”€â”€â”€ Small helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    live: "bg-green-100 text-green-800",
    active: "bg-green-100 text-green-800",
    upcoming: "bg-amber-100 text-amber-800",
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

// â”€â”€â”€ Create Drop Sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CreateDropSheet = ({
  open,
  onClose,
  onCreated,
  artistContractAddress,
  defaultPoapAllocation,
  withArtistUploadSession,
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
  withArtistUploadSession: <T>(task: () => Promise<T>) => Promise<T>;
}) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [releaseType, setReleaseType] = useState<StudioReleaseType>("collectible");
  const [contentKind, setContentKind] = useState<DropContentKind>("artwork");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{
    metadataUri: string;
    imageUri: string;
    deliveryUri: string;
    previewUri?: string;
    assetType: AssetType;
    isGated: boolean;
    mode: DropMode;
    contentKind: DropContentKind;
    campaignConfig?: {
      entryMode: "eth" | "content" | "both";
      startAt: string;
      endAt: string;
      redeemAt: string;
    } | null;
  } | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const deliveryFileRef = useRef<HTMLInputElement>(null);
  const galleryFilesRef = useRef<HTMLInputElement>(null);
  const [physicalDetails, setPhysicalDetails] = useState({
    materials: "",
    dimensions: "",
    edition_notes: "",
    condition: "",
    shipping_regions: "",
    care_instructions: "",
    extra_notes: "",
  });
  const [shippingProfile, setShippingProfile] = useState({
    origin: "",
    processing_window: "",
    carrier_preferences: "",
    approval_required: true,
  });
  const [creatorNotes, setCreatorNotes] = useState("");
  const setFile = setCoverFile;
  const preview = coverPreview;
  const setPreview = setCoverPreview;
  const fileRef = coverFileRef;
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
    createdCampaignId,
    isPending: isCreateCampaignPending,
    isConfirming: isCreateCampaignConfirming,
    isSuccess: isCreateCampaignSuccess,
    error: createCampaignError,
  } = useCreateCampaign();
  const {
    createCampaign: createCampaignV2,
    createdCampaignId: createdCampaignV2Id,
    isPending: isCreateCampaignV2Pending,
    isConfirming: isCreateCampaignV2Confirming,
    isSuccess: isCreateCampaignV2Success,
    error: createCampaignV2Error,
  } = useCreateCampaignV2();
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    duration: "24",
    supply: "1",
    type: "buy" as Drop["type"],
    entryMode: "both" as "eth" | "content" | "both",
    startAt: "",
    endAt: "",
  });
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetailForm>(DEFAULT_CAMPAIGN_DETAILS);

  const requiresSeparateDelivery = contentKind !== "artwork";
  const isPhysicalRelease = releaseType === "physical" || releaseType === "hybrid";
  const coverLabel =
    isPhysicalRelease
      ? "Upload onchain art cover"
      : contentKind === "ebook"
      ? "Upload cover image"
      : contentKind === "downloadable"
      ? "Upload cover or mockup"
      : "Upload artwork";
  const coverHelpText =
    isPhysicalRelease
      ? "This becomes the public art hero for the release."
      : contentKind === "ebook"
      ? "JPG or PNG cover shown before purchase"
      : contentKind === "downloadable"
      ? "JPG or PNG preview for your downloadable tool"
      : "Image, video, audio, PDF, or EPUB up to 10MB";
  const deliveryLabel =
    contentKind === "ebook" ? "Upload ebook file" : "Upload downloadable file";
  const deliveryHelpText =
    contentKind === "ebook"
      ? "PDF or EPUB delivered to collectors after purchase"
      : "ZIP, brush pack, PSD, PDF, or other digital file delivered after purchase";
  const selectedCoverAssetType = coverFile ? detectAssetTypeFromFile(coverFile) : null;

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  useEffect(() => {
    return () => {
      for (const previewUri of galleryPreviews) {
        if (previewUri.startsWith("blob:")) {
          URL.revokeObjectURL(previewUri);
        }
      }
    };
  }, [galleryPreviews]);

  const renderCoverPreview = (mode: "full" | "compact" = "full") => {
    if (!coverFile || !selectedCoverAssetType) return null;

    const isCompact = mode === "compact";
    const wrapperClass = isCompact
      ? "h-16 w-16 rounded-xl overflow-hidden border border-border bg-secondary/40 shrink-0"
      : "h-full w-full";
    const fallbackCardClass = isCompact
      ? "h-16 w-16 rounded-xl border border-border bg-secondary/40 flex items-center justify-center p-2 text-center"
      : "h-full w-full rounded-xl border border-border bg-secondary/40 flex flex-col items-center justify-center p-4 text-center";

    if (selectedCoverAssetType === "image" && coverPreview) {
      return <img src={coverPreview} alt={coverFile.name} className={`${wrapperClass} object-cover`} />;
    }

    if (selectedCoverAssetType === "video" && coverPreview) {
      return (
        <video
          src={coverPreview}
          className={`${wrapperClass} object-cover`}
          controls
          muted
          playsInline
          preload="metadata"
        />
      );
    }

    if (selectedCoverAssetType === "audio" && coverPreview) {
      return (
        <div className={fallbackCardClass}>
          <p className={`${isCompact ? "text-[9px]" : "text-xs"} font-semibold text-foreground line-clamp-2`}>
            {isCompact ? "Audio" : coverFile.name}
          </p>
          {!isCompact && <audio src={coverPreview} controls className="mt-3 w-full" preload="metadata" />}
        </div>
      );
    }

    if (selectedCoverAssetType === "pdf" && coverPreview) {
      return isCompact ? (
        <div className={fallbackCardClass}>
          <p className="text-[9px] font-semibold text-foreground">PDF</p>
        </div>
      ) : (
        <iframe src={coverPreview} title={coverFile.name} className="h-full w-full rounded-xl border-0 bg-white" />
      );
    }

    return (
      <div className={fallbackCardClass}>
        <p className={`${isCompact ? "text-[9px]" : "text-xs"} font-semibold text-foreground line-clamp-2`}>
          {isCompact ? getAssetTypeLabel(selectedCoverAssetType) : coverFile.name}
        </p>
        {!isCompact && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {getAssetTypeLabel(selectedCoverAssetType)} selected and ready for upload.
          </p>
        )}
      </div>
    );
  };

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setCoverFile(f);
    if (detectAssetTypeFromFile(f) === "image") {
      const r = new FileReader();
      r.onload = ev => setCoverPreview(ev.target?.result as string);
      r.readAsDataURL(f);
      return;
    }
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleDeliveryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
    setDeliveryFile(f);
  };

  const handleGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      toast.error(`"${oversized.name}" is larger than 10MB`);
      return;
    }

    setGalleryFiles(files);
    setGalleryPreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const resetComposerState = () => {
    setForm({
      title: "",
      description: "",
      price: "",
      duration: "24",
      supply: "1",
      type: "buy",
      entryMode: "both",
      startAt: "",
      endAt: "",
    });
    setCampaignDetails(DEFAULT_CAMPAIGN_DETAILS);
    setReleaseType("collectible");
    setCoverPreview(null);
    setCoverFile(null);
    setDeliveryFile(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setContentKind("artwork");
    setPhysicalDetails({
      materials: "",
      dimensions: "",
      edition_notes: "",
      condition: "",
      shipping_regions: "",
      care_instructions: "",
      extra_notes: "",
    });
    setShippingProfile({
      origin: "",
      processing_window: "",
      carrier_preferences: "",
      approval_required: true,
    });
    setCreatorNotes("");
    if (coverFileRef.current) coverFileRef.current.value = "";
    if (deliveryFileRef.current) deliveryFileRef.current.value = "";
    if (galleryFilesRef.current) galleryFilesRef.current.value = "";
    setStep(0);
    setUploadErr(null);
    setIsUploading(false);
  };

  const handlePublish = async () => {
    if (form.type === "auction") {
      setUploadErr(LEGACY_AUCTION_DISABLED_MESSAGE);
      toast.error(LEGACY_AUCTION_DISABLED_MESSAGE);
      return;
    }

    if (!coverFile) {
      toast.error("Add a cover or artwork file before publishing.");
      return;
    }

    if (requiresSeparateDelivery && !deliveryFile) {
      toast.error(contentKind === "ebook" ? "Add the ebook file before publishing." : "Add the downloadable file before publishing.");
      return;
    }
    
    // Validate form before uploading
    if (!form.title.trim()) {
      toast.error("Drop title is required");
      return;
    }
    
    const requiresPrice =
      form.type !== "campaign" ||
      form.entryMode === "eth" ||
      form.entryMode === "both";

    if (requiresPrice) {
      if (!form.price || form.price.trim() === "") {
        toast.error("Price is required");
        return;
      }
      
      // Validate price is a valid decimal number
      if (!/^\d+(\.\d+)?$/.test(form.price.trim())) {
        toast.error(`Invalid price format: "${form.price}". Use a decimal number (e.g., "0.05")`);
        return;
      }
    }
    
    if (!form.supply || Number(form.supply) <= 0) {
      toast.error("Supply must be greater than 0");
      return;
    }
    
    if (form.type !== "campaign" && (!form.duration || Number(form.duration) <= 0)) {
      toast.error("Duration must be greater than 0");
      return;
    }

    if (form.type === "campaign") {
      if (!form.startAt || !form.endAt) {
        toast.error("Campaign start and end times are required.");
        return;
      }

      const campaignStart = new Date(form.startAt).getTime();
      const campaignEnd = new Date(form.endAt).getTime();
      if (!Number.isFinite(campaignStart) || !Number.isFinite(campaignEnd)) {
        toast.error("Campaign dates are invalid.");
        return;
      }
      if (campaignEnd <= campaignStart) {
        toast.error("Campaign end must be after the start time.");
        return;
      }
    }

    if (
      releaseType === "collectible" &&
      form.type === "buy" &&
      (!artistContractAddress || artistContractAddress === ZERO_ADDRESS)
    ) {
      alert("Your artist contract has not been deployed yet. Please ask an admin to approve and deploy your contract first.");
      return;
    }
    
    if (!isConnected) {
      connectWallet();
      return;
    }
    setIsUploading(true); setUploadErr(null);
    try {
      if (isPhysicalRelease) {
        if (!coverFile) {
          throw new Error("Add the onchain art cover before publishing.");
        }
        if (!ADMIN_WALLET) {
          throw new Error("VITE_ADMIN_WALLET is required for escrow release creation.");
        }
        if (!CREATIVE_RELEASE_ESCROW_ADDRESS || CREATIVE_RELEASE_ESCROW_ADDRESS === ZERO_ADDRESS) {
          throw new Error("VITE_CREATIVE_RELEASE_ESCROW_ADDRESS is not configured yet.");
        }

        const persistedArtist = await dbGetArtistProfile(address);
        if (!persistedArtist?.id) {
          throw new Error("Artist profile was not found in the database. Save your profile and try again.");
        }

        const uploadResult = await withArtistUploadSession(async () => {
          toast.info("Uploading onchain art cover...");
          const imageCid = await uploadFileToPinata(coverFile);
          const imageUri = `ipfs://${imageCid}`;
          const galleryUris: string[] = [];
          const deliveryAssetType = deliveryFile ? detectAssetTypeFromFile(deliveryFile) : null;

          for (const file of galleryFiles) {
            const galleryCid = await uploadFileToPinata(file);
            galleryUris.push(`ipfs://${galleryCid}`);
          }

          let nextDeliveryUri: string | null = null;
          if (releaseType === "hybrid" && deliveryFile) {
            toast.info("Uploading gated delivery asset...");
            const deliveryCid = await uploadFileToPinata(deliveryFile);
            nextDeliveryUri = `ipfs://${deliveryCid}`;
          }

          toast.info("Pinning release metadata...");
          const metadataUri = await uploadMetadataToPinata({
            name: form.title,
            description: form.description,
            image: imageUri,
            properties: {
              releaseType,
              contentKind,
              galleryUris,
              coverImageUri: imageUri,
              deliveryUri: nextDeliveryUri,
              deliveryAssetType,
              deliveryFileName: deliveryFile?.name || null,
              deliveryMimeType: deliveryFile?.type || null,
              physicalDetails: physicalDetails,
              shippingProfile: shippingProfile,
              creatorNotes,
            },
          });

          return {
            metadataUri,
            imageUri,
            galleryUris,
            deliveryUri: nextDeliveryUri,
            deliveryAssetType,
            deliveryFileName: deliveryFile?.name || null,
            deliveryMimeType: deliveryFile?.type || null,
            deliveryFileSize: deliveryFile?.size || null,
          };
        });

        const linkedReleaseAssetType = uploadResult.deliveryAssetType || "image";

        toast.info("Creating onchain escrow listing...");
        const onchainRelease = await createOnchainCreativeRelease({
          artist: address as `0x${string}`,
          metadataUri: uploadResult.metadataUri,
          priceEth: form.price,
          supply: Number(form.supply),
          adminWallet: ADMIN_WALLET as `0x${string}`,
          account: address as `0x${string}`,
        });

        const releaseRecord = await createCreativeRelease({
          artist_id: persistedArtist.id,
          release_type: releaseType,
          title: form.title,
          description: form.description,
          status: "published",
          price_eth: Number(form.price),
          supply: Number(form.supply),
          sold: 0,
          art_metadata_uri: uploadResult.metadataUri,
          cover_image_uri: uploadResult.imageUri,
          contract_kind: "creativeReleaseEscrow",
          contract_address: CREATIVE_RELEASE_ESCROW_ADDRESS,
          contract_listing_id: onchainRelease.contractListingId,
          physical_details_jsonb: {
            ...physicalDetails,
            gallery_count: uploadResult.galleryUris.length,
          },
          shipping_profile_jsonb: shippingProfile,
          creator_notes: creatorNotes,
          metadata: {
            release_source: "artist_studio",
            delivery_uri: uploadResult.deliveryUri,
            content_kind: contentKind,
            delivery_asset_type: uploadResult.deliveryAssetType,
            delivery_file_name: uploadResult.deliveryFileName,
            delivery_mime_type: uploadResult.deliveryMimeType,
          },
          published_at: new Date().toISOString(),
        });

        if (!releaseRecord?.id) {
          throw new Error("Failed to save the creative release record.");
        }

        const createdProduct = await dbCreateProduct({
          artist_id: persistedArtist.id,
          creative_release_id: releaseRecord.id,
          creator_wallet: address.toLowerCase(),
          name: form.title,
          description: form.description,
          category: releaseType === "hybrid" ? "Hybrid Collectible" : "Merchandise",
          product_type: releaseType,
          asset_type: linkedReleaseAssetType,
          price_eth: Number(form.price),
          stock: Number(form.supply),
          sold: 0,
          image_url: ipfsToHttp(uploadResult.imageUri),
          image_ipfs_uri: uploadResult.imageUri,
          preview_uri: uploadResult.imageUri,
          delivery_uri: uploadResult.deliveryUri,
          is_gated: Boolean(uploadResult.deliveryUri),
          status: "published",
          contract_kind: "creativeReleaseEscrow",
          contract_listing_id: onchainRelease.contractListingId,
          metadata_uri: uploadResult.metadataUri,
          metadata: {
            release_type: releaseType,
            contract_listing_id: onchainRelease.contractListingId,
            art_metadata_uri: uploadResult.metadataUri,
            content_kind: contentKind,
            delivery_asset_type: uploadResult.deliveryAssetType,
            delivery_file_name: uploadResult.deliveryFileName,
            delivery_mime_type: uploadResult.deliveryMimeType,
          },
        });

        if (!createdProduct?.id) {
          throw new Error("Failed to create the linked product row.");
        }

        const createdDrop = await dbCreateDrop({
          artist_id: persistedArtist.id,
          creative_release_id: releaseRecord.id,
          title: form.title,
          description: form.description,
          price_eth: Number(form.price),
          supply: Number(form.supply),
          sold: 0,
          image_url: ipfsToHttp(uploadResult.imageUri),
          image_ipfs_uri: uploadResult.imageUri,
          metadata_ipfs_uri: uploadResult.metadataUri,
          preview_uri: uploadResult.imageUri,
          delivery_uri: uploadResult.deliveryUri,
          asset_type: linkedReleaseAssetType,
          is_gated: Boolean(uploadResult.deliveryUri),
          status: "published",
          type: "drop",
          contract_address: CREATIVE_RELEASE_ESCROW_ADDRESS,
          contract_drop_id: onchainRelease.contractListingId,
          contract_kind: "creativeReleaseEscrow",
          metadata: {
            source_kind: "release_product",
            source_product_id: createdProduct.id,
            creative_release_id: releaseRecord.id,
            contract_listing_id: onchainRelease.contractListingId,
            release_type: releaseType,
            product_type: releaseType,
            content_kind: contentKind,
            delivery_uri: uploadResult.deliveryUri,
            delivery_asset_type: uploadResult.deliveryAssetType,
            delivery_file_name: uploadResult.deliveryFileName,
            delivery_mime_type: uploadResult.deliveryMimeType,
            physical_details_jsonb: physicalDetails,
            shipping_profile_jsonb: shippingProfile,
          },
        });

        if (!createdDrop?.id) {
          throw new Error("Hybrid release minted, but the linked drop record could not be saved.");
        }

        const productAssetsPayload = [
          {
            product_id: createdProduct.id,
            role: "hero_art",
            visibility: "public",
            asset_type: "image",
            uri: uploadResult.imageUri,
            preview_uri: uploadResult.imageUri,
            is_primary: true,
            sort_order: 0,
            metadata: {
              release_type: releaseType,
            },
          },
          ...uploadResult.galleryUris.map((uri, index) => ({
            product_id: createdProduct.id,
            role: "physical_photo",
            visibility: "public",
            asset_type: "image",
            uri,
            preview_uri: uri,
            is_primary: false,
            sort_order: index + 1,
          })),
          ...(uploadResult.deliveryUri
            ? [{
                product_id: createdProduct.id,
                role: "delivery",
                visibility: "gated",
                asset_type: toProductAssetKind(linkedReleaseAssetType, contentKind),
                uri: uploadResult.deliveryUri,
                preview_uri: uploadResult.imageUri,
                mime_type: uploadResult.deliveryMimeType,
                file_name: uploadResult.deliveryFileName,
                file_size_bytes: uploadResult.deliveryFileSize,
                is_primary: false,
                sort_order: uploadResult.galleryUris.length + 1,
                metadata: {
                  content_kind: contentKind,
                  delivery_asset_type: uploadResult.deliveryAssetType,
                },
              }]
            : []),
        ];
        await createProductAssets(productAssetsPayload);

        toast.success(
          releaseType === "hybrid"
            ? "Hybrid release minted, saved to drops, linked to the product catalog, and published."
            : "Physical release minted, saved to drops, and published."
        );
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["products"] }),
          queryClient.invalidateQueries({ queryKey: ["drops"] }),
        ]);
        resetComposerState();
        onClose();
        return;
      }

      const { uri, imageUri, deliveryUri, previewUri, assetType } = await withArtistUploadSession(async () => {
        toast.info(requiresSeparateDelivery ? "Uploading cover artwork to IPFS..." : "Uploading artwork to IPFS...");
        const assetFile = deliveryFile || coverFile;
        const nextAssetType = detectAssetTypeFromFile(assetFile);
        const imageCid = await uploadFileToPinata(coverFile);
        const nextImageUri = `ipfs://${imageCid}`;
        let nextDeliveryUri = nextImageUri;

        if (requiresSeparateDelivery && deliveryFile) {
          toast.info(contentKind === "ebook" ? "Uploading ebook file..." : "Uploading delivery file...");
          const deliveryCid = await uploadFileToPinata(deliveryFile);
          nextDeliveryUri = `ipfs://${deliveryCid}`;
        }

        const nextPreviewUri =
          requiresSeparateDelivery || nextAssetType === "image"
            ? nextImageUri
            : undefined;
        toast.info("Pinning metadata...");
        const nextUri = await uploadMetadataToPinata({
          name: form.title,
          description: form.description,
          image: nextPreviewUri || (nextAssetType === "image" ? nextImageUri : undefined),
          animation_url: nextAssetType !== "image" ? nextDeliveryUri : undefined,
          properties: {
            contentKind,
            assetType: nextAssetType,
            coverImageUri: nextPreviewUri || null,
            deliveryUri: nextDeliveryUri,
            previewUri: nextPreviewUri || null,
            isDownloadable: requiresSeparateDelivery || nextAssetType === "digital",
          },
        });

        return {
          uri: nextUri,
          imageUri: nextImageUri,
          deliveryUri: nextDeliveryUri,
          previewUri: nextPreviewUri,
          assetType: nextAssetType,
        };
      });
      setPendingResult({
        metadataUri: uri,
        imageUri,
        deliveryUri,
        previewUri,
        assetType,
        isGated: requiresSeparateDelivery,
        mode: form.type,
        contentKind,
        campaignConfig:
          form.type === "campaign"
            ? {
                entryMode: form.entryMode,
                startAt: new Date(form.startAt).toISOString(),
                endAt: new Date(form.endAt).toISOString(),
                redeemAt: new Date(new Date(form.endAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
              }
            : null,
      });
      
      const now = Math.floor(Date.now() / 1000);
      try {
        if (form.type === "buy") {
          createDrop(uri, form.price, Number(form.supply), now, now + Number(form.duration) * 3600);
        } else if (form.type === "campaign" && pendingResult === null) {
          const startTime = Math.floor(new Date(form.startAt).getTime() / 1000);
          const endTime = Math.floor(new Date(form.endAt).getTime() / 1000);
          const redeemStartTime = endTime + 24 * 60 * 60;
          createCampaignV2({
            metadataUri: uri,
            entryMode: form.entryMode,
            maxSupply: Number(form.supply),
            ticketPriceEth:
              form.entryMode === "content" ? "0" : form.price || "0",
            startTime,
            endTime,
            redeemStartTime,
          });
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
      pendingResult?.mode === "campaign"
        ? createdCampaignV2Id
        : pendingResult?.mode === "auction"
        ? createdCampaignId
        : pendingResult?.mode === "buy"
          ? createdDropId
          : null;
    const publishSucceeded =
      pendingResult?.mode === "campaign"
        ? isCreateCampaignV2Success
        : pendingResult?.mode === "auction"
        ? isCreateCampaignSuccess
        : pendingResult?.mode === "buy"
          ? isCreateDropSuccess
          : Boolean(pendingResult?.metadataUri);

    if (
      !publishSucceeded ||
      !pendingResult?.metadataUri ||
      publishedId === null ||
      publishedId === undefined
    ) return;
    
    (async () => {
      try {
        if (!address) {
          throw new Error("Connect wallet before saving the drop.");
        }

        const persistedArtist = await dbGetArtistProfile(address);
        if (!persistedArtist?.id) {
          throw new Error("Artist profile was not found in the database. Save your profile and try again.");
        }

        const storedType = toStoredDropType(pendingResult.mode);
        const contractKind =
          pendingResult.mode === "campaign"
            ? "poapCampaignV2"
            : pendingResult.mode === "auction"
            ? "poapCampaign"
            : pendingResult.mode === "buy"
              ? "artDrop"
              : null;
        const contractAddress =
          pendingResult.mode === "campaign"
            ? POAP_CAMPAIGN_V2_ADDRESS
            : pendingResult.mode === "auction"
            ? POAP_CAMPAIGN_ADDRESS
            : pendingResult.mode === "buy"
              ? artistContractAddress
              : null;
        const startsAt = pendingResult.campaignConfig?.startAt || new Date().toISOString();
        const endsAt =
          pendingResult.campaignConfig?.endAt ||
          new Date(Date.now() + Number(form.duration) * 3600 * 1000).toISOString();
        const initialStatus = pendingResult.mode === "campaign" ? "active" : "live";
        const campaignMetadata =
          pendingResult.mode === "campaign"
            ? {
                campaign_details: sanitizeCampaignDetails(campaignDetails),
                campaign_window: {
                  entry_mode: pendingResult.campaignConfig?.entryMode || form.entryMode,
                  start_at: startsAt,
                  end_at: endsAt,
                  redeem_at: pendingResult.campaignConfig?.redeemAt || null,
                },
              }
            : {};

        const persistedImageUri =
          pendingResult.previewUri ||
          (pendingResult.assetType === "image" ? pendingResult.imageUri : null);
        const persistedImageUrl = persistedImageUri
          ? ipfsToHttp(persistedImageUri)
          : undefined;

        const savedDrop = await dbCreateDrop({
          artist_id: persistedArtist.id,
          title: form.title,
          description: form.description,
          price_eth: parseFloat(form.price || "0"),
          supply: Number(form.supply),
          status: initialStatus,
          type: storedType,
          image_url: persistedImageUrl,
          metadata_ipfs_uri: pendingResult.metadataUri,
          image_ipfs_uri: persistedImageUri,
          asset_type: pendingResult.assetType,
          preview_uri: pendingResult.previewUri,
          delivery_uri: pendingResult.deliveryUri,
          is_gated: pendingResult.isGated,
          contract_address: contractAddress,
          contract_drop_id: publishedId,
          contract_kind: contractKind,
          ends_at: endsAt,
          metadata: campaignMetadata,
        });

        if (savedDrop) {
          if (contractKind === "artDrop" && publishedId !== null) {
            await updateArtistDropContractId(savedDrop.id, publishedId);
          }

          onCreated({
            id: savedDrop.id,
            title: form.title,
            price: form.price || "0",
            supply: Number(form.supply),
            sold: 0,
            status: getStudioDropDisplayStatus({
              type: storedType,
              status: initialStatus,
              ends_at: endsAt,
              metadata: campaignMetadata,
            }),
            type: pendingResult.mode,
            endsIn: `${Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60)))}h`,
            revenue: "0",
            image: persistedImageUrl ?? null,
            metadataUri: pendingResult.metadataUri,
            imageUri: persistedImageUri || undefined,
            assetType: pendingResult.assetType,
            previewUri: pendingResult.previewUri,
            deliveryUri: pendingResult.deliveryUri,
            isGated: pendingResult.isGated,
            contractAddress: contractAddress ?? null,
            contractDropId: publishedId,
            contractKind: contractKind ?? undefined,
            metadata: campaignMetadata,
          });
          toast.success(
            pendingResult.mode === "campaign"
              ? "Campaign saved and published."
              : "Drop minted and saved to database."
          );
          
          // Clear pending mint state so this effect cannot replay on rerender.
          setPendingResult(null);
          resetComposerState();
          onClose();
        }
      } catch (dbError) {
        console.error("âŒ Failed to save drop to database:", dbError);
        toast.error(dbError instanceof Error ? dbError.message : "Drop minted but failed to save to database. Please refresh.");
        setPendingResult(null);
        setIsUploading(false);
      }
    })();
  }, [
    address,
    artistContractAddress,
    createdCampaignId,
    createdCampaignV2Id,
    createdDropId,
    form,
    isCreateCampaignSuccess,
    isCreateCampaignV2Success,
    isCreateDropSuccess,
    onClose,
    onCreated,
    pendingResult,
    campaignDetails,
    coverPreview,
  ]);

  const activePublishError =
    form.type === "campaign"
      ? createCampaignV2Error
      : form.type === "auction"
        ? createCampaignError
        : createDropError;
  const isPending = isCreateDropPending || isCreateCampaignPending || isCreateCampaignV2Pending;
  const isConfirming = isCreateDropConfirming || isCreateCampaignConfirming || isCreateCampaignV2Confirming;
  const busy =
    isUploading ||
    isCreateDropPending ||
    isCreateDropConfirming ||
    isCreateCampaignPending ||
    isCreateCampaignConfirming ||
    isCreateCampaignV2Pending ||
    isCreateCampaignV2Confirming;
  const publishButtonContent = isUploading
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading to IPFS...</>
    : isCreateDropPending || isCreateCampaignPending || isCreateCampaignV2Pending
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirm in wallet...</>
    : isCreateDropConfirming || isCreateCampaignConfirming || isCreateCampaignV2Confirming
    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publishing...</>
    : isPhysicalRelease
    ? <><Package className="h-4 w-4 mr-2" />Create Release</>
    : form.type === "buy"
    ? <><Zap className="h-4 w-4 mr-2" />Mint & Publish</>
    : form.type === "campaign"
    ? <><Award className="h-4 w-4 mr-2" />Publish Campaign</>
    : <><AlertTriangle className="h-4 w-4 mr-2" />Auction Paused</>;
  const canNext0 = !!coverFile && (!requiresSeparateDelivery || !!deliveryFile);
  const canNext1 = form.type === "campaign"
    ? Boolean(form.title && form.supply && form.startAt && form.endAt)
    : Boolean(form.title && form.price);

  return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Release</DialogTitle>
          {/* Step dots */}
          <div className="flex gap-2 mt-2">
            {["Content", "Details", "Publish"].map((s, i) => (
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
              <div className="mb-4">
                <Label className="text-xs">Release type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    ["collectible", "Collectible"],
                    ["physical", "Merchandise"],
                    ["hybrid", "Hybrid collectible"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setReleaseType(value)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        releaseType === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <Label className="text-xs">What are you publishing?</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    ["artwork", "Artwork"],
                    ["ebook", "eBook"],
                    ["downloadable", "Tool"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => {
                        setContentKind(value);
                        setCoverFile(null);
                        setDeliveryFile(null);
                        setCoverPreview(null);
                        if (coverFileRef.current) coverFileRef.current.value = "";
                        if (deliveryFileRef.current) deliveryFileRef.current.value = "";
                      }}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        contentKind === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                ref={coverFileRef}
                type="file"
                accept={contentKind === "artwork" ? "image/*,video/*,audio/*,.pdf,.epub" : "image/*"}
                className="hidden"
                onChange={handleCoverFile}
              />
              <input
                ref={deliveryFileRef}
                type="file"
                accept={contentKind === "ebook" ? ".pdf,.epub,application/pdf,application/epub+zip" : "*"}
                className="hidden"
                onChange={handleDeliveryFile}
              />
              <input
                ref={galleryFilesRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryFiles}
              />
              <div className="mb-3 rounded-xl border border-border bg-secondary/20 p-3">
                <p className="text-sm font-semibold text-foreground">{coverLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">{coverHelpText}</p>
              </div>
              {coverFile ? (
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  {renderCoverPreview("full")}
                  <button onClick={() => { setPreview(null); setFile(null); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 text-xs">âœ•</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full aspect-square rounded-xl border-2 border-dashed border-border bg-secondary/40 flex flex-col items-center justify-center gap-3 hover:bg-secondary/70 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload artwork</p>
                    <p className="text-xs text-muted-foreground">PNG / JPG / GIF / MP4 / Max 10MB</p>
                  </div>
                </button>
              )}
              {coverFile && !coverPreview && (
                <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-3">
                  <p className="text-xs font-semibold text-foreground">{coverFile.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {contentKind === "artwork" ? "This file will be used for preview and delivery." : "This file will be used as the public cover."}
                  </p>
                </div>
              )}
              {requiresSeparateDelivery && (
                <button
                  onClick={() => deliveryFileRef.current?.click()}
                  className="mt-3 w-full rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-sm font-semibold text-foreground">{deliveryLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deliveryFile ? `${deliveryFile.name} selected` : deliveryHelpText}
                  </p>
                </button>
              )}
              {isPhysicalRelease && (
                <button
                  onClick={() => galleryFilesRef.current?.click()}
                  className="mt-3 w-full rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-sm font-semibold text-foreground">Upload physical gallery photos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {galleryFiles.length > 0 ? `${galleryFiles.length} gallery image(s) selected` : "Add extra real-world product pictures for collectors."}
                  </p>
                </button>
              )}
              {isPhysicalRelease && galleryPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {galleryPreviews.map((previewUri, index) => (
                    <img key={`${previewUri}-${index}`} src={previewUri} alt={`Gallery preview ${index + 1}`} className="h-20 w-full rounded-xl object-cover" />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {!preview && coverFile && (
                <div className="h-16 rounded-xl border border-border bg-secondary/40 px-3 flex items-center text-xs text-muted-foreground">
                  {coverFile.name}
                </div>
              )}
              {coverFile && renderCoverPreview("compact")}
              {!isPhysicalRelease && (
                <div>
                  <Label className="text-xs">Drop type</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(["buy", "auction", "campaign"] as Drop["type"][]).map((t) => {
                      const isAuctionOption = t === "auction";
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (isAuctionOption) {
                              toast.error(LEGACY_AUCTION_DISABLED_MESSAGE);
                              return;
                            }

                            setForm({ ...form, type: t });
                          }}
                          className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                            form.type === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary/50 text-muted-foreground"
                          } ${isAuctionOption ? "cursor-not-allowed opacity-60" : ""}`}
                          aria-disabled={isAuctionOption}
                        >
                          {isAuctionOption ? "auction paused" : t}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Auctions are temporarily disabled while the legacy POAP auction contract is being remediated.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-xs">Title</Label>
                <Input placeholder="e.g. Chromatic Dreams" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-9 rounded-lg text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell collectors about this pieceâ€¦"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none min-h-[72px]" />
              </div>
              {form.type === "campaign" && !isPhysicalRelease ? (
                <>
                  <div>
                    <Label className="text-xs">Entry mode</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {(["eth", "content", "both"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setForm({ ...form, entryMode: mode })}
                          className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${form.entryMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Campaign starts</Label>
                      <Input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="h-9 rounded-lg text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Campaign ends</Label>
                      <Input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="h-9 rounded-lg text-sm mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">ETH entry price</Label><Input placeholder={form.entryMode === "content" ? "0" : "0.1"} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                    <div><Label className="text-xs">POAP supply</Label><Input placeholder="50" value={form.supply} onChange={e => setForm({ ...form, supply: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                  </div>
                  <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Collector-facing campaign details</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        This replaces the generic campaign explainer on the public page, so collectors can understand this campaign in your own words.
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Details headline</Label>
                      <Input
                        value={campaignDetails.title}
                        onChange={(e) => setCampaignDetails((prev) => ({ ...prev, title: e.target.value }))}
                        className="mt-1 h-9 rounded-lg text-sm"
                        placeholder="Why this campaign matters"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Intro</Label>
                      <textarea
                        value={campaignDetails.intro}
                        onChange={(e) => setCampaignDetails((prev) => ({ ...prev, intro: e.target.value }))}
                        className="mt-1 min-h-[84px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Explain the goal, what collectors are joining, and what participation unlocks."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Primary section label</Label>
                      <Input
                        value={campaignDetails.primaryLabel}
                        onChange={(e) => setCampaignDetails((prev) => ({ ...prev, primaryLabel: e.target.value }))}
                        className="mt-1 h-9 rounded-lg text-sm"
                        placeholder="How it works"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Primary section items</Label>
                      <textarea
                        value={campaignDetailItemsToTextarea(campaignDetails.primaryItems)}
                        onChange={(e) =>
                          setCampaignDetails((prev) => ({
                            ...prev,
                            primaryItems: campaignDetailItemsFromTextarea(e.target.value, DEFAULT_CAMPAIGN_DETAILS.primaryItems),
                          }))
                        }
                        className="mt-1 min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="One collector-facing point per line"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Secondary section label</Label>
                      <Input
                        value={campaignDetails.secondaryLabel}
                        onChange={(e) => setCampaignDetails((prev) => ({ ...prev, secondaryLabel: e.target.value }))}
                        className="mt-1 h-9 rounded-lg text-sm"
                        placeholder="Collector notes"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Secondary section items</Label>
                      <textarea
                        value={campaignDetailItemsToTextarea(campaignDetails.secondaryItems)}
                        onChange={(e) =>
                          setCampaignDetails((prev) => ({
                            ...prev,
                            secondaryItems: campaignDetailItemsFromTextarea(e.target.value, DEFAULT_CAMPAIGN_DETAILS.secondaryItems),
                          }))
                        }
                        className="mt-1 min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="One collector-facing point per line"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Price (ETH)</Label><Input placeholder="0.1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                  <div><Label className="text-xs">{isPhysicalRelease ? "Processing (h)" : "Duration (h)"}</Label><Input placeholder="24" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                  <div><Label className="text-xs">Supply</Label><Input placeholder="1" value={form.supply} onChange={e => setForm({ ...form, supply: e.target.value })} className="h-9 rounded-lg text-sm mt-1" /></div>
                </div>
              )}
              {isPhysicalRelease && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Materials</Label><Input value={physicalDetails.materials} onChange={e => setPhysicalDetails((prev) => ({ ...prev, materials: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="Canvas, resin, oak..." /></div>
                    <div><Label className="text-xs">Dimensions</Label><Input value={physicalDetails.dimensions} onChange={e => setPhysicalDetails((prev) => ({ ...prev, dimensions: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="40 x 60 cm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Condition</Label><Input value={physicalDetails.condition} onChange={e => setPhysicalDetails((prev) => ({ ...prev, condition: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="New, signed, framed..." /></div>
                    <div><Label className="text-xs">Shipping regions</Label><Input value={physicalDetails.shipping_regions} onChange={e => setPhysicalDetails((prev) => ({ ...prev, shipping_regions: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="US, EU, Worldwide..." /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Edition notes</Label><Input value={physicalDetails.edition_notes} onChange={e => setPhysicalDetails((prev) => ({ ...prev, edition_notes: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="1/25, hand-finished..." /></div>
                    <div><Label className="text-xs">Care instructions</Label><Input value={physicalDetails.care_instructions} onChange={e => setPhysicalDetails((prev) => ({ ...prev, care_instructions: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="Keep dry, avoid direct sun..." /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Ships from</Label><Input value={shippingProfile.origin} onChange={e => setShippingProfile((prev) => ({ ...prev, origin: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="Lagos, Nigeria" /></div>
                    <div><Label className="text-xs">Carrier preferences</Label><Input value={shippingProfile.carrier_preferences} onChange={e => setShippingProfile((prev) => ({ ...prev, carrier_preferences: e.target.value }))} className="h-9 rounded-lg text-sm mt-1" placeholder="DHL, FedEx..." /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Creator notes</Label>
                    <textarea value={creatorNotes} onChange={e => setCreatorNotes(e.target.value)}
                      placeholder="Tell collectors what makes the physical object special."
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none min-h-[72px]" />
                  </div>
                </>
              )}
              <div className="rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                {isPhysicalRelease
                  ? "This release will mint the art onchain, show physical details on the product page, route checkout into escrow, and hold payout until admin approval."
                  : form.type === "campaign"
                  ? "Campaign rewards are credit-based: each approved content entry and each ETH purchase writes one redeemable credit into the V2 campaign flow."
                  : contentKind === "artwork"
                  ? "Artwork drops use the same media for preview and collector access."
                  : contentKind === "ebook"
                  ? "Collectors will see the cover first and unlock the ebook file after collecting."
                  : "Collectors will see the cover first and unlock the downloadable tool file after collecting."}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/50 p-3 flex gap-3">
                {coverFile && renderCoverPreview("compact")}
                <div>
                  <p className="font-bold text-sm text-foreground">{form.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{form.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">{getListingReleaseLabel(releaseType)}</Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">{contentKind}</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {form.type === "campaign" && !isPhysicalRelease ? `${form.entryMode} entry` : `${form.price} ETH`}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {form.type === "campaign" && !isPhysicalRelease
                        ? `${form.startAt ? new Date(form.startAt).toLocaleDateString() : "--"} to ${form.endAt ? new Date(form.endAt).toLocaleDateString() : "--"}`
                        : `${form.duration}h`}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">Ã—{form.supply}</Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-xs space-y-2">
                {[
                  ["Network", form.type === "campaign" && !isPhysicalRelease ? "App campaign flow" : "Base Sepolia"],
                  ["Storage", "IPFS via Pinata"],
                  ["Settlement", isPhysicalRelease ? "Escrow until admin approval" : "Immediate creator claim"],
                  ["Redemption", form.type === "campaign" && !isPhysicalRelease ? "End + 24 hours" : "Immediate after collect"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-muted-foreground"><span>{k}</span><span className="font-semibold text-foreground">{v}</span></div>
                ))}
              </div>
              {form.type === "campaign" && !isPhysicalRelease && (
                <CampaignArchitectureCard details={sanitizeCampaignDetails(campaignDetails)} />
              )}
              {uploadErr && <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs"><AlertTriangle className="h-4 w-4 shrink-0" />{uploadErr}</div>}
              {form.type === "campaign" && !isPhysicalRelease && <div className="flex gap-2 p-3 rounded-xl bg-primary/5 text-foreground text-xs"><AlertTriangle className="h-4 w-4 shrink-0 text-primary" />Campaign timing, ETH entry credits, artist-approved content credits, and redemption all run through the V2 campaign contract. App-side editing only changes the collector-facing detail card.</div>}
              {activePublishError && <p className="text-xs text-destructive">{(activePublishError as Web3Error).shortMessage ?? (activePublishError as Web3Error).message}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => setStep(1)}
                  disabled={busy}
                >
                  Back to details
                </Button>
                <Button onClick={handlePublish} disabled={busy} className="flex-1 rounded-xl gradient-primary text-primary-foreground font-bold h-11">
                  {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading to IPFSâ€¦</>
                    : isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirm in walletâ€¦</>
                    : isConfirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mintingâ€¦</>
                    : isPhysicalRelease ? <><Package className="h-4 w-4 mr-2" />Create Release</> : <><Zap className="h-4 w-4 mr-2" />Mint & Publish</>}
                </Button>
              </div>
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

// â”€â”€â”€ Main Studio Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ArtistStudioPageProps = {
  embedded?: boolean;
};

const ArtistStudioPage = ({ embedded = false }: ArtistStudioPageProps) => {
  const queryClient = useQueryClient();
  const { address, balance, disconnect } = useWallet();
  const [tab, setTab] = useState("home");
  const [drops, setDrops] = useState<Drop[]>(seedDrops);
  
  // Integration with real-time notification system
  const { 
    notifications,
    unreadCount: hookUnreadCount,
    loading: notificationsLoading,
    markAsRead 
  } = useNotifications();
  
  const [showDropSheet, setShowDropSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [copied, setCopied] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<{ avatar?: File; banner?: File }>({});
  const [portfolioMedium, setPortfolioMedium] = useState("Digital");
  const [portfolioYear, setPortfolioYear] = useState(String(new Date().getFullYear()));
  const [portfolioFiles, setPortfolioFiles] = useState<{file: File, title: string, medium: string, year: string}[]>([]);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [editingPortfolioPiece, setEditingPortfolioPiece] = useState<ArtistPortfolioItem | null>(null);

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
  const [dropDeletingId, setDropDeletingId] = useState<string | null>(null);
  const [editingCampaignDrop, setEditingCampaignDrop] = useState<Drop | null>(null);
  const [campaignEditSaving, setCampaignEditSaving] = useState(false);
  const [campaignEditForm, setCampaignEditForm] = useState<CampaignDetailForm>(DEFAULT_CAMPAIGN_DETAILS);
  const [raiseRequests, setRaiseRequests] = useState<IPCampaign[]>([]);
  const [raiseRequestsLoading, setRaiseRequestsLoading] = useState(false);
  const [raiseDialogOpen, setRaiseDialogOpen] = useState(false);
  const [raiseSubmitting, setRaiseSubmitting] = useState(false);
  const [raiseForm, setRaiseForm] = useState({
    title: "",
    summary: "",
    description: "",
    fundingTargetEth: "",
    minimumRaiseEth: "",
    unitPriceEth: "",
    totalUnits: "",
    rightsType: "creative_ip",
  });
  const { data: artistProfileRecord, refetch: refetchArtistProfile } = useSupabaseArtistByWallet(address);
  const { data: artistDropRecords, refetch: refetchArtistDrops } = useSupabaseDropsByArtist(artistProfileRecord?.id);
  const {
    data: creatorProductRecords,
    loading: creatorProductsLoading,
    refetch: refetchCreatorProducts,
  } = useSupabaseProductsByCreator(address);
  const refreshPublicDropQueries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["drops"] });
  }, [queryClient]);
  const refreshCreatorProductQueries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  }, [queryClient]);
  const ensureArtistUploadSession = useCallback(async () => {
    if (!address) {
      throw new Error("Connect wallet to upload files");
    }

    if (getRuntimeApiToken()) {
      return;
    }

    const session = await establishSecureSession(address);
    if (!session.apiToken) {
      throw new Error("Failed to establish a secure upload session");
    }
  }, [address]);
  const withArtistUploadSession = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      await ensureArtistUploadSession();

      try {
        return await task();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shouldRefreshSession =
          message.includes("401") ||
          message.includes("Missing bearer token") ||
          message.includes("Invalid or expired token");

        if (!shouldRefreshSession || !address) {
          throw error;
        }

        const session = await establishSecureSession(address, { forceRefresh: true });
        if (!session.apiToken) {
          throw error;
        }

        return await task();
      }
    },
    [address, ensureArtistUploadSession]
  );

  const fallbackArtist = useMemo(() => resolveArtistForWallet(address), [address]);
  const storedArtistContractAddress = artistProfileRecord?.contract_address || fallbackArtist.contractAddress || null;
  const deployedContractAddress = useGetArtistContract(address); // Fetch deployed contract address
  const artistContractAddress = useResolvedArtistContract(address, storedArtistContractAddress);
  const deploymentPending = false;
  const deploymentSuccess = false;
  const deploymentError = null;
  const deploymentReceipt = null;
  const deploymentHash = null;
  const deploy = async (_wallet: string) => {};
  const setDeployingArtistWallet = (_wallet: string | null) => {};
  const actualArtistDropRecords = useMemo(
    () => (artistDropRecords || []).filter((drop) => !isReleaseBackedSyntheticDrop(drop)),
    [artistDropRecords]
  );

  useEffect(() => {
    const artist = artistProfileRecord
      ? {
          ...fallbackArtist,
          id: artistProfileRecord.id,
          wallet: artistProfileRecord.wallet,
          name: artistProfileRecord.name || "",
          handle: artistProfileRecord.handle || fallbackArtist.handle,
          avatar: artistProfileRecord.avatar_url || "",
          banner: artistProfileRecord.banner_url || "",
          tag: artistProfileRecord.tag || fallbackArtist.tag,
          bio: artistProfileRecord.bio || "",
          subscriptionPrice: artistProfileRecord.subscription_price?.toString() || fallbackArtist.subscriptionPrice,
          twitterUrl: artistProfileRecord.twitter_url || "",
          instagramUrl: artistProfileRecord.instagram_url || "",
          websiteUrl: artistProfileRecord.website_url || "",
          portfolio: Array.isArray(artistProfileRecord.portfolio)
            ? artistProfileRecord.portfolio
                .map((piece, index) => {
                  const image = resolvePortfolioImage(piece as Record<string, unknown> | string | null);
                  if (!image) return null;

                  if (typeof piece === "string") {
                    return {
                      id: `portfolio-${index}`,
                      image,
                      imageUri: piece.startsWith("ipfs://") ? piece : undefined,
                      title: `Portfolio ${index + 1}`,
                      medium: "Digital",
                      year: String(new Date().getFullYear()),
                    } satisfies ArtistPortfolioItem;
                  }

                  return {
                    id: String(piece?.id || `portfolio-${index}`),
                    image,
                    imageUri: typeof piece?.imageUri === "string" ? piece.imageUri : typeof piece?.image_uri === "string" ? piece.image_uri : undefined,
                    metadataUri:
                      typeof piece?.metadataUri === "string"
                        ? piece.metadataUri
                        : typeof piece?.metadata_uri === "string"
                          ? piece.metadata_uri
                          : undefined,
                    title: typeof piece?.title === "string" && piece.title.trim() ? piece.title : `Portfolio ${index + 1}`,
                    medium: typeof piece?.medium === "string" && piece.medium.trim() ? piece.medium : "Digital",
                    year: typeof piece?.year === "string" && piece.year.trim() ? piece.year : String(new Date().getFullYear()),
                  } satisfies ArtistPortfolioItem;
                })
                .filter((piece): piece is ArtistPortfolioItem => Boolean(piece))
            : [],
          defaultPoapAllocation: (artistProfileRecord.poap_allocation as StudioArtistProfile["defaultPoapAllocation"]) || fallbackArtist.defaultPoapAllocation,
          contractAddress: artistProfileRecord.contract_address || null,
        }
      : fallbackArtist;

    const artistDrops = artistProfileRecord?.id
      ? actualArtistDropRecords.map((drop) => ({
          id: drop.id,
          title: drop.title || "Untitled Drop",
          price: String(drop.price_eth || 0),
          supply: drop.supply ?? 1,
          sold: drop.sold ?? 0,
          status: getStudioDropDisplayStatus({
            type: drop.type,
            status: drop.status,
            ends_at: drop.ends_at,
            metadata: (drop.metadata as Record<string, unknown> | undefined) || null,
          }),
          type: fromStoredDropType(drop.type),
          endsIn: drop.ends_at
            ? `${Math.max(0, Math.floor((new Date(drop.ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h`
            : "--",
          revenue: String(drop.price_eth || 0),
          image: resolveDropCoverImage({
            assetType: (drop.asset_type as AssetType | undefined) || "image",
            previewUri: drop.preview_uri,
            imageUrl: drop.image_url,
            imageIpfsUri: drop.image_ipfs_uri,
            deliveryUri: drop.delivery_uri,
            metadata: (drop.metadata as Record<string, unknown> | undefined) || null,
          }),
          metadataUri: drop.metadata_ipfs_uri || "",
          imageUri: drop.image_ipfs_uri || undefined,
          assetType: (drop.asset_type as AssetType) || "image",
          previewUri: drop.preview_uri || undefined,
          deliveryUri: drop.delivery_uri || undefined,
          isGated: drop.is_gated || false,
          contractAddress: drop.contract_address || null,
          contractDropId: drop.contract_drop_id ?? null,
          contractKind: (drop.contract_kind as "artDrop" | "poapCampaign" | "poapCampaignV2" | null) || null,
          metadata: (drop.metadata as Record<string, unknown> | undefined) || {},
        }))
      : getArtistDrops(artist.id).map((drop) => ({
          id: drop.id,
          title: drop.title,
          price: drop.priceEth,
          supply: drop.maxBuy ?? 1,
          sold: drop.bought ?? 0,
          status: drop.status === "upcoming" ? "upcoming" : drop.status === "draft" ? "draft" : drop.status === "ended" ? "ended" : "live",
          type: fromStoredDropType(drop.type),
          endsIn: drop.endsIn,
          revenue: drop.currentBidEth ?? drop.priceEth,
          image: drop.image,
          metadataUri: drop.metadataUri,
          imageUri: drop.imageUri,
          assetType: drop.assetType,
          previewUri: drop.previewUri,
          deliveryUri: drop.deliveryUri,
          isGated: drop.isGated,
          contractAddress: drop.contractAddress,
          contractDropId: drop.contractDropId,
          contractKind: drop.contractKind,
          metadata: drop.metadata || {},
        }));

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
    setDrops(artistDrops);
    setProfileComplete(Boolean(artist.name && artist.handle));
  }, [address, artistProfileRecord, actualArtistDropRecords, fallbackArtist]);

  useEffect(() => {
    if (!artistProfileRecord?.id) {
      setRaiseRequests([]);
      return;
    }

    let cancelled = false;
    setRaiseRequestsLoading(true);

    getIPCampaigns({ artistId: artistProfileRecord.id })
      .then((campaigns) => {
        if (!cancelled) {
          setRaiseRequests(campaigns);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load raise requests:", error);
          toast.error(error instanceof Error ? error.message : "Failed to load raise requests");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRaiseRequestsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistProfileRecord?.id]);

  // â”€â”€â”€ Handle Contract Deployment Success â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (import.meta.env.DEV && (deploymentPending || deploymentSuccess || deploymentError)) {
      console.log("Deployment status:", {
        deploymentSuccess,
        deployedContractAddress,
        hashExists: !!deploymentHash,
        receiptExists: !!deploymentReceipt,
        deploymentPending,
        deploymentError,
      });
    }

    if (!deploymentSuccess) return;
    if (!deployedContractAddress) return;
    if (!deploymentReceipt) {
      console.warn("âš ï¸  Receipt not available yet, waiting for confirmation...");
      return;
    }

    (async () => {
      try {
        const contractAddress = deployedContractAddress;
        console.log("âœ… Contract deployment confirmed! Address:", contractAddress);

        // Update artist profile with contract address
        await updateArtistProfile(address, {
          contractAddress: contractAddress,
        });

        console.log("ðŸ’¾ Artist profile updated with contract address");
        toast.success("ðŸŽ‰ Artist contract deployed successfully!");
        
        // Re-fetch profile to show contract address
        await refetchArtistProfile();
        const updatedArtist = resolveArtistForWallet(address);
        console.log("ðŸ”„ Updated artist record:", updatedArtist);
        setProfile((prev) => ({ ...prev })); // Force refresh
      } catch (err) {
        console.error("âŒ Failed to update artist with contract address:", err);
        toast.error("Contract deployed but failed to save address");
      } finally {
        setDeployingArtistWallet(null);
      }
    })();
  }, [deploymentSuccess, deploymentReceipt, deployedContractAddress, address, deploymentPending, refetchArtistProfile]);

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
        const avatarCid = await withArtistUploadSession(() => uploadFileToPinata(pendingImages.avatar!));
        avatarPreview = toGatewayUrl(avatarCid);
      }
      if (pendingImages.banner) {
        const bannerCid = await withArtistUploadSession(() => uploadFileToPinata(pendingImages.banner!));
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

      // âœ¨ Profile saved successfully
      setProfileSaving(false);
      setProfileSaved(true);
      setProfileComplete(true);
      toast.success("Profile saved!");
      setTimeout(() => setProfileSaved(false), 2000);
      await refetchArtistProfile();

      // âœ¨ NEW: Deploy artist contract if not already deployed (async, doesn't block profile save)
      if (!artistContractAddress) {
        toast.info("Profile saved. An admin will deploy your artist contract before you can publish drops.");
      }
      if (deploymentPending && !artistContractAddress) {
        console.log("ðŸš€ Contract not found for artist, initiating deployment...");
        setDeployingArtistWallet(address);
        toast.info("ðŸš€ Deploying your artist NFT contract in the background...");
        try {
          await deploy(address);
          console.log("ðŸ“¤ Deployment transaction submitted");
          // The useEffect will handle the receipt and completion
        } catch (deployErr) {
          console.error("âŒ Contract deployment failed:", deployErr);
          toast.error("Failed to deploy artist contract. You can still create drops.");
          setDeployingArtistWallet(null);
        }
      }
    } catch (error: unknown) {
      setProfileSaving(false);
      const errorMessage = error instanceof Error ? error.message : "Profile save failed";
      console.error("âŒ Profile save error:", errorMessage, error);
      toast.error(errorMessage);
      return;
    }
  };

  const addPortfolioPiece = async () => {
    if (!portfolioFiles.length) {
      toast.error("Select one or more portfolio images first");
      return;
    }

    // Validate that all files have required metadata
    const invalidFiles = portfolioFiles.filter(fileObj =>
      !fileObj.title.trim() || !fileObj.medium.trim()
    );

    if (invalidFiles.length > 0) {
      toast.error("All portfolio pieces must have a title and medium");
      return;
    }

    setPortfolioUploading(true);
    try {
      const uploadedPieces: ArtistPortfolioItem[] = [];

      for (const fileObj of portfolioFiles) {
        const imageCid = await withArtistUploadSession(() => uploadFileToPinata(fileObj.file));
        const imageUri = `ipfs://${imageCid}`;
        const metadataUri = await withArtistUploadSession(() => uploadMetadataToPinata({
          name: fileObj.title,
          image: imageUri,
          medium: fileObj.medium,
          year: fileObj.year,
        }));

        uploadedPieces.push({
          id: `portfolio-${Date.now()}-${uploadedPieces.length}`,
          image: toGatewayUrl(imageUri),
          imageUri,
          metadataUri,
          title: fileObj.title,
          medium: fileObj.medium,
          year: fileObj.year,
        });
      }

      const nextPortfolio = [...uploadedPieces.reverse(), ...profile.portfolio];
      setProfile((prev) => ({ ...prev, portfolio: nextPortfolio }));
      await saveArtistPortfolio(address, nextPortfolio);
      await refetchArtistProfile();
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

  const editPortfolioPiece = async (pieceId: string, updates: { title: string; medium: string; year: string }) => {
    try {
      const updatedPortfolio = profile.portfolio.map(piece =>
        piece.id === pieceId ? { ...piece, ...updates } : piece
      );
      setProfile((prev) => ({ ...prev, portfolio: updatedPortfolio }));
      await saveArtistPortfolio(address, updatedPortfolio);
      await refetchArtistProfile();
      setEditingPortfolioPiece(null);
      toast.success("Portfolio piece updated");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update portfolio piece";
      toast.error(errorMessage);
    }
  };

  const deletePortfolioPiece = async (pieceId: string) => {
    if (!confirm("Are you sure you want to delete this portfolio piece?")) return;

    try {
      const updatedPortfolio = profile.portfolio.filter(piece => piece.id !== pieceId);
      setProfile((prev) => ({ ...prev, portfolio: updatedPortfolio }));
      await saveArtistPortfolio(address, updatedPortfolio);
      await refetchArtistProfile();
      toast.success("Portfolio piece deleted");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete portfolio piece";
      toast.error(errorMessage);
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
  const { count: totalSubscribers = 0 } = useGetSubscriberCountFromArtistContract(artistContractAddress);
  const totalCampaignDrops = drops.filter((d) => d.type === "campaign").length;
  const creatorCatalogProducts = useMemo(
    () =>
      (creatorProductRecords || [])
        .filter((product) => Boolean(product))
        .filter((product, index, collection) => {
          const uniqueKey = product.creative_release_id || product.id;
          return collection.findIndex((candidate) => (candidate.creative_release_id || candidate.id) === uniqueKey) === index;
        }),
    [creatorProductRecords]
  );
  const hasRaiseEligibility = totalSubscribers >= 100;
  const latestRaiseRequest = useMemo(() => raiseRequests[0] || null, [raiseRequests]);
  const pendingRaiseRequest = useMemo(
    () => raiseRequests.find((campaign) => campaign.status === "review") || null,
    [raiseRequests],
  );

  const submitRaiseRequest = async () => {
    if (!artistProfileRecord?.id) {
      toast.error("Complete your artist profile before requesting a raise.");
      return;
    }

    if (!hasRaiseEligibility) {
      toast.error(`You need 100 followers to request a raise. Current followers: ${totalSubscribers}.`);
      return;
    }

    if (!raiseForm.title.trim() || !raiseForm.description.trim() || !raiseForm.fundingTargetEth.trim()) {
      toast.error("Title, description, and funding target are required.");
      return;
    }

    setRaiseSubmitting(true);
    try {
      const created = await createIPCampaign({
        artist_id: artistProfileRecord.id,
        title: raiseForm.title.trim(),
        summary: raiseForm.summary.trim() || raiseForm.title.trim(),
        description: raiseForm.description.trim(),
        campaign_type: "production_raise",
        rights_type: raiseForm.rightsType as IPCampaign["rights_type"],
        visibility: "private",
        funding_target_eth: Number(raiseForm.fundingTargetEth),
        minimum_raise_eth: raiseForm.minimumRaiseEth ? Number(raiseForm.minimumRaiseEth) : 0,
        unit_price_eth: raiseForm.unitPriceEth ? Number(raiseForm.unitPriceEth) : null,
        total_units: raiseForm.totalUnits ? Number(raiseForm.totalUnits) : null,
        metadata: {
          requested_from: "artist_studio",
          follower_count: totalSubscribers,
        },
      });

      if (!created) {
        throw new Error("Raise request was not created.");
      }

      setRaiseRequests((prev) => [created, ...prev]);
      setRaiseDialogOpen(false);
      setRaiseForm({
        title: "",
        summary: "",
        description: "",
        fundingTargetEth: "",
        minimumRaiseEth: "",
        unitPriceEth: "",
        totalUnits: "",
        rightsType: "creative_ip",
      });
      toast.success("Raise request submitted for admin approval.");
    } catch (error) {
      console.error("Failed to submit raise request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit raise request");
    } finally {
      setRaiseSubmitting(false);
    }
  };

  const openCampaignEditor = (drop: Drop) => {
    setEditingCampaignDrop(drop);
    setCampaignEditForm(extractCampaignDetails(drop.metadata));
  };

  const saveCampaignEditor = async () => {
    if (!editingCampaignDrop) return;

    setCampaignEditSaving(true);
    try {
      const nextDetails = sanitizeCampaignDetails(campaignEditForm);

      const nextMetadata = {
        ...(editingCampaignDrop.metadata || {}),
        campaign_details: nextDetails,
      };

      const updated = await dbUpdateDrop(editingCampaignDrop.id, {
        metadata: nextMetadata,
      });

      if (!updated) {
        throw new Error("Campaign details were not saved.");
      }

      setDrops((current) =>
        current.map((drop) =>
          drop.id === editingCampaignDrop.id
            ? { ...drop, metadata: nextMetadata }
            : drop
        )
      );
      setEditingCampaignDrop(null);
      toast.success("Campaign details updated.");
      await Promise.all([refetchArtistDrops(), refreshPublicDropQueries()]);
    } catch (error) {
      console.error("Failed to update campaign details:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update campaign details");
    } finally {
      setCampaignEditSaving(false);
    }
  };

  // â”€â”€ NAV ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "drops", icon: Package, label: "Drops" },
    { id: "raises", icon: Gavel, label: "Raises" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "profile", icon: Palette, label: "Profile" },
  ];

  const toggleCreatorProductVisibility = async (product: Product) => {
    const nextStatus = product.status === "draft" ? "published" : "draft";

    try {
      const updated = await dbUpdateProduct(product.id, { status: nextStatus });
      if (!updated) {
        throw new Error("Product visibility was not updated.");
      }

      toast.success(nextStatus === "published" ? "Release now appears on Drops." : "Release hidden from public Drops.");
      await Promise.all([refetchCreatorProducts(), refreshCreatorProductQueries(), refreshPublicDropQueries()]);
    } catch (error) {
      console.error("Failed to update creator product:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update release visibility");
    }
  };

  return (
    <div className={`${embedded ? "min-h-full bg-background relative" : "min-h-screen bg-background max-w-lg mx-auto relative"}`}>

      {/* â”€â”€ Studio Top Bar â”€â”€ */}
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
              {hookUnreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{hookUnreadCount}</span>
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

      {/* â”€â”€ Content â”€â”€ */}
      <main className="pb-24">

        {/* â•â•â•â•â•â•â•â• HOME TAB â•â•â•â•â•â•â•â• */}
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
                      {address?.slice(0, 8)}â€¦{address?.slice(-4)}
                      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : "â€”"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">wallet balance</p>
                </div>
              </div>
              {!profileComplete && (
                <button onClick={() => setTab("profile")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold">
                  <span>âš¡ Complete your profile to go live</span>
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
                  <p className="text-[10px] text-muted-foreground mt-0.5">Bio / links / pricing</p>
                </button>
                <button onClick={() => setTab("raises")}
                  className="p-4 rounded-2xl bg-card border border-border text-left hover:border-primary/40 transition-colors">
                  <Gavel className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">IP Raise</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Request admin approval</p>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">IP Raise eligibility</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Artists can request a tokenized production raise after reaching 100 followers.
                  </p>
                </div>
                <Badge className={hasRaiseEligibility ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                  {hasRaiseEligibility ? "Eligible" : `${totalSubscribers}/100`}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {latestRaiseRequest ? getRaiseReviewLabel(latestRaiseRequest) : "No raise request submitted yet"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {latestRaiseRequest
                      ? latestRaiseRequest.title
                      : "Once approved, admins can move the raise live for investment."}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setTab("raises")}>
                  Open
                </Button>
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

            <CampaignArchitectureCard />
            <CampaignManagementPanel artistWallet={address} />
          </div>
        )}

        {/* â•â•â•â•â•â•â•â• DROPS TAB â•â•â•â•â•â•â•â• */}
        {tab === "drops" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">My Drops</h2>
              <Button size="sm" onClick={() => setShowDropSheet(true)} className="rounded-full gradient-primary text-primary-foreground text-xs h-8 px-3">
                <Plus className="h-3.5 w-3.5 mr-1" /> New Drop
              </Button>
            </div>

            <CampaignManagementPanel artistWallet={address} />

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {["all", "live", "draft", "ended"].map(f => (
                <button key={f} className="px-3 py-1 rounded-full text-xs whitespace-nowrap capitalize bg-secondary text-muted-foreground">
                  {f}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Linked Release Catalog</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Products now publish through Drops, so manage release visibility and collector links here inside the studio.
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  Drops-first
                </Badge>
              </div>

              {creatorProductsLoading ? (
                <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading linked releases...
                </div>
              ) : creatorCatalogProducts.length === 0 ? (
                <div className="py-6 text-xs text-muted-foreground">
                  Release-linked products will appear here after you mint or create a catalog item from the studio.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {creatorCatalogProducts.map((product) => {
                    const isLive = product.status === "published" || product.status === "active";
                    const releaseLabel = getListingReleaseLabel(product.product_type || (product.creative_release_id ? "collectible" : "physical"));

                    return (
                      <div key={product.id} className="rounded-2xl border border-border bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">{product.name || "Untitled Release"}</p>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {releaseLabel}
                              </Badge>
                              <Badge variant={isLive ? "default" : "secondary"} className="text-[10px] capitalize">
                                {product.status || "draft"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {(product.description || "This release is managed from your studio and appears publicly on Drops.").slice(0, 180)}
                            </p>
                          </div>

                          <div className="grid min-w-[150px] grid-cols-2 gap-2 text-center">
                            <div className="rounded-xl bg-secondary p-2">
                              <p className="text-xs font-bold text-foreground">{product.price_eth ?? 0} ETH</p>
                              <p className="text-[9px] text-muted-foreground">Price</p>
                            </div>
                            <div className="rounded-xl bg-secondary p-2">
                              <p className="text-xs font-bold text-foreground">{product.sold ?? 0}/{product.stock ?? 0}</p>
                              <p className="text-[9px] text-muted-foreground">Sold</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <Link to={`/drops/${product.id}`} className="text-[10px] text-primary">
                            Open collector view
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleCreatorProductVisibility(product)}
                            className="text-[10px] text-primary"
                          >
                            {isLive ? "Hide from Drops" : "Publish to Drops"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                    {d.type === "campaign" && (
                      <button
                        onClick={() => openCampaignEditor(d)}
                        className="text-[10px] text-primary flex items-center gap-0.5"
                      >
                        <Edit3 className="h-3 w-3" /> Edit Campaign
                      </button>
                    )}
                    {d.contractAddress && (
                      <a href={`https://sepolia.basescan.org/address/${d.contractAddress}`} target="_blank" rel="noreferrer"
                        className="text-[10px] text-primary flex items-center gap-0.5">
                        <ExternalLink className="h-3 w-3" /> Basescan
                      </a>
                    )}
                    <button onClick={async () => {
                      try {
                        setDropDeletingId(d.id);
                        await deleteArtistDrop(d.id);
                        setDrops(prev => prev.filter(x => x.id !== d.id));
                        await Promise.all([refetchArtistDrops(), refreshPublicDropQueries()]);
                        toast.success("Drop removed");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to remove drop");
                      } finally {
                        setDropDeletingId(null);
                      }
                    }}
                      disabled={dropDeletingId === d.id}
                      className="text-[10px] text-destructive flex items-center gap-0.5">
                      {dropDeletingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "raises" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">IP Raises</h2>
                <p className="text-xs text-muted-foreground">Request funding for a creative idea once you hit 100 followers.</p>
              </div>
              <Button
                size="sm"
                className="rounded-full gradient-primary text-primary-foreground"
                disabled={!hasRaiseEligibility || Boolean(pendingRaiseRequest)}
                onClick={() => setRaiseDialogOpen(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> New Request
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Followers</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{totalSubscribers}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Minimum needed: 100</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Current status</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {latestRaiseRequest ? getRaiseReviewLabel(latestRaiseRequest) : "Not started"}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {pendingRaiseRequest ? "Admin review is pending." : "Submit a request when ready."}
                </p>
              </div>
            </div>

            {!hasRaiseEligibility && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="text-sm font-semibold">Follower gate not met yet</p>
                <p className="mt-1 text-xs">
                  Your raise request unlocks at 100 followers. Current followers: {totalSubscribers}.
                </p>
              </div>
            )}

            {pendingRaiseRequest && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Review in progress</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  "{pendingRaiseRequest.title}" is waiting on admin approval before it can go live for investors.
                </p>
              </div>
            )}

            {raiseRequestsLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading raise requests...
              </div>
            ) : raiseRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Gavel className="mx-auto h-10 w-10 text-border" />
                <p className="mt-3 text-sm font-semibold text-foreground">No raise requests yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submit your idea, target raise, and IP summary for admin review.
                </p>
              </div>
            ) : (
              raiseRequests.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{campaign.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{campaign.summary || campaign.description}</p>
                    </div>
                    <Badge className={raiseStatusStyles[campaign.status || "draft"] || raiseStatusStyles.draft}>
                      {getRaiseReviewLabel(campaign)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-secondary p-2 text-center">
                      <p className="text-xs font-semibold text-foreground">{campaign.funding_target_eth || 0} ETH</p>
                      <p className="text-[10px] text-muted-foreground">Target</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2 text-center">
                      <p className="text-xs font-semibold text-foreground">{campaign.total_units || "--"}</p>
                      <p className="text-[10px] text-muted-foreground">Units</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2 text-center">
                      <p className="text-xs font-semibold text-foreground">{campaign.unit_price_eth || "--"}</p>
                      <p className="text-[10px] text-muted-foreground">Unit Price</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {campaign.metadata?.review_status === "rejected"
                      ? "Admin declined this raise request. You can refine the idea and submit again."
                      : campaign.status === "active"
                        ? "Approved by admin. This raise is ready for investor-facing wiring."
                        : "Waiting for admin review."}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â• ANALYTICS TAB â•â•â•â•â•â•â•â• */}
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

        {/* â•â•â•â•â•â•â•â• PROFILE SETUP TAB â•â•â•â•â•â•â•â• */}
        {tab === "profile" && (
          <div className="px-4 pt-4 pb-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Profile Setup</h2>
              {profileComplete && <Badge className="bg-green-100 text-green-800 text-[10px]">âœ“ Complete</Badge>}
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
                  placeholder="Tell collectors who you are and what you createâ€¦"
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
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  const currentYear = String(new Date().getFullYear());
                  const fileObjects = files.map(file => ({
                    file,
                    title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || `Portfolio Piece`,
                    medium: portfolioMedium,
                    year: portfolioYear
                  }));
                  setPortfolioFiles(fileObjects);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Default Medium (for new uploads)</Label>
                  <Input value={portfolioMedium} onChange={e => setPortfolioMedium(e.target.value)} className="h-10 rounded-xl text-sm mt-1" placeholder="Digital" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Default Year (for new uploads)</Label>
                  <Input value={portfolioYear} onChange={e => setPortfolioYear(e.target.value)} className="h-10 rounded-xl text-sm mt-1" placeholder="2026" />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => portfolioRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> {portfolioFiles.length ? `Add More Images` : "Select Images"}
                  </Button>
                </div>
              </div>

              {/* Selected files with metadata forms */}
              {portfolioFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-foreground">Selected Files ({portfolioFiles.length})</p>
                  {portfolioFiles.map((fileObj, index) => (
                    <div key={index} className="rounded-xl border border-border bg-card p-3 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={URL.createObjectURL(fileObj.file)}
                            alt={fileObj.file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                            <Input
                              value={fileObj.title}
                              onChange={e => {
                                const newFiles = [...portfolioFiles];
                                newFiles[index].title = e.target.value;
                                setPortfolioFiles(newFiles);
                              }}
                              className="h-8 rounded-lg text-sm mt-1"
                              placeholder="Enter artwork title"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Medium <span className="text-destructive">*</span></Label>
                              <Input
                                value={fileObj.medium}
                                onChange={e => {
                                  const newFiles = [...portfolioFiles];
                                  newFiles[index].medium = e.target.value;
                                  setPortfolioFiles(newFiles);
                                }}
                                className="h-8 rounded-lg text-sm mt-1"
                                placeholder="e.g. Digital, Oil, Acrylic"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Year</Label>
                              <Input
                                value={fileObj.year}
                                onChange={e => {
                                  const newFiles = [...portfolioFiles];
                                  newFiles[index].year = e.target.value;
                                  setPortfolioFiles(newFiles);
                                }}
                                className="h-8 rounded-lg text-sm mt-1"
                                placeholder="2026"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newFiles = portfolioFiles.filter((_, i) => i !== index);
                            setPortfolioFiles(newFiles);
                          }}
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Each artwork needs a title and medium. You can customize these for each piece individually.
              </p>
              <Button onClick={addPortfolioPiece} disabled={portfolioUploading || portfolioFiles.length === 0} variant="outline" className="w-full rounded-xl">
                {portfolioUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploadingâ€¦</> : <><Plus className="h-4 w-4 mr-2" />Add Portfolio Pieces ({portfolioFiles.length})</>}
              </Button>
              {profile.portfolio.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Manage Portfolio ({profile.portfolio.length} pieces)</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {profile.portfolio.map((piece) => (
                      <div key={piece.id} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                            <img src={resolvePortfolioImage(piece) || piece.image} alt={piece.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{piece.title}</p>
                                <p className="text-xs text-muted-foreground">{piece.medium} • {piece.year}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditingPortfolioPiece(piece)}
                                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                  title="Edit piece"
                                >
                                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={() => deletePortfolioPiece(piece.id)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                  title="Delete piece"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Legacy auction defaults */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legacy Auction Allocation</p>
              <p className="text-xs text-muted-foreground">These percentages only apply to the older auction campaign flow. V2 campaigns now use direct onchain ETH credits plus artist-approved content credits.</p>
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
              {profileSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Savingâ€¦</>
                : deploymentPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deploying contractâ€¦</>
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

      {/* â”€â”€ Bottom Nav â”€â”€ */}
      <nav className={`${embedded ? "sticky bottom-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border" : "fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border max-w-lg mx-auto"}`}>
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

      <Dialog open={raiseDialogOpen} onOpenChange={setRaiseDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request IP Raise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              Artists can request a raise after 100 followers. This request goes to admin for review before anything is investable.
            </div>
            <div>
              <Label className="text-xs">Idea title</Label>
              <Input value={raiseForm.title} onChange={(e) => setRaiseForm((prev) => ({ ...prev, title: e.target.value }))} className="mt-1 h-10 rounded-xl" placeholder="Short film, album, archive drop..." />
            </div>
            <div>
              <Label className="text-xs">Short summary</Label>
              <Input value={raiseForm.summary} onChange={(e) => setRaiseForm((prev) => ({ ...prev, summary: e.target.value }))} className="mt-1 h-10 rounded-xl" placeholder="What are you raising for?" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={raiseForm.description}
                onChange={(e) => setRaiseForm((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 min-h-[110px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="Explain the project, what backers are funding, and the IP/revenue idea."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Target (ETH)</Label>
                <Input value={raiseForm.fundingTargetEth} onChange={(e) => setRaiseForm((prev) => ({ ...prev, fundingTargetEth: e.target.value }))} className="mt-1 h-10 rounded-xl" type="number" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-xs">Minimum raise</Label>
                <Input value={raiseForm.minimumRaiseEth} onChange={(e) => setRaiseForm((prev) => ({ ...prev, minimumRaiseEth: e.target.value }))} className="mt-1 h-10 rounded-xl" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Unit price</Label>
                <Input value={raiseForm.unitPriceEth} onChange={(e) => setRaiseForm((prev) => ({ ...prev, unitPriceEth: e.target.value }))} className="mt-1 h-10 rounded-xl" type="number" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-xs">Total units</Label>
                <Input value={raiseForm.totalUnits} onChange={(e) => setRaiseForm((prev) => ({ ...prev, totalUnits: e.target.value }))} className="mt-1 h-10 rounded-xl" type="number" min="0" step="1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Rights type</Label>
              <select
                value={raiseForm.rightsType}
                onChange={(e) => setRaiseForm((prev) => ({ ...prev, rightsType: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="creative_ip">Creative IP</option>
                <option value="royalty_stream">Royalty stream</option>
                <option value="production_rights">Production rights</option>
                <option value="license_pool">License pool</option>
                <option value="catalog_interest">Catalog interest</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaiseDialogOpen(false)}>Cancel</Button>
            <Button
              className="gradient-primary text-primary-foreground"
              disabled={raiseSubmitting}
              onClick={submitRaiseRequest}
            >
              {raiseSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCampaignDrop)} onOpenChange={(open) => !open && setEditingCampaignDrop(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              These details are editable in the app experience only. The campaign timing and credit rules still come from the V2 contract.
            </div>
            <div>
              <Label className="text-xs">Card title</Label>
              <Input
                value={campaignEditForm.title}
                onChange={(e) => setCampaignEditForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Intro</Label>
              <textarea
                value={campaignEditForm.intro}
                onChange={(e) => setCampaignEditForm((prev) => ({ ...prev, intro: e.target.value }))}
                className="mt-1 min-h-[90px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Primary section label</Label>
              <Input
                value={campaignEditForm.primaryLabel}
                onChange={(e) => setCampaignEditForm((prev) => ({ ...prev, primaryLabel: e.target.value }))}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Primary items</Label>
              <textarea
                value={campaignDetailItemsToTextarea(campaignEditForm.primaryItems)}
                onChange={(e) =>
                  setCampaignEditForm((prev) => ({
                    ...prev,
                    primaryItems: campaignDetailItemsFromTextarea(e.target.value, DEFAULT_CAMPAIGN_DETAILS.primaryItems),
                  }))
                }
                className="mt-1 min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="One line per item"
              />
            </div>
            <div>
              <Label className="text-xs">Secondary section label</Label>
              <Input
                value={campaignEditForm.secondaryLabel}
                onChange={(e) => setCampaignEditForm((prev) => ({ ...prev, secondaryLabel: e.target.value }))}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Secondary items</Label>
              <textarea
                value={campaignDetailItemsToTextarea(campaignEditForm.secondaryItems)}
                onChange={(e) =>
                  setCampaignEditForm((prev) => ({
                    ...prev,
                    secondaryItems: campaignDetailItemsFromTextarea(e.target.value, DEFAULT_CAMPAIGN_DETAILS.secondaryItems),
                  }))
                }
                className="mt-1 min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="One line per item"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampaignDrop(null)}>
              Cancel
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              disabled={campaignEditSaving}
              onClick={saveCampaignEditor}
            >
              {campaignEditSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Notification Drawer â”€â”€ */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Notifications
              {hookUnreadCount > 0 && (
                <button 
                  onClick={() => {
                    notifications.filter(n => !n.read).forEach(n => markAsRead(n.id));
                  }}
                  className="text-xs text-primary font-normal"
                >
                  Mark all read
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${n.read ? "bg-secondary/30" : "bg-primary/5 border border-primary/20"}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    n.event_type === 'subscription' ? 'bg-purple-100'
                    : n.event_type === 'purchase' ? 'bg-green-100'
                    : n.event_type === 'investment' ? 'bg-blue-100'
                    : 'bg-amber-100'
                  }`}>
                    {n.event_type === 'subscription' ? <Users className="h-4 w-4 text-purple-600" />
                      : n.event_type === 'purchase' ? <DollarSign className="h-4 w-4 text-green-600" />
                      : n.event_type === 'investment' ? <TrendingUp className="h-4 w-4 text-blue-600" />
                      : <Award className="h-4 w-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{n.title}</p>
                    <p className="text-xs text-foreground leading-relaxed mt-0.5">{n.message || n.description}</p>
                    {n.amount_eth && <p className="text-[10px] text-primary font-semibold mt-1">{n.amount_eth} ETH</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Create Drop sheet â”€â”€ */}
      <CreateDropSheet
        open={showDropSheet}
        onClose={() => setShowDropSheet(false)}
        artistContractAddress={artistContractAddress}
        defaultPoapAllocation={profile.defaultPoapAllocation}
        withArtistUploadSession={withArtistUploadSession}
        onCreated={d => {
          setDrops(prev => [d, ...prev]);
          syncArtistDropCache({
            id: d.id,
            artistId: artistProfileRecord?.id || publicArtistId,
            title: d.title,
            artist: profile.name || "Studio Artist",
            artistAvatar: profile.avatarPreview || "",
            image: d.image || profile.bannerPreview || "",
            imageUri: d.imageUri,
            metadataUri: d.metadataUri,
            assetType: d.assetType,
            previewUri: d.previewUri,
            deliveryUri: d.deliveryUri,
            isGated: d.isGated,
            priceEth: d.price,
            currentBidEth: d.type === "auction" ? d.price : null,
            endsIn: d.endsIn,
            type: d.type === "auction" ? "Auction" : d.type === "campaign" ? "Campaign" : "Drop",
            description: profile.bio || `${d.title} by ${profile.name || "Studio Artist"}`,
            edition: `1 of ${d.supply}`,
            bids: 0,
            poap: d.type !== "buy",
            poapNote: d.type === "campaign" ? "Campaign credits come from onchain ETH entries and artist-approved content credits, then redeem 24 hours after close." : undefined,
            contractAddress: d.contractAddress ?? null,
            contractDropId: d.contractDropId ?? null,
            contractKind: d.contractKind ?? null,
            maxBuy: d.supply,
            bought: d.sold,
            status: d.status === "draft" ? "upcoming" : d.status,
          });
          void Promise.all([refetchArtistDrops(), refreshPublicDropQueries()]);
        }}
      />

      {/* Portfolio Edit Dialog */}
      <Dialog open={Boolean(editingPortfolioPiece)} onOpenChange={(open) => !open && setEditingPortfolioPiece(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-card p-4 shadow-card">
          <DialogHeader>
            <DialogTitle>Edit Portfolio Piece</DialogTitle>
          </DialogHeader>
          {editingPortfolioPiece && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                  <img src={resolvePortfolioImage(editingPortfolioPiece) || editingPortfolioPiece.image} alt={editingPortfolioPiece.title} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{editingPortfolioPiece.title}</p>
                  <p className="text-xs text-muted-foreground">{editingPortfolioPiece.medium} • {editingPortfolioPiece.year}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                  <Input
                    defaultValue={editingPortfolioPiece.title}
                    onChange={(e) => {
                      setEditingPortfolioPiece(prev => prev ? { ...prev, title: e.target.value } : null);
                    }}
                    className="h-9 rounded-lg text-sm mt-1"
                    placeholder="Enter artwork title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Medium <span className="text-destructive">*</span></Label>
                    <Input
                      defaultValue={editingPortfolioPiece.medium}
                      onChange={(e) => {
                        setEditingPortfolioPiece(prev => prev ? { ...prev, medium: e.target.value } : null);
                      }}
                      className="h-9 rounded-lg text-sm mt-1"
                      placeholder="e.g. Digital, Oil, Acrylic"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Year</Label>
                    <Input
                      defaultValue={editingPortfolioPiece.year}
                      onChange={(e) => {
                        setEditingPortfolioPiece(prev => prev ? { ...prev, year: e.target.value } : null);
                      }}
                      className="h-9 rounded-lg text-sm mt-1"
                      placeholder="2026"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPortfolioPiece(null)}>
                  Cancel
                </Button>
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() => {
                    if (!editingPortfolioPiece.title.trim() || !editingPortfolioPiece.medium.trim()) {
                      toast.error("Title and medium are required");
                      return;
                    }
                    editPortfolioPiece(editingPortfolioPiece.id, {
                      title: editingPortfolioPiece.title,
                      medium: editingPortfolioPiece.medium,
                      year: editingPortfolioPiece.year,
                    });
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArtistStudioPage;
