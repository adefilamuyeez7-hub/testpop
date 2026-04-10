import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resolveMediaUrl } from "@/lib/pinata";
import {
  buildRebootShareUrl,
  createRebootShare,
  fetchRebootCatalog,
  resolveRebootBuyIntent,
  type RebootCatalogItem,
} from "@/lib/rebootPlatform";
import { formatPrice } from "@/utils/catalogUtils";

function formatCreatedAt(value?: string) {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Just now";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getCreatorLabel(item: RebootCatalogItem) {
  const wallet = String(item.creator_wallet || "").trim();
  if (!wallet) return "creator";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

export default function RebootDiscoverFeedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RebootCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const loaded = await fetchRebootCatalog(24);
        if (!active) return;
        setItems(loaded);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load discover feed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const posts = useMemo(() => items.filter((item) => Boolean(item.id && item.item_type)), [items]);

  async function handleBuy(item: RebootCatalogItem) {
    try {
      setBusyActionId(item.id);
      const intent = await resolveRebootBuyIntent(item);
      navigate(buildRebootShareUrl(item, intent), { state: { from: "discover-reboot" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open buy flow.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleShare(item: RebootCatalogItem) {
    try {
      setBusyActionId(item.id);
      const payload = await createRebootShare(item, "copy");
      const shareUrl = payload.share_url || `${window.location.origin}${buildRebootShareUrl(item)}`;
      const shareText = payload.share_message || `${item.title} on POPUP`;

      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied.");
    } catch {
      const fallbackUrl = `${window.location.origin}${buildRebootShareUrl(item)}`;
      await navigator.clipboard.writeText(fallbackUrl);
      toast.success("Copied fallback share link.");
    } finally {
      setBusyActionId(null);
    }
  }

  function handleComment(item: RebootCatalogItem) {
    navigate(`${buildRebootShareUrl(item, "details")}#comments`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-3 py-6 md:px-0">
      <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Discover</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Social Commerce Feed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Digital and collectible projects appear as social cards. Every post supports exactly three actions:
          comment, buy, and share.
        </p>
      </section>

      {posts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
          No posts yet. Publish a creator project to populate the discover feed.
        </div>
      ) : (
        posts.map((item) => {
          const image = resolveMediaUrl(item.image_url || "");
          const busy = busyActionId === item.id;

          return (
            <article key={item.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{getCreatorLabel(item)}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {item.item_type} · {formatCreatedAt(item.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {formatPrice(Number(item.price_eth || 0))}
                </span>
              </header>

              <div className="bg-slate-900">
                {image ? (
                  <img src={image} alt={item.title} className="h-[420px] w-full object-cover" />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-white/65">No media preview</div>
                )}
              </div>

              <div className="space-y-3 px-4 py-4">
                <h2 className="text-xl font-bold text-slate-950">{item.title}</h2>
                <p className="text-sm leading-6 text-slate-700">
                  {item.description || "Creator post ready for collector action."}
                </p>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleComment(item)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Comment
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBuy(item)}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShare(item)}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Share
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
