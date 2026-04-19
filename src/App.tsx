import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useIsMobile } from "./hooks/useIsMobile";
import { CreatorProfilePage } from "./pages/CreatorProfilePage";
import { DesktopLandingPage } from "./pages/DesktopLandingPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { HomePage } from "./pages/HomePage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Routes>
        <Route path="/" element={<DesktopLandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/product/:productId" element={<ProductDetailPage />} />
          <Route path="/creator/:creatorId" element={<CreatorProfilePage />} />
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoveryPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/product/:productId" element={<ProductDetailPage />} />
        <Route path="/creator/:creatorId" element={<CreatorProfilePage />} />
        <Route path="/home" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
