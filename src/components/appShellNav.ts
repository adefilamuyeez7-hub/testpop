import { Home, Inbox, ShoppingBag, User, Sparkles, BarChart3 } from "lucide-react";

export const appShellNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Sparkles, label: "Discover", path: "/discover" },
  { icon: Inbox, label: "Inbox", path: "/inbox" },
  { icon: ShoppingBag, label: "Cart", path: "/cart" },
  { icon: BarChart3, label: "Analytics", path: "/creator/analytics" },
  { icon: User, label: "Profile", path: "/profile" },
] as const;

export function isAppShellNavActive(itemPath: string, pathname: string) {
  return (
    pathname === itemPath ||
    (itemPath === "/discover" && (pathname === "/discover" || pathname.startsWith("/discover/"))) ||
    (itemPath === "/inbox" && pathname.startsWith("/inbox")) ||
    (itemPath === "/cart" && (pathname === "/cart" || pathname.startsWith("/checkout"))) ||
    (itemPath === "/creator/analytics" && pathname.startsWith("/creator/analytics")) ||
    (itemPath === "/profile" &&
      (pathname.startsWith("/profile") ||
        pathname.startsWith("/wallet") ||
        pathname.startsWith("/orders") ||
        pathname.startsWith("/collection") ||
        pathname.startsWith("/poaps") ||
        pathname.startsWith("/subscriptions") ||
        pathname.startsWith("/studio")))
  );
}
