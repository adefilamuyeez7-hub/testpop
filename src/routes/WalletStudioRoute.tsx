import ArtistStudioPage from "@/pages/ArtistStudioPage";
import ArtistGuard from "@/components/ArtistGuard";

const WalletStudioRoute = () => {
  return (
    <ArtistGuard>
      <ArtistStudioPage />
    </ArtistGuard>
  );
};

export default WalletStudioRoute;
