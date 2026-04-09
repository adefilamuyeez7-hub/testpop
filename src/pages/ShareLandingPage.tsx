import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Gavel, Loader2, MessageCircle, Share2, ShoppingBag } from "lucide-react";
import { parseEther } from "viem";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/db";
import { SECURE_API_BASE } from "@/lib/apiBase";
import { resolveMediaUrl } from "@/lib/pinata";
import { getRuntimeApiToken } from "@/lib/runtimeSession";
import { useWallet } from "@/hooks/useContracts";
import { useMintArtist } from "@/hooks/useContractsArtist";
import { toast } from "@/components/ui/use-toast";
import { useCartStore } from "@/stores/cartStore";
import { useCollectionStore } from "@/stores/collectionStore";
import { formatPrice, formatSupply, getCatalogPrimaryAction } from "@/utils/catalogUtils";
import { ACTIVE_CHAIN } from "@/lib/wagmi";
import {
  addProductToCart,
  buildCollectionRecord,
  resolveDiscoverPrimaryAction,
  type ActionableDiscoverDrop,
} from "@/lib/discoveryActions";

type ShareCatalogItem = {
  id: string;
  item_type: "drop" | "product" | "release";
  title: string;
  description?: string | null;
  image_url?: string | null;
  price_eth?: number;
  supply_or_stock?: number | null;
  creator_id?: string | null;
  creator_wallet?: string | null;
  can_purchase?: boolean;
  can_bid?: boolean;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | string | null;
  comment_count?: number;
  created_at?: string;
};

type ShareComment = {
  id: string;
  title?: string | null;
  rating?: number | null;
  buyer_wallet: string;
  product_feedback_messages?: Array<{
    id: string;
    body: string;
    created_at?: string;
  }>;
};

type ShareCommentMutation = {
  id: string;
  title?: string | null;
  rating?: number | null;
  created_at?: string;
  buyer_wallet: string;
  latest_message?: {
    id: string;
    body: string;
    created_at?: string;
  } | null;
};

type CreatorProfile = {
  id: string;
  name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  wallet?: string | null;
};

const API_BASE = SECURE_API_BASE || "/api";

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

function truncateWallet(wallet?: string | null, start = 6, end = 4) {
  const value = String(wallet || "").trim();
  if (!value) return "Creator";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getShareItemPreviewImage(item?: Pick<ShareCatalogItem, "image_url"> | null) {
  return resolveMediaUrl(item?.image_url || "");
}

function getCreatorAvatarUrl(creator?: CreatorProfile | null) {
  return resolveMediaUrl(creator?.avatar_url || "");
}

function getItemRoute(item: ShareCatalogItem) {
  switch (item.item_type) {
    case "drop":
      return `/drops/${item.id}`;
    case "product":
      return `/products/${item.id}`;
    case "release":
    default:
      return `/releases/${item.id}`;
  }
}

function getPrimaryCta(item: ShareCatalogItem) {
  const action = getCatalogPrimaryAction({
    item_type: item.item_type,
    can_bid: Boolean(item.can_bid),
    can_purchase: Boolean(item.can_purchase),
    contract_kind: item.contract_kind,
  });

  switch (action) {
    case "bid":
      return { action, label: "Bid", icon: Gavel };
    case "cart":
      return { action, label: "Add to cart", icon: ShoppingBag };
    case "collect":
      return { action, label: "Collect", icon: ShoppingBag };
    case "details":
    default:
      return { action: "details" as const, label: "View details", icon: ExternalLink };
  }
}

function buildShareFlowSearch(searchParams: URLSearchParams) {
  const nextParams = new URLSearchParams();
  const shareId = searchParams.get("share");
  const ref = searchParams.get("ref");

  if (shareId) nextParams.set("share", shareId);
  if (ref) nextParams.set("ref", ref);
  nextParams.set("from", "share");

  const serialized = nextParams.toString();
  return serialized ? `?${serialized}` : "";
}

async function trackShareLandingEvent(
  item: Pick<ShareCatalogItem, "id" | "item_type">,
  eventType: "view" | "purchase" | "comment",
  data: Record<string, unknown> = {},
) {
  try {
    await fetch(buildApiUrl("/personalization/analytics"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: item.id,
        item_type: item.item_type,
        event_type: eventType,
        data,
      }),
    });
  } catch (error) {
    console.warn(`Failed to track share landing ${eventType}:`, error);
  }
}

function mergeComments(currentComments: ShareComment[], incomingComment: ShareComment) {
  const filtered = currentComments.filter((comment) => comment.id !== incomingComment.id);
  return [incomingComment, ...filtered];
}

function toShareComment(thread: ShareCommentMutation): ShareComment {
  return {
    id: thread.id,
    title: thread.title || null,
    rating: thread.rating ?? null,
    buyer_wallet: thread.buyer_wallet,
    product_feedback_messages: thread.latest_message ? [thread.latest_message] : [],
  };
}

async function postPublicComment(
  item: Pick<ShareCatalogItem, "id" | "item_type">,
  body: string,
  token: string,
) {
  const response = await requestJson<{
    success: boolean;
    thread: ShareCommentMutation;
  }>(
    `/fan-hub/items/${item.item_type}/${item.id}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({
        feedbackType: "review",
        visibility: "public",
        body,
      }),
    },
    token,
  );

  return response.thread;
}

const ShareLandingPage = () => {
  const navigate = useNavigate();
  const { address, chain, isConnected, connectWallet, requestActiveChainSwitch, isSwitchingNetwork } = useWallet();
  const addItem = useCartStore((state) => state.addItem);
  const addCollectedDrop = useCollectionStore((state) => state.addCollectedDrop);
  const {
    mint: mintArtist,
    mintedTokenId,
    isConfirming: isMintConfirming,
    isSuccess: isMintSuccess,
  } = useMintArtist();
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const [item, setItem] = useState<ShareCatalogItem | null>(null);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [collectingDrop, setCollectingDrop] = useState<ActionableDiscoverDrop | null>(null);
  const shareFlowSearch = useMemo(() => buildShareFlowSearch(searchParams), [searchParams]);
  const shareId = searchParams.get("share");
  const referrerWallet = searchParams.get("ref");
  const previewImageUrl = useMemo(() => getShareItemPreviewImage(item), [item]);
  const creatorAvatarUrl = useMemo(() => getCreatorAvatarUrl(creator), [creator]);

  useEffect(() => {
    if (!shareId) return;

    fetch(buildApiUrl(`/personalization/share/${shareId}/click`)).catch((clickError) => {
      console.warn("Failed to track share click:", clickError);
    });
  }, [shareId]);

  useEffect(() => {
    if (!type || !id) return;

    let active = true;

    async function loadShareItem() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(buildApiUrl(`/catalog/${type}/${id}`));
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || "Unable to load shared item.");
        }

        if (!active) return;

        setItem(payload.item || null);
        setComments(payload.comments || []);

        if (payload.item) {
          void trackShareLandingEvent(payload.item, "view", {
            source: "share_landing",
            share_id: shareId,
            ref: referrerWallet,
          });
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load shared item.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadShareItem();

    return () => {
      active = false;
    };
  }, [id, referrerWallet, shareId, type]);

  useEffect(() => {
    if (!item?.creator_id) return;

    let active = true;
    supabase
      .from("artists")
      .select("id, name, handle, avatar_url, wallet")
      .eq("id", item.creator_id)
      .maybeSingle()
      .then(({ data, error: creatorError }) => {
        if (!active) return;
        if (creatorError) {
          console.error("Failed to load creator profile:", creatorError);
          return;
        }

        setCreator((data as CreatorProfile) || null);
      });

    return () => {
      active = false;
    };
  }, [item?.creator_id]);

  useEffect(() => {
    if (!item || !isMintSuccess || !address || !collectingDrop) {
      return;
    }

    addCollectedDrop(buildCollectionRecord(collectingDrop, address, mintedTokenId));
    void trackShareLandingEvent(item, "purchase", {
      source: "share_landing",
      action: "collect",
      share_id: shareId,
      ref: referrerWallet,
    });
    toast({
      title: "Collected",
      description: "This collectible was claimed directly from the shared link.",
    });
    setCollectingDrop(null);
  }, [addCollectedDrop, address, collectingDrop, isMintSuccess, item, mintedTokenId, referrerWallet, shareId]);

  const primaryCta = useMemo(() => (item ? getPrimaryCta(item) : null), [item]);

  async function handlePrimaryAction() {
    if (!item || !primaryCta) return;

    try {
      setCtaBusy(true);

      const resolvedAction = await resolveDiscoverPrimaryAction(item);

      if (resolvedAction.kind === "cart") {
        addProductToCart(addItem, resolvedAction.product, item.title, previewImageUrl || undefined);
        await trackShareLandingEvent(item, "purchase", {
          source: "share_landing",
          action: resolvedAction.analyticsAction,
          share_id: shareId,
          ref: referrerWallet,
        });
        toast({
          title: "Ready to check out",
          description:
            item.item_type === "release"
              ? "This release is now in your cart directly from the shared link."
              : "This product is now in your cart directly from the shared link.",
        });
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

      navigate(`${getItemRoute(item)}${shareFlowSearch}`);
    } catch (actionError) {
      toast({
        title: "Action unavailable",
        description: actionError instanceof Error ? actionError.message : "Unable to continue from this shared link.",
        variant: "destructive",
      });
    } finally {
      setCtaBusy(false);
    }
  }

  async function handlePostComment() {
    if (!item) return;

    const body = newComment.trim();
    if (!body) return;

    if (!isConnected) {
      await connectWallet();
      toast({
        title: "Wallet connection requested",
        description: "Connect your wallet, then post your comment from this shared page.",
      });
      return;
    }

    const token = getRuntimeApiToken();
    if (!token) {
      toast({
        title: "Secure session pending",
        description: "Your wallet is connected. Give POPUP a moment to finish secure sign-in.",
      });
      return;
    }

    try {
      setCommentBusy(true);
      const thread = await postPublicComment(item, body, token);
      setNewComment("");
      setComments((current) => mergeComments(current, toShareComment(thread)));
      await trackShareLandingEvent(item, "comment", {
        source: "share_landing",
        share_id: shareId,
        ref: referrerWallet,
      });
      toast({
        title: "Comment posted",
        description: "Your note is now part of the public conversation on this shared page.",
      });
    } catch (commentError) {
      toast({
        title: "Unable to post comment",
        description: commentError instanceof Error ? commentError.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCommentBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)]">
        <div className="rounded-[2rem] border border-white/80 bg-white/92 px-8 py-10 text-center shadow-[0_35px_120px_rgba(15,23,42,0.12)]">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-600" />
          <p className="mt-4 text-sm text-slate-600">Loading shared collectible...</p>
        </div>
      </div>
    );
  }

  if (error || !item || !primaryCta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4">
        <div className="max-w-lg rounded-[2rem] border border-white/80 bg-white/92 px-8 py-10 text-center shadow-[0_35px_120px_rgba(15,23,42,0.12)]">
          <p className="text-2xl font-semibold text-slate-950">This shared link is unavailable.</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error || "The item may have moved or is no longer public."}</p>
          <button
            type="button"
            onClick={() => navigate(`/discover${shareFlowSearch}`)}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Back to Discover
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const PrimaryIcon = primaryCta.icon;
  const actionLabel = isSwitchingNetwork
    ? "Switching..."
    : isMintConfirming
      ? "Collecting..."
      : primaryCta.label;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_25%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/94 shadow-[0_40px_120px_rgba(15,23,42,0.14)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative bg-slate-950">
              <div className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">
                <Share2 className="h-3.5 w-3.5" />
                Shared action link
              </div>
              {previewImageUrl ? (
                <img src={previewImageUrl} alt={item.title} className="h-full min-h-[320px] w-full object-cover" />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-white/60">No preview image</div>
              )}
            </div>

            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  {item.item_type === "release" ? "creative release" : `${item.item_type} spotlight`}
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{item.title}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  {item.description || "A public POPUP action page with enough context to collect, add to cart, or open the deeper thread without losing momentum."}
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-600 to-slate-900 text-sm font-semibold text-white">
                    {creatorAvatarUrl ? (
                      <img src={creatorAvatarUrl} alt={creator.name || item.title} className="h-full w-full object-cover" />
                    ) : (
                      (creator?.name || creator?.handle || creator?.wallet || item.creator_wallet || "P").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {creator?.name || creator?.handle || truncateWallet(creator?.wallet || item.creator_wallet)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {creator?.handle ? `@${creator.handle}` : truncateWallet(creator?.wallet || item.creator_wallet, 8, 4)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Price</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{formatPrice(item.price_eth)}</p>
                  </div>
                  <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Availability</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{formatSupply(item.supply_or_stock)}</p>
                  </div>
                  <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Conversation</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{Math.max(Number(item.comment_count || 0), comments.length)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => void handlePrimaryAction()}
                  disabled={ctaBusy || isMintConfirming || isSwitchingNetwork}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {ctaBusy || isMintConfirming || isSwitchingNetwork ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PrimaryIcon className="h-4 w-4" />
                  )}
                  {actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/discover${shareFlowSearch}`)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open full discover thread
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Action-link behavior</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Built to convert outside the app</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This page keeps media, creator identity, public proof, and the right commerce action together so a shared POPUP link behaves more like an onchain action card than a dead-end redirect.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShoppingBag className="h-4 w-4 text-sky-600" />
                  Immediate CTA
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Collectible drops can mint here, and commerce-backed products or releases can enter cart here, without forcing the visitor through a catalog detour first.
                </p>
              </div>
              <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-sky-600" />
                  Public social proof
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Conversation previews stay visible on the shared page, so the link carries context the way a strong social action link should.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Public thread</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">What collectors are saying</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/discover${shareFlowSearch}`)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Open full thread
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No public comments yet. Start the thread directly from this shared card.
                </div>
              ) : (
                comments.map((comment) => (
                  <article key={comment.id} className="rounded-[1.4rem] border border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{truncateWallet(comment.buyer_wallet, 8, 4)}</p>
                      {comment.rating ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          {comment.rating}/5
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {comment.product_feedback_messages?.[0]?.body || comment.title || "Collector feedback"}
                    </p>
                  </article>
                ))
              )}
            </div>

            <div className="mt-5 flex gap-3 border-t border-slate-200 pt-5">
              <input
                type="text"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handlePostComment();
                  }
                }}
                placeholder={
                  !isConnected
                    ? "Connect your wallet to join the public thread"
                    : "Add a public comment from this shared card"
                }
                className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => void handlePostComment()}
                disabled={commentBusy || !newComment.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Comment
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ShareLandingPage;
