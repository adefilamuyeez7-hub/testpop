import {
  Home,
  User,
  Sparkles,
  ShoppingBag,
  Gavel,
  Gift,
  TrendingUp,
  Settings,
  History,
} from "lucide-react";

export const appShellNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Sparkles, label: "Discover", path: "/discover" },
  { icon: User, label: "Profile", path: "/profile" },
] as const;

// Secondary navigation items for marketplace/creator/collection sections
export const secondaryNavItems = [
  {
    section: "Marketplace",
    items: [
      { icon: ShoppingBag, label: "Browse", path: "/profile/marketplace" },
      { icon: Gavel, label: "Auctions", path: "/profile/marketplace/auctions" },
      { icon: Gift, label: "Gifts", path: "/profile/marketplace/gifts" },
    ],
  },
  {
    section: "Collection",
    items: [
      { icon: ShoppingBag, label: "My NFTs", path: "/profile/collection/nfts" },
      { icon: History, label: "Purchases", path: "/profile/collection/purchases" },
    ],
  },
  {
    section: "Creator",
    items: [
      { icon: TrendingUp, label: "Earnings", path: "/profile/creator/earnings" },
      { icon: Gavel, label: "Royalties", path: "/profile/creator/royalties" },
      { icon: History, label: "Payouts", path: "/profile/creator/payout-history" },
      { icon: User, label: "Collaborators", path: "/profile/creator/collaborators" },
      { icon: Settings, label: "Payout Settings", path: "/profile/creator/payout-settings" },
    ],
  },
] as const;

export function isAppShellNavActive(itemPath: string, pathname: string) {
  return (
    pathname === itemPath ||
    (itemPath === "/discover" && (pathname === "/discover" || pathname.startsWith("/discover/"))) ||
    (itemPath === "/profile" &&
      (pathname.startsWith("/profile") ||
        pathname.startsWith("/wallet") ||
        pathname.startsWith("/orders") ||
        pathname.startsWith("/collection") ||
        pathname.startsWith("/poaps") ||
        pathname.startsWith("/subscriptions") ||
        pathname.startsWith("/checkout") ||
        pathname.startsWith("/gift") ||
        pathname.startsWith("/products") ||
        pathname.startsWith("/studio") ||
        pathname.startsWith("/creator")))
  );
}
