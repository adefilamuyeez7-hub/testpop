import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import AppLayout from "./components/AppLayout";
import AdminGuard from "./components/AdminGuard";
import ArtistGuard from "./components/ArtistGuard";

// ── Eagerly loaded — always needed on first paint ──
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/AdminPage";

// ── Lazily loaded — parsed only when navigated to ──
const ArtistApplicationPage = lazy(() => import("./pages/ArtistApplicationPage"));
const DropsPage        = lazy(() => import("./pages/DropsPage"));
const DropDetailPage   = lazy(() => import("./pages/DropDetailPage"));
const ArtistsPage      = lazy(() => import("./pages/ArtistsPage"));
const ArtistProfilePage = lazy(() => import("./pages/ArtistProfilePage"));
const MarketplacePage  = lazy(() => import("./pages/MarketplacePage"));
const ProfilePage      = lazy(() => import("./pages/ProfilePage"));
const MyCollectionPage = lazy(() => import("./pages/MyCollectionPage"));
const MyPOAPsPage      = lazy(() => import("./pages/MyPOAPsPage"));
const MySubscriptionsPage = lazy(() => import("./pages/MySubscriptionsPage"));
const ArtistStudioPage = lazy(() => import("./pages/ArtistStudioPage"));
const ProductsPage     = lazy(() => import("./pages/ProductsPage").then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
const CartPage         = lazy(() => import("./pages/CartPage").then(m => ({ default: m.CartPage })));
const CheckoutPage     = lazy(() => import("./pages/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage").then(m => ({ default: m.OrderHistoryPage })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // data stays fresh for 1 min
      gcTime: 5 * 60_000,         // cached in memory for 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public app (with TopBar + BottomNav) ── */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/apply" element={<ArtistApplicationPage />} />
                <Route path="/drops" element={<DropsPage />} />
                <Route path="/drops/:id" element={<DropDetailPage />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route path="/artists/:id" element={<ArtistProfilePage />} />
                <Route path="/invest" element={<MarketplacePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/collection" element={<MyCollectionPage />} />
                <Route path="/poaps" element={<MyPOAPsPage />} />
                <Route path="/subscriptions" element={<MySubscriptionsPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrderHistoryPage />} />
              </Route>

              {/* ── Admin panel (no nav, wallet-gated) ── */}
              <Route
                path="/admin"
                element={<AdminGuard><AdminPage /></AdminGuard>}
              />

              {/* ── Artist studio (no nav, wallet-gated) ── */}
              <Route
                path="/studio"
                element={<ArtistGuard><ArtistStudioPage /></ArtistGuard>}
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
