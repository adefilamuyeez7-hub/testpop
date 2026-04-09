import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import AppLayout from "./components/AppLayout";
import MobileWebAppGate from "./components/MobileWebAppGate";
import { ThemeProvider } from "./components/theme-provider";
import WalletRuntimeProvider from "./components/wallet/WalletRuntimeProvider";
import NotFound from "./pages/NotFound";
import { initializePushNotifications } from "@/lib/webPush";

// ─── Route Code Splitting ──────────────────────────────────────────────
// Lazy load all routes to reduce initial bundle size
// Critical routes (landing, public) load first; heavier routes (studio, admin) load on demand

// Public routes
const WalletIndexRoute = lazy(() => import("./routes/WalletIndexRoute"));
const WalletArtistApplicationRoute = lazy(() => import("./routes/WalletArtistApplicationRoute"));
const DropsPage = lazy(() => import("./pages/DropsPage"));
const DropDetailPage = lazy(() => import("./pages/DropDetailPage"));
const WalletArtistsRoute = lazy(() => import("./routes/WalletArtistsRoute"));
const WalletArtistProfileRoute = lazy(() => import("./routes/WalletArtistProfileRoute"));
const InboxPage = lazy(() => import("./pages/InboxPage"));

// User profile routes
const WalletProfileRoute = lazy(() => import("./routes/WalletProfileRoute"));
const WalletCollectionRoute = lazy(() => import("./routes/WalletCollectionRoute"));
const WalletPOAPsRoute = lazy(() => import("./routes/WalletPOAPsRoute"));
const WalletSubscriptionsRoute = lazy(() => import("./routes/WalletSubscriptionsRoute"));

// Commerce routes
const InvestBoardPage = lazy(() => import("./pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const ReleasesPage = lazy(() => import("./pages/ReleasesPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage").then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import("./pages/CartPage").then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage").then((module) => ({ default: module.OrderHistoryPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((module) => ({ default: module.CatalogPage })));

// Heavy routes (studio, admin) - load on demand only
const WalletStudioRoute = lazy(() => import("./routes/WalletStudioRoute"));
const WalletAdminRoute = lazy(() => import("./routes/WalletAdminRoute"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => {
  // Initialize push notifications when app loads
  useEffect(() => {
    initializePushNotifications().catch((err) => {
      console.warn('Failed to initialize push notifications:', err);
      // Don't fail the app if push notifications aren't supported
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <WalletRuntimeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <MobileWebAppGate>
              <BrowserRouter>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<WalletIndexRoute />} />
                      <Route path="/apply" element={<WalletArtistApplicationRoute />} />
                      <Route path="/drops" element={<DropsPage />} />
                      <Route path="/drops/:id" element={<DropDetailPage />} />
                      <Route path="/artists" element={<WalletArtistsRoute />} />
                      <Route path="/artists/:id" element={<WalletArtistProfileRoute />} />
                      <Route path="/invest" element={<InvestBoardPage />} />
                      <Route path="/inbox" element={<InboxPage />} />
                      <Route path="/profile" element={<WalletProfileRoute />} />
                      <Route path="/collection" element={<WalletCollectionRoute />} />
                      <Route path="/poaps" element={<WalletPOAPsRoute />} />
                      <Route path="/subscriptions" element={<WalletSubscriptionsRoute />} />
                      <Route path="/products" element={<ReleasesPage />} />
                      <Route path="/products/:id" element={<ProductDetailPage />} />
                      <Route path="/catalog" element={<CatalogPage />} />
                      <Route path="/catalog/:type/:id" element={<CatalogPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route path="/orders" element={<OrderHistoryPage />} />
                    </Route>

                    {/* Admin/Studio routes - lazy loaded separately */}
                    <Route path="/admin" element={<WalletAdminRoute />} />
                    <Route path="/studio" element={<WalletStudioRoute />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </MobileWebAppGate>
          </TooltipProvider>
        </WalletRuntimeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
