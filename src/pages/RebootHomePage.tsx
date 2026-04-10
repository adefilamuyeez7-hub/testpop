import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Gift, Loader2, Rocket, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resolveMediaUrl } from "@/lib/pinata";
import {
  buildRebootShareUrl,
  createRebootShare,
  fetchRebootCatalog,
  REBOOT_CAMPAIGN_MODES,
  REBOOT_CREATOR_CONTENT_TYPES,
  REBOOT_USER_FLOW,
  type RebootCatalogItem,
} from "@/lib/rebootPlatform";
import { formatPrice } from "@/utils/catalogUtils";

function getCreatorLabel(item: RebootCatalogItem) {
  const wallet = String(item.creator_wallet || "").trim();
  if (!wallet) return "Creator";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

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
        const loaded = await fetchRebootCatalog(16);
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

  const featured = useMemo(() => items.slice(0, 6), [items]);
  const activeItem = featured[activeIndex] || null;

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featured.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [featured.length]);

  async function handleGift(item: RebootCatalogItem) {
    try {
      setGiftBusyId(item.id);
      const share = await createRebootShare(item, "copy");
      const shareUrl = share.share_url || `${window.location.origin}${buildRebootShareUrl(item)}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Gift link copied. Send it anywhere.");
    } catch {
      const fallback = `${window.location.origin}${buildRebootShareUrl(item)}`;
      try {
        await navigator.clipboard.writeText(fallback);
      } catch {
        // Ignore clipboard errors and still show fallback path.
      }
      toast.success("Fallback gift link is ready.");
    } finally {
      setGiftBusyId(null);
    }
  }

  function openProfile(item: RebootCatalogItem) {
    if (item.creator_id) {
      navigate(`/artists/${item.creator_id}`);
      return;
    }
    navigate("/profile");
  }

  return (
    <div className="space-y-8 px-4 py-6 md:px-2">
      <section className="overflow-hidden rounded-[28px] border border-[#1b3558] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.38),_transparent_35%),linear-gradient(135deg,_#081628_0%,_#0d2239_45%,_#17345a_100%)] px-6 py-8 text-white shadow-[0_34px_70px_-34px_rgba(2,6,23,0.8)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/90">POPUP Reboot</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">
          Build creator commerce around three surfaces: Home, Discover, and Profile.
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Homepage highlights featured projects in deck-slide format, discover works like a social feed, and profile
          becomes the operating dashboard for collectors, creators, and admins.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/discover")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
          >
            Open Discover
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Open Profile
            <User className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Featured Creator Projects</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Deck Slide Showcase</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-slate-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : !activeItem ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
            No featured projects yet. Publish a campaign and this deck updates automatically.
          </div>
        ) : (
          <div className="space-y-4">
            <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.5)]">
              <div className="grid gap-0 lg:grid-cols-[1.45fr_1fr]">
                <div className="relative min-h-[380px] bg-slate-900">
                  {resolveMediaUrl(activeItem.image_url || "") ? (
                    <img
                      src={resolveMediaUrl(activeItem.image_url || "")}
                      alt={activeItem.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/70">Media preview unavailable</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
                    {activeItem.item_type}
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Featured Now</p>
                  <h3 className="text-2xl font-bold text-slate-950">{activeItem.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {activeItem.description || "Creator-owned release ready for collect-or-checkout flow."}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-100 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Price</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{formatPrice(Number(activeItem.price_eth || 0))}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Creator</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{getCreatorLabel(activeItem)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleGift(activeItem)}
                      disabled={giftBusyId === activeItem.id}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                    >
                      {giftBusyId === activeItem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      Gift
                    </button>
                    <button
                      type="button"
                      onClick={() => openProfile(activeItem)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <div className="flex flex-wrap items-center gap-2">
              {featured.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    index === activeIndex ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.title.slice(0, 24)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">User Type Flows</p>
        <div className="grid gap-3 md:grid-cols-2">
          {REBOOT_USER_FLOW.map((flow) => (
            <article
              key={flow.id}
              className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{flow.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{flow.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(flow.route)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                  aria-label={`Open ${flow.title}`}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-3 space-y-1">
                {flow.capabilities.map((capability) => (
                  <li key={capability} className="text-xs leading-5 text-slate-600">
                    {capability}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Creator Launch System</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Content Types x Campaign Forms</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {REBOOT_CREATOR_CONTENT_TYPES.map((contentType) => (
            <div key={contentType.id} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">{contentType.title}</p>
              <p className="mt-1 text-sm text-slate-600">{contentType.description}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {REBOOT_CAMPAIGN_MODES.map((mode) => (
            <div key={mode.id} className="rounded-[18px] border border-slate-200 px-4 py-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                <Rocket className="h-3.5 w-3.5" />
                {mode.title}
              </div>
              <p className="mt-3 text-sm text-slate-600">{mode.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
