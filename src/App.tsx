import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import AppLayout from "./components/AppLayout";
import MobileWebAppGate from "./components/MobileWebAppGate";
import WalletRuntimeProvider from "./components/wallet/WalletRuntimeProvider";
import NotFound from "./pages/NotFound";

const WalletIndexRoute = lazy(() => import("./routes/WalletIndexRoute"));
const WalletArtistApplicationRoute = lazy(() => import("./routes/WalletArtistApplicationRoute"));
const DropsPage = lazy(() => import("./pages/DropsPage"));
const DropDetailPage = lazy(() => import("./pages/DropDetailPage"));
const WalletArtistsRoute = lazy(() => import("./routes/WalletArtistsRoute"));
const WalletArtistProfileRoute = lazy(() => import("./routes/WalletArtistProfileRoute"));
const WalletMarketplaceRoute = lazy(() => import("./routes/WalletMarketplaceRoute"));
const WalletProfileRoute = lazy(() => import("./routes/WalletProfileRoute"));
const WalletCollectionRoute = lazy(() => import("./routes/WalletCollectionRoute"));
const WalletPOAPsRoute = lazy(() => import("./routes/WalletPOAPsRoute"));
const WalletSubscriptionsRoute = lazy(() => import("./routes/WalletSubscriptionsRoute"));
const WalletStudioRoute = lazy(() => import("./routes/WalletStudioRoute"));
const WalletAdminRoute = lazy(() => import("./routes/WalletAdminRoute"));
const ProductsPage = lazy(() => import("./pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage").then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import("./pages/CartPage").then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage").then((module) => ({ default: module.OrderHistoryPage })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletRuntimeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MobileWebAppGate>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<WalletIndexRoute />} />
                  <Route path="/apply" element={<WalletArtistApplicationRoute />} />
                  <Route path="/drops" element={<DropsPage />} />
                  <Route path="/drops/:id" element={<DropDetailPage />} />
                  <Route path="/artists" element={<WalletArtistsRoute />} />
                  <Route path="/artists/:id" element={<WalletArtistProfileRoute />} />
                  <Route path="/invest" element={<WalletMarketplaceRoute />} />
                  <Route path="/profile" element={<WalletProfileRoute />} />
                  <Route path="/collection" element={<WalletCollectionRoute />} />
                  <Route path="/poaps" element={<WalletPOAPsRoute />} />
                  <Route path="/subscriptions" element={<WalletSubscriptionsRoute />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/products/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/orders" element={<OrderHistoryPage />} />
                </Route>

                <Route path="/admin" element={<WalletAdminRoute />} />
                <Route path="/studio" element={<WalletStudioRoute />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </MobileWebAppGate>
      </TooltipProvider>
    </WalletRuntimeProvider>
  </QueryClientProvider>
);

export default App;
