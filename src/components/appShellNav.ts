import { Flame, Home, ShoppingBag, User } from "lucide-react";

export const appShellNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Flame, label: "Drops", path: "/drops" },
  { icon: ShoppingBag, label: "Marketplace", path: "/products" },
  { icon: User, label: "Profile", path: "/profile" },
] as const;

export function isAppShellNavActive(itemPath: string, pathname: string) {
  return (
    pathname === itemPath ||
    (itemPath === "/drops" && pathname.startsWith("/drops/")) ||
    (itemPath === "/profile" &&
      (pathname.startsWith("/profile") || pathname.startsWith("/wallet"))) ||
    (itemPath === "/products" &&
      (pathname.startsWith("/invest") ||
        pathname.startsWith("/products") ||
        pathname.startsWith("/cart") ||
        pathname.startsWith("/checkout") ||
        pathname.startsWith("/orders")))
  );
}
