import { Shield, Wallet, AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { isAdminWallet } from "@/lib/admin";

/**
 * Wraps the admin panel. Shows a lock screen if:
 *   - no wallet is connected
 *   - the connected wallet is not the admin wallet
 */
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { address, isConnected, isConnecting, connectWallet, disconnect } = useWallet();

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Shield className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Access</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs">
          This area is restricted. Connect the authorised admin wallet to continue.
        </p>
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="rounded-full gradient-primary text-primary-foreground font-semibold px-8 h-12"
        >
          <Wallet className="h-4 w-4 mr-2" />
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  // ── Connected but wrong wallet ───────────────────────────────────────────────
  if (!isAdminWallet(address)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-sm text-muted-foreground mb-2 max-w-xs">
          This wallet is not authorised to access the admin panel.
        </p>
        <p className="text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg mb-8 max-w-xs truncate">
          {address}
        </p>
        <Button
          variant="outline"
          onClick={() => disconnect()}
          className="rounded-full px-8 h-11 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Disconnect & try another wallet
        </Button>
      </div>
    );
  }

  // ── Authorised ──────────────────────────────────────────────────────────────
  return <>{children}</>;
};

export default AdminGuard;
