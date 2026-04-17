import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import AppLayout from "./components/AppLayout";
import MobileWebAppGate from "./components/MobileWebAppGate";
import WalletRuntimeProvider from "./components/wallet/WalletRuntimeProvider";
import { ThemeProvider } from "./components/theme-provider";
import NotFound from "./pages/NotFound";
import { initializePushNotifications, autoSubscribeToPushNotifications } from "@/lib/webPush";

// Core Pages
const RebootHomePage = lazy(() => import("./pages/RebootHomePage"));
const RebootDiscoverFeedPage = lazy(() => import("./pages/RebootDiscoverFeedPage"));
const RebootProfileDashboardPage = lazy(() => import("./pages/RebootProfileDashboardPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const GiftClaimPage = lazy(() => import("./pages/GiftClaimPage"));
const FreshProductDetailPage = lazy(() => import("./pages/FreshProductDetailPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard").then((module) => ({ default: module.CreatorDashboard })));
const ArtistsPage = lazy(() => import("./pages/ArtistsPage"));
const ArtistProfilePage = lazy(() => import("./pages/ArtistProfilePage"));
const WalletStudioRoute = lazy(() => import("./routes/WalletStudioRoute"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));

// Phase 3 Marketplace Pages
const MarketplaceGrid = lazy(() => import("./pages/marketplace/MarketplaceGrid"));
const AuctionActivityPage = lazy(() => import("./pages/marketplace/AuctionActivityPage"));
const GiftHistoryPage = lazy(() => import("./pages/marketplace/GiftHistoryPage"));

// Phase 3 Collection Pages
const UserNFTsPage = lazy(() => import("./pages/collection/UserNFTsPage"));
const PurchaseHistoryPage = lazy(() => import("./pages/collection/PurchaseHistoryPage"));

// Phase 3 Creator Pages
const EarningsPage = lazy(() => import("./pages/creator/EarningsPage"));
const PayoutSettingsPage = lazy(() => import("./pages/creator/PayoutSettingsPage"));
const RoyaltyDashboardPage = lazy(() => import("./pages/creator/RoyaltyDashboardPage"));
const PayoutHistoryPage = lazy(() => import("./pages/creator/PayoutHistoryPage"));
const CreatorCollaboratorsPage = lazy(() => import("./pages/creator/CreatorCollaboratorsPage"));

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
  useEffect(() => {
    // Initialize service worker and attempt auto-subscription
    (async () => {
      try {
        await initializePushNotifications();
        // Auto-subscribe with a slight delay to ensure app is ready
        setTimeout(() => {
          autoSubscribeToPushNotifications().catch((err) => {
            console.warn("Auto-subscription to push notifications failed:", err);
          });
        }, 500);
      } catch (err) {
        console.warn("Failed to initialize push notifications:", err);
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletRuntimeProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <MobileWebAppGate>
              <BrowserRouter>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route element={<AppLayout />}>
                      {/* Core Navigation */}
                      <Route path="/" element={<RebootHomePage />} />
                      <Route path="/discover" element={<RebootDiscoverFeedPage />} />
                      
                      {/* User Profile - Contains all user-related sections */}
                      <Route path="/profile" element={<RebootProfileDashboardPage />} />
                      
                      {/* Profile Nested Routes - Marketplace, Collection, Creator */}
                      <Route path="/profile/marketplace" element={<MarketplaceGrid />} />
                      <Route path="/profile/marketplace/auctions" element={<AuctionActivityPage />} />
                      <Route path="/profile/marketplace/gifts" element={<GiftHistoryPage />} />
                      <Route path="/profile/collection/nfts" element={<UserNFTsPage />} />
                      <Route path="/profile/collection/purchases" element={<PurchaseHistoryPage />} />
                      <Route path="/profile/creator/earnings" element={<EarningsPage />} />
                      <Route path="/profile/creator/payout-settings" element={<PayoutSettingsPage />} />
                      <Route path="/profile/creator/royalties" element={<RoyaltyDashboardPage />} />
                      <Route path="/profile/creator/payout-history" element={<PayoutHistoryPage />} />
                      <Route path="/profile/creator/collaborators" element={<CreatorCollaboratorsPage />} />
                      
                      {/* Legacy Routes - Keep for backward compatibility */}
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route path="/gift/:token" element={<GiftClaimPage />} />
                      <Route path="/products/:id" element={<FreshProductDetailPage />} />
                      <Route path="/artists" element={<ArtistsPage />} />
                      <Route path="/artists/:id" element={<ArtistProfilePage />} />
                      <Route path="/studio" element={<WalletStudioRoute />} />
                      <Route path="/creator/analytics" element={<CreatorDashboard />} />
                      
                      {/* Legacy Redirects - Updated to new profile structure */}
                      <Route path="/cart" element={<Navigate to="/profile" replace />} />
                      <Route path="/orders" element={<Navigate to="/profile/collection/purchases" replace />} />
                      <Route path="/collection" element={<Navigate to="/profile/collection/nfts" replace />} />
                      <Route path="/poaps" element={<Navigate to="/profile/collection/nfts" replace />} />
                      <Route path="/subscriptions" element={<Navigate to="/profile" replace />} />
                      <Route path="/feed" element={<Navigate to="/discover" replace />} />
                      <Route path="/catalog" element={<Navigate to="/discover" replace />} />
                      <Route path="/marketplace" element={<Navigate to="/profile/marketplace" replace />} />
                      <Route path="/share/:postId" element={<Navigate to="/discover" replace />} />
                    </Route>
                    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </MobileWebAppGate>
          </TooltipProvider>
        </ThemeProvider>
      </WalletRuntimeProvider>
    </QueryClientProvider>
  );
};

export default App;
