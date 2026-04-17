import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, Loader2, UserPlus, X } from "lucide-react";
import { useAccount } from "wagmi";
import { supabase } from "@/lib/db";
import WalletConnect from "@/components/WalletConnect";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

function NotificationsPanel({
  notifications,
  loading,
  isConnected,
  onClose,
}: {
  notifications: NotificationItem[];
  loading: boolean;
  isConnected: boolean;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-14 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <p className="text-[11px] text-muted-foreground">
            {isConnected ? "Wallet and creator status updates" : "Connect a wallet to personalize alerts"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 transition-colors hover:bg-secondary"
          aria-label="Close notifications"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We will surface creator application and account activity here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-b border-border px-4 py-3 last:border-0 ${
                notification.unread ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 rounded-full bg-secondary p-2">
                  {notification.id === "application" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
                    {notification.unread ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{notification.time}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TopBarWalletControlsInner() {
  const { address, isConnected } = useAccount();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      const items: NotificationItem[] = [
        {
          id: "welcome",
          title: isConnected ? "Wallet connected" : "Welcome to POPUP",
          body: isConnected
            ? "Your wallet is ready for profile, collection, and creator actions."
            : "Connect a wallet to collect, manage your profile, and unlock creator tools.",
          time: "Just now",
          unread: !isConnected,
        },
      ];

      if (address) {
        try {
          const { data } = await supabase
            .from("artist_applications")
            .select("status, submitted_at")
            .eq("wallet_address", address.toLowerCase())
            .maybeSingle();

          if (data) {
            items.push({
              id: "application",
              title:
                data.status === "pending"
                  ? "Application under review"
                  : data.status === "approved"
                    ? "Application approved"
                    : "Application updated",
              body:
                data.status === "pending"
                  ? "Your creator application is in review."
                  : data.status === "approved"
                    ? "Open Artist Studio to continue setup."
                    : "Your creator application status changed.",
              time: new Date(data.submitted_at).toLocaleDateString(),
              unread: data.status !== "rejected",
            });
          }
        } catch {
          // Ignore optional notification data if the table or row is unavailable.
        }
      }

      if (active) {
        setNotifications(items);
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [address, isConnected]);

  useEffect(() => {
    if (!showNotifications) return;

    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [showNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications]
  );

  return (
    <div className="flex items-center gap-2">
      <WalletConnect />
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => setShowNotifications((value) => !value)}
          className="relative rounded-full border border-border bg-background p-2 transition-colors hover:bg-secondary"
          aria-label="Open notifications"
          aria-expanded={showNotifications}
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {Math.min(unreadCount, 9)}
            </span>
          ) : null}
        </button>
        {showNotifications ? (
          <NotificationsPanel
            notifications={notifications}
            loading={loading}
            isConnected={isConnected}
            onClose={() => setShowNotifications(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

const TopBarWalletControls = () => <TopBarWalletControlsInner />;

export default TopBarWalletControls;
