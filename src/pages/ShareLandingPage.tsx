import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Gavel, Heart, Loader2, MessageCircle, Share2, ShoppingBag } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/db";
import { formatPrice, formatSupply } from "@/utils/catalogUtils";

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

type CreatorProfile = {
  id: string;
  name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  wallet?: string | null;
};

function truncateWallet(wallet?: string | null, start = 6, end = 4) {
  const value = String(wallet || "").trim();
  if (!value) return "Creator";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getItemRoute(item: ShareCatalogItem) {
  switch (item.item_type) {
    case "drop":
      return `/drops/${item.id}`;
    case "product":
      return `/products/${item.id}`;
    case "release":
    default:
      return `/catalog/${item.item_type}/${item.id}`;
  }
}

function getPrimaryCta(item: ShareCatalogItem) {
  if (item.item_type === "drop" && item.can_bid) {
    return { label: "Place a bid", icon: Gavel };
  }

  if (item.can_purchase) {
    return {
      label: item.item_type === "product" ? "Collect now" : "Open release",
      icon: ShoppingBag,
    };
  }

  return { label: "View details", icon: ExternalLink };
}

const ShareLandingPage = () => {
  const navigate = useNavigate();
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const [item, setItem] = useState<ShareCatalogItem | null>(null);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shareId = searchParams.get("share");
    if (!shareId) return;

    fetch(`/api/personalization/share/${shareId}/click`).catch((clickError) => {
      console.warn("Failed to track share click:", clickError);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!type || !id) return;

    let active = true;

    async function loadShareItem() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/catalog/${type}/${id}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || "Unable to load shared item.");
        }

        if (!active) return;

        setItem(payload.item || null);
        setComments(payload.comments || []);

        if (payload.item) {
          void fetch("/api/personalization/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item_id: payload.item.id,
              item_type: payload.item.item_type,
              event_type: "view",
              data: { source: "share_landing" },
            }),
          }).catch((analyticsError) => {
            console.warn("Failed to track share landing view:", analyticsError);
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
  }, [id, type]);

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

  const primaryCta = useMemo(() => (item ? getPrimaryCta(item) : null), [item]);

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
            onClick={() => navigate("/discover")}
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_25%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/94 shadow-[0_40px_120px_rgba(15,23,42,0.14)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative bg-slate-950">
              <div className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">
                <Share2 className="h-3.5 w-3.5" />
                Shared on POPUP
              </div>
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="h-full min-h-[320px] w-full object-cover" />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-white/60">No preview image</div>
              )}
            </div>

            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  {item.item_type} spotlight
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{item.title}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  {item.description || "A shared collectible from the POPUP discovery feed. Open it to explore the full deck, public conversation, and creator context."}
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-600 to-slate-900 text-sm font-semibold text-white">
                    {creator?.avatar_url ? (
                      <img src={creator.avatar_url} alt={creator.name || item.title} className="h-full w-full object-cover" />
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

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(getItemRoute(item))}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <PrimaryIcon className="h-4 w-4" />
                  {primaryCta.label}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/discover")}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Heart className="h-4 w-4" />
                  Open Discover
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Why this page exists</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Shared links that still convert</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This landing page preserves the story, creator identity, and social proof before someone commits to collecting, bidding, or opening the full product deck inside POPUP.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-sky-600" />
                  Social context
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Public comments and ratings travel with the link so off-platform visitors immediately understand why collectors care.
                </p>
              </div>
              <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShoppingBag className="h-4 w-4 text-sky-600" />
                  Direct CTA
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The primary action stays close to the media so someone coming from X, Telegram, or WhatsApp can move straight into the collectible flow.
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
                onClick={() => navigate("/discover")}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Join the feed
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No public comments yet. Open this item on POPUP to be the first voice in the thread.
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
          </div>
        </section>
      </div>
    </div>
  );
};

export default ShareLandingPage;
