import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo.png";
import { Bell, Search, X, Loader2 } from "lucide-react";
import WalletConnect from "./WalletConnect";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/db";
import { useAccount } from "wagmi";

// ─── Search ───────────────────────────────────────────────────────────────────
function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ artists: any[]; drops: any[] }>({ artists: [], drops: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults({ artists: [], drops: [] }); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [artistRes, dropRes] = await Promise.all([
          supabase
            .from("artists")
            .select("id, name, tag, avatar_url")
            .ilike("name", `%${query}%`)
            .limit(4),
          supabase
            .from("drops")
            .select("id, title, price_eth, image_url")
            .ilike("title", `%${query}%`)
            .limit(4),
        ]);
        setResults({
          artists: artistRes.data || [],
          drops: dropRes.data || [],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const hasResults = results.artists.length > 0 || results.drops.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border max-w-lg mx-auto w-full">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search artists, drops..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
          <X className="h-4 w-4 text-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-4">
        {!query && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            Search for artists or drops
          </p>
        )}

        {query && !loading && !hasResults && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            No results for "{query}"
          </p>
        )}

        {results.artists.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Artists</p>
            <div className="space-y-2">
              {results.artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => { navigate(`/artists/${artist.id}`); onClose(); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                    {artist.avatar_url && (
                      <img src={artist.avatar_url} alt={artist.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{artist.name || "Untitled Artist"}</p>
                    <p className="text-xs text-muted-foreground">{artist.tag || "Artist"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.drops.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Drops</p>
            <div className="space-y-2">
              {results.drops.map((drop) => (
                <button
                  key={drop.id}
                  onClick={() => { navigate(`/drops/${drop.id}`); onClose(); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {drop.image_url && (
                      <img src={drop.image_url} alt={drop.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{drop.title}</p>
                    <p className="text-xs text-muted-foreground">{drop.price_eth} ETH</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────
function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const items: any[] = [];

      // Always show welcome
      items.push({
        id: "welcome",
        title: "Welcome to POPUP",
        body: "Explore drops, subscribe to artists, and collect onchain.",
        time: "Just now",
        icon: "🎉",
        read: false,
      });

      // Check if they have a pending application
      if (address) {
        try {
          const { data } = await supabase
            .from("artist_applications")
            .select("status, submitted_at")
            .eq("wallet_address", address.toLowerCase())
            .single();

          if (data) {
            items.push({
              id: "application",
              title: data.status === "pending"
                ? "Application Under Review"
                : data.status === "approved"
                ? "Application Approved!"
                : "Application Update",
              body: data.status === "pending"
                ? "We received your artist application. We will be in touch soon."
                : data.status === "approved"
                ? "Congratulations! Open your Artist Studio to get started."
                : "Your application status has been updated.",
              time: new Date(data.submitted_at).toLocaleDateString(),
              icon: data.status === "approved" ? "✅" : "📋",
              read: data.status !== "approved",
            });
          }
        } catch (e) {
          // No application found
        }
      }

      setNotifications(items);
      setLoading(false);
    };

    load();
  }, [address]);

  const unread = notifications.filter((n) => !n.read).length;

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
          notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 border-b border-border last:border-0 ${!n.read ? "bg-primary/5" : ""}`}
            >
              <div className="flex gap-3">
                <span className="text-xl flex-shrink-0">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
const TopBar = () => {
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { address } = useAccount();

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between h-12 md:h-14 px-3 md:px-4 max-w-lg mx-auto relative">
          <img src={logo} alt="PopUp" className="h-6 md:h-7" />
          <div className="flex items-center gap-1 md:gap-2">
            <WalletConnect />
            <button
              onClick={() => { setShowSearch(true); setShowNotifications(false); }}
              className="p-1.5 md:p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <Search className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
            </button>
            <div className="relative">
              <button
                onClick={() => { setShowNotifications((v) => !v); setShowSearch(false); }}
                className="p-1.5 md:p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
              </button>
              {showNotifications && (
                <NotificationsPanel onClose={() => setShowNotifications(false)} />
              )}
            </div>
          </div>
        </div>
      </header>

      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
    </>
  );
};

export default TopBar;
