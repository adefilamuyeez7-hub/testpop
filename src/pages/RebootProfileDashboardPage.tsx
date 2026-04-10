import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Compass,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Lock,
  Package,
  Shield,
  Sparkles,
  Ticket,
  Truck,
  UserRoundSearch,
  Wallet,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useWallet } from "@/hooks/useContracts";
import { getRuntimeSession } from "@/lib/runtimeSession";
import { establishSecureSession } from "@/lib/secureAuth";
import { useCartStore } from "@/stores/cartStore";
import { useCollectionStore } from "@/stores/collectionStore";
import { REBOOT_USER_FLOW } from "@/lib/rebootPlatform";

type DashboardModule = {
  id: string;
  title: string;
  desc: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  metric?: string;
  requiredRole?: "creator" | "admin";
};

function shortWallet(value?: string | null) {
  const wallet = String(value || "").trim();
  if (!wallet) return "Guest collector";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

export default function RebootProfileDashboardPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { connectWallet } = useWallet();
  const [runtimeRole, setRuntimeRole] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const collectionItems = useCollectionStore((state) => state.items);

  const ownerCollectionCount = collectionItems.filter(
    (item) => item.ownerWallet.toLowerCase() === String(address || "").toLowerCase()
  ).length;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const normalizedAddress = String(address || "").toLowerCase();

  useEffect(() => {
    let active = true;

    async function resolveRole() {
      if (!normalizedAddress) {
        setRuntimeRole("");
        setRoleLoading(false);
        return;
      }

      const runtimeSession = getRuntimeSession();
      const sessionWallet = String(runtimeSession.wallet || "").toLowerCase();
      if (runtimeSession.role && sessionWallet === normalizedAddress) {
        setRuntimeRole(runtimeSession.role);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      try {
        const session = await establishSecureSession(normalizedAddress);
        if (!active) return;
        setRuntimeRole(String(session.role || ""));
      } catch {
        if (!active) return;
        setRuntimeRole("");
      } finally {
        if (active) setRoleLoading(false);
      }
    }

    void resolveRole();
    return () => {
      active = false;
    };
  }, [normalizedAddress]);

  const hasCreatorAccess = runtimeRole === "artist" || runtimeRole === "admin";
  const hasAdminAccess = runtimeRole === "admin";

  const collectorModules: DashboardModule[] = [
    {
      id: "collection",
      title: "Collection",
      desc: "View collected digital assets and delivery entitlements.",
      href: "/collection",
      icon: Boxes,
      metric: `${ownerCollectionCount} items`,
    },
    {
      id: "poap",
      title: "POAP",
      desc: "Track campaign participation badges and redemption windows.",
      href: "/poaps",
      icon: Ticket,
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      desc: "See creator memberships and supporter relationships.",
      href: "/subscriptions",
      icon: Sparkles,
    },
    {
      id: "cart",
      title: "Cart",
      desc: "Review checkout-ready products for onchain or partner purchase.",
      href: "/cart",
      icon: Package,
      metric: `${cartCount} in cart`,
    },
    {
      id: "orders",
      title: "Orders",
      desc: "Track fulfillment, shipping, and delivery states.",
      href: "/orders",
      icon: Truck,
    },
  ];

  const creatorAdminModules: DashboardModule[] = [
    {
      id: "creator-dashboard",
      title: "Creator Dashboard",
      desc: "View campaign metrics, conversion trends, and collector activity.",
      href: "/creator/analytics",
      icon: LayoutDashboard,
      requiredRole: "creator",
    },
    {
      id: "portfolio",
      title: "Portfolio Showcase",
      desc: "Upload and curate creator showcase content.",
      href: "/studio?tab=portfolio",
      icon: UserRoundSearch,
      requiredRole: "creator",
    },
    {
      id: "creator-card",
      title: "Tokenized Creator Card",
      desc: "Launch a limited tradeable creator card onchain.",
      href: "/studio?tab=creator-card",
      icon: Sparkles,
      requiredRole: "creator",
    },
    {
      id: "studio",
      title: "Campaign Studio",
      desc: "Launch drop, auction, and bid campaign forms.",
      href: "/studio",
      icon: Package,
      requiredRole: "creator",
    },
    {
      id: "admin",
      title: "Admin Controls",
      desc: "Manage creator whitelist, approvals, and platform guardrails.",
      href: "/admin",
      icon: Shield,
      requiredRole: "admin",
    },
  ];

  const gatedCreatorAdminModules = useMemo(
    () =>
      creatorAdminModules.map((module) => {
        const allowed =
          module.requiredRole === "admin"
            ? hasAdminAccess
            : module.requiredRole === "creator"
              ? hasCreatorAccess
              : true;
        return { ...module, allowed };
      }),
    [creatorAdminModules, hasAdminAccess, hasCreatorAccess]
  );

  return (
    <div className="space-y-6 px-4 py-6 md:px-2">
      <section className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile Hub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Collector + Creator Operating Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          One control center for collection, POAP, subscriptions, cart, order tracking, creator operations, and admin access.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            <Wallet className="h-3.5 w-3.5" />
            {shortWallet(address)}
          </span>
          {!address ? (
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Connect wallet
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/discover")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              <Compass className="h-3.5 w-3.5" />
              Explore discover
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Role Flows</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {REBOOT_USER_FLOW.map((flow) => (
            <article key={flow.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
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
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Collector Modules</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {collectorModules.map((module) => (
            <Link
              key={module.id}
              to={module.href}
              className="group rounded-[20px] border border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.55)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white">
                  <module.icon className="h-5 w-5" />
                </div>
                {module.metric ? (
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-900">
                    {module.metric}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{module.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{module.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Creator + Admin Modules</h2>
        {!address ? (
          <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Connect your wallet to unlock creator and admin role-gated modules.
          </div>
        ) : roleLoading ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verifying role access...
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            Active role: {runtimeRole || "collector"}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {gatedCreatorAdminModules.map((module) => (
            module.allowed ? (
              <Link
                key={module.id}
                to={module.href}
                className="group rounded-[20px] border border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.55)]"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white">
                  <module.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{module.desc}</p>
              </Link>
            ) : (
              <article
                key={module.id}
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 opacity-75"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800">{module.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{module.desc}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {module.requiredRole === "admin" ? "Admin role required" : "Creator role required"}
                </p>
              </article>
            )
          ))}
        </div>
      </section>
    </div>
  );
}
