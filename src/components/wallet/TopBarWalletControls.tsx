import { useState, useEffect } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { supabase } from "@/lib/db";
import WalletConnect from "@/components/WalletConnect";

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const items: any[] = [
        {
          id: "welcome",
          title: "Welcome to POPUP",
          body: "Explore drops, subscribe to artists, and collect onchain.",
          time: "Just now",
          icon: "Welcome",
          read: false,
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
                  ? "Application Under Review"
                  : data.status === "approved"
                    ? "Application Approved!"
                    : "Application Update",
              body:
                data.status === "pending"
                  ? "We received your artist application. We will be in touch soon."
                  : data.status === "approved"
                    ? "Congratulations! Open your Artist Studio to get started."
                    : "Your application status has been updated.",
              time: new Date(data.submitted_at).toLocaleDateString(),
              icon: data.status === "approved" ? "Approved" : "Application",
              read: data.status !== "approved",
            });
          }
        } catch {
          // Ignore missing application state.
        }
      }

      setNotifications(items);
      setLoading(false);
    };

    load();
  }, [address]);

  const unread = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="absolute top-14 right-0 w-80 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 border-b border-border last:border-0 ${
                !notification.read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex gap-3">
                <span className="text-xs font-semibold text-primary flex-shrink-0 mt-0.5">
                  {notification.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
                    {!notification.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{notification.time}</p>
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
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <WalletConnect />
      <div className="relative">
        <button
          onClick={() => setShowNotifications((value) => !value)}
          className="p-1.5 md:p-2 rounded-full hover:bg-secondary transition-colors"
        >
          <Bell className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
        </button>
        {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
      </div>
    </div>
  );
}

const TopBarWalletControls = () => <TopBarWalletControlsInner />;

export default TopBarWalletControls;
