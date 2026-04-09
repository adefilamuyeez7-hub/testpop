import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Gavel,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { parseEther } from "viem";
import { supabase } from "@/lib/db";
import { SECURE_API_BASE } from "@/lib/apiBase";
import { resolveMediaUrl } from "@/lib/pinata";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { useWallet } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import { toast } from "@/components/ui/use-toast";
import { useCartStore } from "@/stores/cartStore";
import { useCollectionStore } from "@/stores/collectionStore";
import { CatalogItem, formatPrice, formatSupply, getCatalogPrimaryAction } from "@/utils/catalogUtils";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import {
  addProductToCart,
  buildCollectionRecord,
  resolveDiscoverPrimaryAction,
  type ActionableDiscoverDrop,
} from "@/lib/discoveryActions";

const FEED_PAGE_SIZE = 10;
const API_BASE = SECURE_API_BASE || "/api";

type DiscoverFilter = "all" | "drop" | "product" | "release";

type DiscoverPost = CatalogItem & {
  item_type: "drop" | "product" | "release";
  creator_id: string;
  creator_wallet: string;
  status?: string;
};

type CreatorProfile = {
  id: string;
  wallet?: string | null;
  name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
};

type FeedbackMessage = {
  id: string;
  body: string;
  sender_role: "creator" | "collector" | "admin";
  created_at: string;
};

type FeedbackThread = {
  id: string;
  title?: string | null;
  rating?: number | null;
  created_at: string;
  buyer_wallet: string;
  product_feedback_messages?: FeedbackMessage[];
};

type FeedbackThreadMutation = {
  id: string;
  title?: string | null;
  rating?: number | null;
  created_at?: string;
  buyer_wallet: string;
  latest_message?: FeedbackMessage | null;
};

type ItemAnalytics = {
  views: number;
  likes: number;
  comments: number;
  purchases: number;
  shares: number;
  avg_rating: number;
};

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

async function requestJson<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Request failed");
  }

  return payload as T;
}

type DiscoverFeedResponse = {
  data: DiscoverPost[];
  count?: number;
  page?: number;
  limit?: number;
};

async function trackItemEvent(
  item: Pick<DiscoverPost, "id" | "item_type">,
  eventType: "view" | "like" | "comment" | "purchase" | "share",
  data: Record<string, unknown> = {}
) {
  try {
    await requestJson("/personalization/analytics", {
      method: "POST",
      body: JSON.stringify({
        item_id: item.id,
        item_type: item.item_type,
        event_type: eventType,
        data,
      }),
    });
  } catch (error) {
    console.warn(`Failed to track ${eventType}:`, error);
  }
}

async function fetchItemAnalytics(item: Pick<DiscoverPost, "id" | "item_type">): Promise<ItemAnalytics> {
  const response = await requestJson<ItemAnalytics>(
    `/personalization/analytics/${item.id}/${item.item_type}`
  );

  return {
    views: Number(response?.views || 0),
    likes: Number(response?.likes || 0),
    comments: Number(response?.comments || 0),
    purchases: Number(response?.purchases || 0),
    shares: Number(response?.shares || 0),
    avg_rating: Number(response?.avg_rating || 0),
  };
}

async function fetchPublicComments(
  item: Pick<DiscoverPost, "id" | "item_type">,
  limit = 3
): Promise<FeedbackThread[]> {
  const { data, error } = await supabase
    .from("product_feedback_threads")
    .select(
      `
      id,
      title,
      rating,
      created_at,
      buyer_wallet,
      product_feedback_messages(id, body, sender_role, created_at)
    `
    )
    .eq("item_id", item.id)
    .eq("item_type", item.item_type)
    .eq("visibility", "public")
    .neq("status", "archived")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []) as FeedbackThread[];
}

function mergeFeedbackThreads(currentThreads: FeedbackThread[], incomingThread: FeedbackThread) {
  const filtered = currentThreads.filter((thread) => thread.id !== incomingThread.id);
  return [incomingThread, ...filtered];
}

function toFeedbackThread(thread: FeedbackThreadMutation): FeedbackThread {
  return {
    id: thread.id,
    title: thread.title || null,
    rating: thread.rating ?? null,
    created_at: thread.created_at || new Date().toISOString(),
    buyer_wallet: thread.buyer_wallet,
    product_feedback_messages: thread.latest_message ? [thread.latest_message] : [],
  };
}

async function createTrackedShare(
  item: Pick<DiscoverPost, "id" | "item_type">,
  token?: string,
  platform = "copy"
) {
  return requestJson<{
    share_url?: string;
    share_message?: string;
    platform_urls?: Record<string, string>;
  }>(
    "/personalization/share",
    {
      method: "POST",
      body: JSON.stringify({
        item_id: item.id,
        item_type: item.item_type,
        share_platform: platform,
      }),
    },
    token
  );
}

async function postPublicComment(
  post: Pick<DiscoverPost, "id" | "item_type">,
  body: string,
  token: string
) {
  const response = await requestJson<{
    success: boolean;
    thread: FeedbackThreadMutation;
  }>(
    `/fan-hub/items/${post.item_type}/${post.id}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({
        feedbackType: "review",
        visibility: "public",
        body,
      }),
    },
    token
  );

  return response.thread;
}

function truncateWallet(wallet?: string | null, start = 6, end = 4) {
  const value = String(wallet || "").trim();
  if (!value) return "Creator";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getDisplayName(post: DiscoverPost, creator?: CreatorProfile | null) {
  return creator?.name || creator?.handle || truncateWallet(creator?.wallet || post.creator_wallet);
}

function getAvatarLabel(post: DiscoverPost, creator?: CreatorProfile | null) {
  const candidate = creator?.name || creator?.handle || creator?.wallet || post.creator_wallet || post.title;
  return String(candidate || "P").trim().charAt(0).toUpperCase() || "P";
}

function getCreatorHandle(post: DiscoverPost, creator?: CreatorProfile | null) {
  return creator?.handle ? `@${creator.handle}` : truncateWallet(creator?.wallet || post.creator_wallet, 8, 4);
}

function getPostPreviewImage(post: Pick<DiscoverPost, "image_url">) {
  return resolveMediaUrl(post.image_url || "");
}

function getCreatorAvatarUrl(creator?: CreatorProfile | null) {
  return resolveMediaUrl(creator?.avatar_url || "");
}

function getItemRoute(post: DiscoverPost) {
  switch (post.item_type) {
    case "drop":
      return `/drops/${post.id}`;
    case "product":
      return `/products/${post.id}`;
    case "release":
    default:
      return `/releases/${post.id}`;
  }
}

function getPrimaryCta(post: DiscoverPost) {
  const action = getCatalogPrimaryAction(post);

  switch (action) {
    case "bid":
      return {
        action,
        label: "Bid",
        icon: Gavel,
        className: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
      };
    case "cart":
      return {
        action,
        label: "Add to cart",
        icon: ShoppingBag,
        className: "bg-[#1d4ed8] text-white hover:bg-[#1e40af]",
      };
    case "collect":
      return {
        action,
        label: "Collect",
        icon: ShoppingBag,
        className: "bg-[#1d4ed8] text-white hover:bg-[#1e40af]",
      };
    case "details":
    default:
      return {
        action: "details" as const,
        label: "View details",
        icon: ExternalLink,
        className: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      };
  }
}

function getTypePill(post: DiscoverPost) {
  switch (post.item_type) {
    case "drop":
      return {
        label: "Drop",
        className: "bg-amber-100 text-amber-900",
      };
    case "release":
      return {
        label: "Creative drop",
        className: "bg-rose-100 text-rose-900",
      };
    case "product":
    default:
      return {
        label: "Product",
        className: "bg-sky-100 text-sky-900",
      };
  }
}

function formatDateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function FeedHeader({
  filterType,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: {
  filterType: DiscoverFilter;
  onFilterChange: (nextFilter: DiscoverFilter) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  const filters: Array<{ value: DiscoverFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "drop", label: "Drops" },
    { value: "product", label: "Products" },
    { value: "release", label: "Creative Drops" },
  ];

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
              <Sparkles className="h-3.5 w-3.5" />
              Discover feed
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Scroll drops like a social timeline</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Open the artwork first, move into the right CTA fast, and share a clean drop story without leaving the feed.
              </p>
            </div>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search titles and descriptions"
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const isActive = filterType === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => onFilterChange(filter.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShareMenuButton({
  item,
  compact = false,
  fullWidth = false,
  onShared,
}: {
  item: DiscoverPost;
  compact?: boolean;
  fullWidth?: boolean;
  onShared?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = getRuntimeApiToken();

  async function handlePlatformShare(platform: "twitter" | "telegram" | "whatsapp") {
    try {
      setBusy(true);
      const data = await createTrackedShare(item, token || undefined, platform);

      const targetUrl = data?.platform_urls?.[platform] || data?.share_url;
      if (targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer,width=640,height=720");
      }

      await trackItemEvent(item, "share", { source: "discover_feed", platform });
      onShared?.();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Share failed",
        description: error instanceof Error ? error.message : "Unable to generate share link.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    try {
      const share = await createTrackedShare(item, token || undefined, "copy");
      const url = share?.share_url || `${window.location.origin}/share/${item.item_type}/${item.id}`;
      await navigator.clipboard.writeText(url);
      await trackItemEvent(item, "share", { source: "discover_feed", platform: "copy" });
      toast({
        title: "Link copied",
        description: "Share link is ready to paste anywhere.",
      });
      onShared?.();
      setOpen(false);
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access is unavailable in this browser.",
        variant: "destructive",
      });
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      return handleCopyLink();
    }

    try {
      const share = await createTrackedShare(item, token || undefined, "native");
      await navigator.share({
        title: item.title,
        text: share?.share_message || item.description || `Check out ${item.title} on POPUP`,
        url: share?.share_url || `${window.location.origin}/share/${item.item_type}/${item.id}`,
      });
      await trackItemEvent(item, "share", { source: "discover_feed", platform: "native" });
      onShared?.();
      setOpen(false);
    } catch {
      // Dismissed share sheets are non-fatal.
    }
  }

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center justify-center gap-2 rounded-full transition ${
          compact
            ? "h-10 w-10 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            : `${fullWidth ? "h-11 w-full px-4" : "h-10 px-4"} border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100`
        }`}
      >
        <Share2 className="h-4 w-4" />
        {!compact ? <span>Share</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Quick share
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </button>
          <button
            type="button"
            onClick={() => handlePlatformShare("twitter")}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Post to X
          </button>
          <button
            type="button"
            onClick={() => handlePlatformShare("telegram")}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Send to Telegram
          </button>
          <button
            type="button"
            onClick={() => handlePlatformShare("whatsapp")}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Share on WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Copy link
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DiscoverCard({
  post,
  creator,
  onOpenDetails,
  onOpenComments,
}: {
  post: DiscoverPost;
  creator?: CreatorProfile | null;
  onOpenDetails: (post: DiscoverPost) => void;
  onOpenComments: (post: DiscoverPost) => void;
}) {
  const { address, chain, isConnected, connectWallet, requestActiveChainSwitch, isSwitchingNetwork } = useWallet();
  const addItem = useCartStore((state) => state.addItem);
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const {
    mint: mintArtist,
    mintedTokenId,
    isConfirming: isMintConfirming,
    isSuccess: isMintSuccess,
  } = useMintArtist();
  const [comments, setComments] = useState<FeedbackThread[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [collectingDrop, setCollectingDrop] = useState<ActionableDiscoverDrop | null>(null);

  async function loadComments() {
    try {
      setCommentsLoading(true);
      const loadedComments = await fetchPublicComments(post, 2);
      setComments(loadedComments);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, [post.id, post.item_type]);

  useEffect(() => {
    if (!isMintSuccess || !address || !collectingDrop) {
      return;
    }

    addCollectedDrop(buildCollectionRecord(collectingDrop, address, mintedTokenId));
    void trackItemEvent(post, "purchase", { source: "discover_feed", action: "collect" });
    toast({
      title: "Collected",
      description: "This piece is now in your collection without leaving discover.",
    });
    setCollectingDrop(null);
  }, [addCollectedDrop, address, collectingDrop, isMintSuccess, mintedTokenId, post]);

  const primaryCta = getPrimaryCta(post);
  const PrimaryCtaIcon = primaryCta.icon;
  const typePill = getTypePill(post);
  const creatorAvatarUrl = getCreatorAvatarUrl(creator) || undefined;
  const previewImageUrl = getPostPreviewImage(post);

  async function handlePrimaryAction() {
    try {
      setCtaBusy(true);

      const resolvedAction = await resolveDiscoverPrimaryAction(post);

      if (resolvedAction.kind === "cart") {
        addProductToCart(addItem, resolvedAction.product, post.title, previewImageUrl || undefined);
        await trackItemEvent(post, "purchase", {
          source: "discover_feed",
          action: resolvedAction.analyticsAction,
        });
        toast({
          title: "Added to cart",
          description:
            post.item_type === "release"
              ? "This release is ready in your cart straight from discover."
              : "This product is ready in your cart straight from discover.",
        });
        return;
      }

      if (resolvedAction.kind === "details") {
        onOpenDetails(post);
        return;
      }

      if (resolvedAction.kind === "collect") {
        if (!isConnected) {
          await connectWallet();
          return;
        }

        if (chain?.id !== ACTIVE_CHAIN.id) {
          await requestActiveChainSwitch(`Collecting this drop requires ${ACTIVE_CHAIN.name}.`);
        }

        setCollectingDrop(resolvedAction.drop);
        mintArtist(
          resolvedAction.contractDropId,
          parseEther(resolvedAction.priceEth),
          resolvedAction.contractAddress,
        );
        return;
      }

      onOpenDetails(post);
    } catch (error) {
      toast({
        title: "Action unavailable",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCtaBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] transition hover:border-slate-300">
      <button
        type="button"
        onClick={() => onOpenDetails(post)}
        className="group relative block w-full overflow-hidden bg-slate-950 text-left"
      >
        <div className="min-h-[320px] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 md:min-h-[420px]">
          {previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={post.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-white/60">
              No preview yet
            </div>
          )}
        </div>

        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typePill.className}`}>
            {typePill.label}
          </span>
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90">
            {formatDateLabel(post.created_at)}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-2xl font-semibold text-white">{post.title}</h2>
              <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-white/80">
                {post.description || "Tap into the detail view to explore the story, media, and collector actions."}
              </p>
            </div>
            <div className="hidden rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm md:inline-flex">
              Open details
            </div>
          </div>
        </div>
      </button>

      <div className="space-y-4 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#0f172a] text-sm font-semibold text-white">
              {creatorAvatarUrl ? (
                <img src={creatorAvatarUrl} alt={getDisplayName(post, creator)} className="h-full w-full object-cover" />
              ) : (
                getAvatarLabel(post, creator)
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{getDisplayName(post, creator)}</p>
              <p className="text-xs text-slate-500">{getCreatorHandle(post, creator)}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Price</p>
            <p className="text-xl font-semibold text-slate-950">{formatPrice(post.price_eth)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-3">
          <button
            type="button"
            onClick={() => onOpenComments(post)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <MessageCircle className="h-4 w-4" />
            Conversation
          </button>

          <button
            type="button"
            onClick={() => void handlePrimaryAction()}
            disabled={ctaBusy || isMintConfirming || isSwitchingNetwork}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryCta.className}`}
          >
            {ctaBusy || isMintConfirming || isSwitchingNetwork ? <Loader2 className="h-4 w-4 animate-spin" /> : <PrimaryCtaIcon className="h-4 w-4" />}
            {isSwitchingNetwork
              ? "Switching..."
              : isMintConfirming
                ? "Collecting..."
                : primaryCta.label}
          </button>

          <ShareMenuButton item={post} fullWidth />
        </div>

        <div className="space-y-3">
          {commentsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversation
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              No public comments yet. The first thoughtful collector reply will set the tone here.
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{truncateWallet(comment.buyer_wallet, 8, 4)}</p>
                    <p className="text-xs text-slate-500">{formatDateLabel(comment.created_at)}</p>
                  </div>
                  {comment.rating ? (
                    <div className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      {comment.rating}/5
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {comment.product_feedback_messages?.[0]?.body || comment.title || "Collector feedback"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function DetailsModal({
  post,
  creator,
  onClose,
  onOpenComments,
}: {
  post: DiscoverPost;
  creator?: CreatorProfile | null;
  onClose: () => void;
  onOpenComments: (post: DiscoverPost) => void;
}) {
  const { address, chain, isConnected, connectWallet, requestActiveChainSwitch, isSwitchingNetwork } = useWallet();
  const addItem = useCartStore((state) => state.addItem);
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const {
    mint: mintArtist,
    mintedTokenId,
    isConfirming: isMintConfirming,
    isSuccess: isMintSuccess,
  } = useMintArtist();
  const [analytics, setAnalytics] = useState<ItemAnalytics | null>(null);
  const [comments, setComments] = useState<FeedbackThread[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [collectingDrop, setCollectingDrop] = useState<ActionableDiscoverDrop | null>(null);

  useEffect(() => {
    void trackItemEvent(post, "view", { source: "discover_modal" });

    let cancelled = false;
    Promise.all([fetchItemAnalytics(post), fetchPublicComments(post, 6)])
      .then(([nextAnalytics, nextComments]) => {
        if (cancelled) return;
        setAnalytics(nextAnalytics);
        setComments(nextComments);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load detail modal data:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [post.id, post.item_type]);

  useEffect(() => {
    if (!isMintSuccess || !address || !collectingDrop) {
      return;
    }

    addCollectedDrop(buildCollectionRecord(collectingDrop, address, mintedTokenId));
    void trackItemEvent(post, "purchase", { source: "discover_modal", action: "collect" });
    toast({
      title: "Collected",
      description: "This piece is now in your collection without leaving discover.",
    });
    setCollectingDrop(null);
  }, [addCollectedDrop, address, collectingDrop, isMintSuccess, mintedTokenId, post]);

  async function handleMessageCreator() {
    const body = messageDraft.trim();
    if (!body) {
      toast({
        title: "Write a message first",
        description: "This opens a direct creator thread, so add a real note before sending.",
      });
      return;
    }

    if (!isConnected) {
      await connectWallet();
      toast({
        title: "Wallet connection requested",
        description: "Connect your wallet, then send the message again.",
      });
      return;
    }

    const token = getRuntimeApiToken();
    if (!token) {
      toast({
        title: "Secure session pending",
        description: "Your wallet is connected. Wait a moment for secure auth to finish.",
      });
      return;
    }

    try {
      setMessageBusy(true);
      await requestJson(
        "/fan-hub/threads",
        {
          method: "POST",
          body: JSON.stringify({
            artistId: post.creator_id,
            subject: `Regarding ${post.title}`,
            body,
          }),
        },
        token
      );

      setMessageDraft("");
      toast({
        title: "Message sent",
        description: "The creator thread is open in your inbox now.",
      });
    } catch (error) {
      toast({
        title: "Unable to message creator",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setMessageBusy(false);
    }
  }

  async function handlePrimaryAction() {
    try {
      setCtaBusy(true);

      const resolvedAction = await resolveDiscoverPrimaryAction(post);

      if (resolvedAction.kind === "cart") {
        addProductToCart(addItem, resolvedAction.product, post.title, previewImageUrl || undefined);
        await trackItemEvent(post, "purchase", {
          source: "discover_modal",
          action: resolvedAction.analyticsAction,
        });
        toast({
          title: "Added to cart",
          description:
            post.item_type === "release"
              ? "This release is ready in your cart straight from discover."
              : "This product is ready in your cart straight from discover.",
        });
        return;
      }

      if (resolvedAction.kind === "details") {
        onClose();
        window.setTimeout(() => {
          window.location.assign(getItemRoute(post));
        }, 0);
        return;
      }

      if (resolvedAction.kind === "collect") {
        if (!isConnected) {
          await connectWallet();
          return;
        }

        if (chain?.id !== ACTIVE_CHAIN.id) {
          await requestActiveChainSwitch(`Collecting this drop requires ${ACTIVE_CHAIN.name}.`);
        }

        setCollectingDrop(resolvedAction.drop);
        mintArtist(
          resolvedAction.contractDropId,
          parseEther(resolvedAction.priceEth),
          resolvedAction.contractAddress,
        );
        return;
      }

      onClose();
    } catch (error) {
      toast({
        title: "Action unavailable",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCtaBusy(false);
    }
  }

  const primaryCta = getPrimaryCta(post);
  const PrimaryIcon = primaryCta.icon;
  const commentsCount = Math.max(post.comment_count || 0, analytics?.comments || 0, comments.length);
  const previewImageUrl = getPostPreviewImage(post);
  const creatorAvatarUrl = getCreatorAvatarUrl(creator);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Drop details</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{post.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[24px] bg-slate-950">
              {previewImageUrl ? (
                <img src={previewImageUrl} alt={post.title} className="h-full max-h-[420px] w-full object-cover" />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-white/60">No preview image</div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#0f172a] text-sm font-semibold text-white">
                    {creatorAvatarUrl ? (
                      <img src={creatorAvatarUrl} alt={getDisplayName(post, creator)} className="h-full w-full object-cover" />
                    ) : (
                      getAvatarLabel(post, creator)
                    )}
                  </div>
                  <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Creator</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{getDisplayName(post, creator)}</p>
                  <p className="text-sm text-slate-500">{getCreatorHandle(post, creator)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Price</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatPrice(post.price_eth)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Availability</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatSupply(post.supply_or_stock)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Public replies</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{commentsCount}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Description</p>
                <p className="text-sm leading-7 text-slate-700">
                  {post.description || "This drop is live in the social feed. Open the thread, react, or start a direct creator conversation from here."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Social signal</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">Collector momentum</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenComments(post)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversation
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrimaryAction()}
                  disabled={ctaBusy || isMintConfirming || isSwitchingNetwork}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryCta.className}`}
                >
                  {ctaBusy || isMintConfirming || isSwitchingNetwork ? <Loader2 className="h-4 w-4 animate-spin" /> : <PrimaryIcon className="h-4 w-4" />}
                  {isSwitchingNetwork
                    ? "Switching..."
                    : isMintConfirming
                      ? "Collecting..."
                      : primaryCta.label}
                </button>
                <ShareMenuButton item={post} fullWidth />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Views</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{analytics?.views || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Shares</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{analytics?.shares || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Avg rating</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {post.avg_rating || analytics?.avg_rating ? (post.avg_rating || analytics?.avg_rating || 0).toFixed(1) : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Direct message</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">Private note to the creator</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this for custom requests, subscriber questions, gifting context, or any conversation that should not be public.
              </p>

              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Ask about a commission, gifting request, or subscriber-only detail..."
                className="mt-4 min-h-[140px] w-full rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
              />

              <button
                type="button"
                onClick={() => void handleMessageCreator()}
                disabled={messageBusy || !messageDraft.trim()}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {messageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send private message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentsSheet({
  post,
  onClose,
}: {
  post: DiscoverPost;
  onClose: () => void;
}) {
  const { isConnected, connectWallet } = useWallet();
  const [comments, setComments] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);

  async function loadComments() {
    try {
      setLoading(true);
      setComments(await fetchPublicComments(post, 24));
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, [post.id, post.item_type]);

  async function handleSubmit() {
    const body = newComment.trim();
    if (!body) return;

    if (!isConnected) {
      await connectWallet();
      toast({
        title: "Wallet connection requested",
        description: "Connect your wallet, then send your comment.",
      });
      return;
    }

    const token = getRuntimeApiToken();
    if (!token) {
      toast({
        title: "Secure session pending",
        description: "Give POPUP a moment to finish secure sign-in.",
      });
      return;
    }

    try {
      setSending(true);
      const thread = await postPublicComment(post, body, token);

      await trackItemEvent(post, "comment", { source: "comments_sheet" });
      setNewComment("");
      setComments((current) => mergeFeedbackThreads(current, toFeedbackThread(thread)));
    } catch (error) {
      toast({
        title: "Unable to post comment",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full rounded-t-[32px] border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Public thread</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{post.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No public replies yet. Start the thread with a collector perspective or a thoughtful product question.
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{truncateWallet(comment.buyer_wallet, 8, 4)}</p>
                      <p className="text-xs text-slate-500">{formatDateLabel(comment.created_at)}</p>
                    </div>
                    {comment.rating ? (
                      <div className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {comment.rating}/5
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {comment.product_feedback_messages?.[0]?.body || comment.title || "Collector feedback"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={
                !isConnected
                  ? "Connect your wallet to join the conversation"
                  : "Add your public comment"
              }
              className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={sending || !newComment.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnifiedDiscoverFeed() {
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [creatorsById, setCreatorsById] = useState<Record<string, CreatorProfile>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState<DiscoverFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<DiscoverPost | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
  }, [filterType, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      if (!hasMore && page > 1) return;

      try {
        setLoading(true);

        const params = new URLSearchParams({
          page: String(Math.max(page - 1, 0)),
          limit: String(FEED_PAGE_SIZE),
          sort: "recent",
          ...(filterType !== 'all' && { type: filterType }),
          ...(searchQuery.trim() && { search: searchQuery.trim() })
        });

        const result = await requestJson<DiscoverFeedResponse>(`/discover/feed?${params}`);
        const { data } = result;

        if (!data || !Array.isArray(data)) {
          throw new Error('Invalid response format');
        }

        if (cancelled) return;

        const nextPosts = data as DiscoverPost[];
        setHasMore(nextPosts.length >= FEED_PAGE_SIZE);
        setPosts((current) => {
          const merged = page === 1 ? nextPosts : [...current, ...nextPosts];
          const unique = new Map(merged.map((item) => [`${item.item_type}:${item.id}`, item]));
          return Array.from(unique.values());
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load discover posts:", error);
          toast({
            title: "Unable to load discover feed",
            description: error instanceof Error ? error.message : "Try refreshing the page.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [page, filterType, searchQuery, hasMore]);

  useEffect(() => {
    const creatorIds = Array.from(new Set(posts.map((post) => post.creator_id).filter(Boolean)));
    if (creatorIds.length === 0) return;

    let cancelled = false;

    supabase
      .from("artists")
      .select("id, wallet, name, handle, avatar_url")
      .in("id", creatorIds)
      .then(({ data, error }) => {
        if (cancelled || error) {
          if (error) {
            console.error("Failed to load creator profiles:", error);
          }
          return;
        }

        const nextProfiles = (data || []).reduce<Record<string, CreatorProfile>>((accumulator, creator) => {
          accumulator[creator.id] = creator as CreatorProfile;
          return accumulator;
        }, {});

        setCreatorsById((current) => ({ ...current, ...nextProfiles }));
      });

    return () => {
      cancelled = true;
    };
  }, [posts]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((current) => current + 1);
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, hasMore]);

  const enrichedPosts = useMemo(
    () =>
      posts.map((post) => ({
        ...post,
        creator: creatorsById[post.creator_id] || null,
      })),
    [posts, creatorsById]
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      <FeedHeader
        filterType={filterType}
        onFilterChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
        {enrichedPosts.length === 0 && !loading ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-semibold text-slate-950">Nothing matches this filter yet.</p>
            <p className="mt-2 text-sm text-slate-500">Try a broader search or switch back to All.</p>
          </div>
        ) : null}

        {enrichedPosts.map((post) => (
          <DiscoverCard
            key={`${post.item_type}:${post.id}`}
            post={post}
            creator={post.creator}
            onOpenDetails={(currentPost) => {
              setSelectedPost(currentPost);
              setShowDetails(true);
            }}
            onOpenComments={(currentPost) => {
              setSelectedPost(currentPost);
              setShowComments(true);
            }}
          />
        ))}

        <div ref={observerTarget} className="flex items-center justify-center py-6 text-sm text-slate-500">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more drops
            </div>
          ) : hasMore ? (
            "Scroll for more"
          ) : posts.length > 0 ? (
            "You reached the end of the feed"
          ) : null}
        </div>
      </div>

      {showDetails && selectedPost ? (
        <DetailsModal
          post={selectedPost}
          creator={creatorsById[selectedPost.creator_id] || null}
          onClose={() => setShowDetails(false)}
          onOpenComments={(postToOpen) => {
            setShowDetails(false);
            setSelectedPost(postToOpen);
            setShowComments(true);
          }}
        />
      ) : null}

      {showComments && selectedPost ? (
        <CommentsSheet
          post={selectedPost}
          onClose={() => setShowComments(false)}
        />
      ) : null}
    </div>
  );
}

export default UnifiedDiscoverFeed;
