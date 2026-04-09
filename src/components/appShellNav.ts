import { Home, Inbox, User, Sparkles } from "lucide-react";

export const appShellNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Sparkles, label: "Discover", path: "/discover" },
  { icon: Inbox, label: "Inbox", path: "/inbox" },
  { icon: User, label: "Profile", path: "/profile" },
] as const;

export function isAppShellNavActive(itemPath: string, pathname: string) {
  return (
    pathname === itemPath ||
    (itemPath === "/discover" && (pathname === "/discover" || pathname.startsWith("/discover/"))) ||
    (itemPath === "/inbox" && pathname.startsWith("/inbox")) ||
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
