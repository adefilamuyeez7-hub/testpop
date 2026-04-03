import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { supabase } from "@/lib/db";
import { resolveMediaUrl } from "@/lib/pinata";
import {
  LIVE_DROP_STATUSES,
  PUBLIC_PRODUCT_STATUSES,
} from "@/lib/catalogVisibility";
import { appShellNavItems, isAppShellNavActive } from "./appShellNav";
import { NavLink } from "./NavLink";
import ThemeToggle from "./ThemeToggle";

const TopBarWalletControls = lazy(() => import("./wallet/TopBarWalletControls"));

type SearchResults = {
  artists: Array<{ id: string; name?: string | null; tag?: string | null; avatar_url?: string | null }>;
  drops: Array<{ id: string; title?: string | null; price_eth?: string | number | null; image_url?: string | null; image_ipfs_uri?: string | null; preview_uri?: string | null; status?: string | null }>;
  products: Array<{ id: string; name?: string | null; price_eth?: string | number | null; image_url?: string | null; image_ipfs_uri?: string | null }>;
};

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ artists: [], drops: [], products: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ artists: [], drops: [], products: [] });
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [artistRes, dropRes, productRes] = await Promise.all([
          supabase
            .from("artists")
            .select("id, name, tag, avatar_url")
            .ilike("name", `%${query}%`)
            .limit(4),
          supabase
            .from("drops")
            .select("id, title, price_eth, image_url, image_ipfs_uri, preview_uri, status")
            .ilike("title", `%${query}%`)
            .in("status", [...LIVE_DROP_STATUSES])
            .limit(4),
          supabase
            .from("products")
            .select("id, name, price_eth, image_url, image_ipfs_uri")
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
            .in("status", [...PUBLIC_PRODUCT_STATUSES])
            .limit(4),
        ]);

        setResults({
          artists: artistRes.data || [],
          drops: dropRes.data || [],
          products: productRes.data || [],
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const hasResults = results.artists.length > 0 || results.drops.length > 0 || results.products.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border max-w-6xl mx-auto w-full">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search artists, drops, products..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <button onClick={onClose} aria-label="Close search" className="p-1.5 rounded-full hover:bg-secondary transition-colors">
          <X className="h-4 w-4 text-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full px-4 py-4">
        {!query && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            Search for artists, drops, or products
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
                  onClick={() => {
                    navigate(`/artists/${artist.id}`);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                    {resolveMediaUrl(artist.avatar_url) && (
                      <img src={resolveMediaUrl(artist.avatar_url)} alt={artist.name} className="h-full w-full object-cover" />
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
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Drops</p>
            <div className="space-y-2">
              {results.drops.map((drop) => (
                <button
                  key={drop.id}
                  onClick={() => {
                    navigate(`/drops/${drop.id}`);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri) && (
                      <img src={resolveMediaUrl(drop.preview_uri, drop.image_url, drop.image_ipfs_uri)} alt={drop.title} className="h-full w-full object-cover" />
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

        {results.products.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Products</p>
            <div className="space-y-2">
              {results.products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    navigate(`/products/${product.id}`);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {resolveMediaUrl(product.image_url, product.image_ipfs_uri) && (
                      <img src={resolveMediaUrl(product.image_url, product.image_ipfs_uri)} alt={product.name || "Product"} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{product.name || "Untitled Product"}</p>
                    <p className="text-xs text-muted-foreground">{product.price_eth ?? "0"} ETH</p>
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

const TopBar = () => {
  const [showSearch, setShowSearch] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-3 md:hidden">
          <img src={logo} alt="POPUP" className="h-7 w-7 rounded-sm object-contain" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => {
                setShowSearch(true);
              }}
              aria-label="Open search"
              className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            >
              <Search className="h-4 w-4 text-foreground" />
            </button>
            <Suspense fallback={<div className="h-8 w-24 rounded-full bg-secondary animate-pulse" />}>
              <TopBarWalletControls />
            </Suspense>
          </div>
        </div>

        <div className="mx-auto hidden max-w-6xl items-center gap-6 px-4 py-4 md:flex lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <img src={logo} alt="POPUP" className="h-10 w-10 rounded-lg object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.18em] text-foreground/70 uppercase">Popup</p>
              <p className="text-xs text-muted-foreground">Collect, discover, and shop digital culture.</p>
            </div>
          </div>

          <nav className="flex flex-1 items-center justify-center gap-2">
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
            <ThemeToggle />
            <button
              onClick={() => {
                setShowSearch(true);
              }}
              aria-label="Open search"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <Suspense fallback={<div className="h-10 w-28 rounded-full bg-secondary animate-pulse" />}>
              <TopBarWalletControls />
            </Suspense>
          </div>
        </div>
      </header>

      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
    </>
  );
};

export default TopBar;
