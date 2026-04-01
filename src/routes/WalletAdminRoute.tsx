import AdminPage from "@/pages/AdminPage";
import AdminGuard from "@/components/AdminGuard";

const WalletAdminRoute = () => {
  return (
    <AdminGuard>
      <AdminPage />
    </AdminGuard>
  );
};

export default WalletAdminRoute;
