import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Gift, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resolveMediaUrl } from "@/lib/pinata";
import { buildRebootShareUrl, createRebootShare, fetchRebootCatalog, type RebootCatalogItem } from "@/lib/rebootPlatform";
import { formatPrice } from "@/utils/catalogUtils";

function getCreatorLabel(item: RebootCatalogItem) {
  const wallet = String(item.creator_wallet || "").trim();
  if (!wallet) return "Creator";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

const ROLE_PILLS = ["Guest Collector", "Creator", "Admin", "External Guest"] as const;
const CAMPAIGN_PILLS = ["Drop", "Auction", "Bid Campaign"] as const;

export default function RebootHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RebootCatalogItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [giftBusyId, setGiftBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const loaded = await fetchRebootCatalog(12);
        if (!active) return;
        setItems(loaded);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load featured projects.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const featured = useMemo(() => items.slice(0, 5), [items]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featured.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [featured.length]);

  async function handleGift(item: RebootCatalogItem) {
    try {
      setGiftBusyId(item.id);
      const share = await createRebootShare(item, "copy");
      const shareUrl = share.share_url || `${window.location.origin}${buildRebootShareUrl(item)}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Gift link copied. Share it anywhere.");
    } catch (error) {
      const fallback = `${window.location.origin}${buildRebootShareUrl(item)}`;
      await navigator.clipboard.writeText(fallback);
      toast.success("Copied fallback gift link.");
    } finally {
      setGiftBusyId(null);
    }
  }

  return (
    <div className="space-y-8 px-4 py-6 md:px-2">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-[#0b1220] via-[#0f1c34] to-[#14274a] px-6 py-8 text-white shadow-[0_34px_70px_-34px_rgba(2,6,23,0.75)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/90">POPUP Reboot</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-5xl">
          Creator-first discovery, social commerce, and onchain collection in one flow.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-200/90 md:text-base">
          Featured projects live in deck format, discovery behaves like social media, and every buyer action routes
          through a clear collect-or-checkout intent.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {ROLE_PILLS.map((pill) => (
            <span key={pill} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
              {pill}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Featured Creator Projects</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Deck Preview</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/discover")}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
          >
            Open Discover
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-slate-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
            No featured projects yet. Publish a drop or product to populate this deck.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.6)]">
              {featured.map((item, index) => {
                const isActive = index === activeIndex;
                const imageUrl = resolveMediaUrl(item.image_url || "");

                return (
                  <article
                    key={item.id}
                    className={`transition-opacity duration-500 ${isActive ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"}`}
                  >
                    <div className="relative min-h-[380px] w-full bg-slate-900">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full min-h-[380px] items-center justify-center text-sm text-white/70">
                          Media preview unavailable
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                      <div className="max-w-3xl space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            {item.item_type}
                          </span>
                          <span className="rounded-full bg-cyan-300/80 px-3 py-1 text-xs font-semibold text-slate-900">
                            {formatPrice(Number(item.price_eth || 0))}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white md:text-3xl">{item.title}</h3>
                        <p className="line-clamp-2 text-sm text-slate-200 md:text-base">
                          {item.description || "Creator-owned release ready for collect or checkout."}
                        </p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                          by {getCreatorLabel(item)}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleGift(item)}
                            disabled={giftBusyId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-70"
                          >
                            {giftBusyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                            Gift
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(item.creator_id ? `/artists/${item.creator_id}` : "/profile")}
                            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            <User className="h-4 w-4" />
                            Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {featured.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    index === activeIndex
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.title.slice(0, 20)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Creator Campaign Modes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CAMPAIGN_PILLS.map((pill) => (
            <span key={pill} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {pill}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Creators publish digital or physical content through structured campaign paths while buyers stay in one clear
          collect-or-checkout flow.
        </p>
      </section>
    </div>
  );
}
