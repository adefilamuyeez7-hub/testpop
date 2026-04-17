import { Shield } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import logo from "@/assets/logo.png";
import { useGuestCollector } from "@/hooks/useGuestCollector";
import { isAdminWallet } from "@/lib/admin";
import { appShellNavItems, isAppShellNavActive } from "./appShellNav";
import { NavLink } from "./NavLink";
import ThemeToggle from "./ThemeToggle";
import TopBarWalletControls from "@/components/wallet/TopBarWalletControls";

function shortCollector(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 12)}...`;
}

const TopBar = () => {
  const location = useLocation();
  const collectorId = useGuestCollector();
  const { address } = useAccount();
  const showAdminLink = isAdminWallet(address);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="POPUP" className="h-8 w-8 rounded-md object-contain" />
          <div className="hidden min-w-0 md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">POPUP</p>
            <p className="truncate text-[11px] text-muted-foreground">Guest collector: {shortCollector(collectorId)}</p>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {appShellNavItems.map((item) => {
            const isActive = isAppShellNavActive(item.path, location.pathname);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {showAdminLink ? (
            <a
              href="/admin/dashboard"
              className="hidden items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary md:inline-flex"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Dashboard</span>
            </a>
          ) : null}
          <TopBarWalletControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
