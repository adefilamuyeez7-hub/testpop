import { Flame, Home, Inbox, ShoppingBag, User } from "lucide-react";

export const appShellNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Flame, label: "Drops", path: "/drops" },
  { icon: Inbox, label: "Inbox", path: "/inbox" },
  { icon: ShoppingBag, label: "Releases", path: "/products" },
  { icon: User, label: "Profile", path: "/profile" },
] as const;

export function isAppShellNavActive(itemPath: string, pathname: string) {
  return (
    pathname === itemPath ||
    (itemPath === "/drops" && pathname.startsWith("/drops/")) ||
    (itemPath === "/inbox" && pathname.startsWith("/inbox")) ||
    (itemPath === "/profile" &&
      (pathname.startsWith("/profile") ||
        pathname.startsWith("/wallet") ||
        pathname.startsWith("/cart") ||
        pathname.startsWith("/checkout") ||
        pathname.startsWith("/orders") ||
        pathname.startsWith("/collection") ||
        pathname.startsWith("/poaps") ||
        pathname.startsWith("/subscriptions") ||
        pathname.startsWith("/studio"))) ||
    (itemPath === "/products" && pathname.startsWith("/products"))
  );
}
