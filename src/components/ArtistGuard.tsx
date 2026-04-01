import { useEffect, useState } from "react";
import { Palette, Wallet, Lock, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useContracts";
import { establishSecureSession } from "@/lib/secureAuth";
import { toast } from "sonner";

const ArtistGuard = ({ children }: { children: React.ReactNode }) => {
  const { address, isConnected, isConnecting, connectWallet, disconnect } = useWallet();
  const [isChecking, setIsChecking] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setIsChecking(false);
      setIsApproved(false);
      setSessionEstablished(false);
      setSessionError(null);
      return;
    }

    if (!address) {
      return;
    }

    let cancelled = false;
    setIsChecking(true);

    establishSecureSession(address)
      .then((session) => {
        if (!cancelled) {
          const approved = session.role === "artist" || session.role === "admin";
          setIsApproved(approved);
          setSessionEstablished(approved);
          setSessionError(null);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to authenticate with backend";
        console.error("Failed to establish artist secure session:", error);
        if (!cancelled) {
          setIsApproved(false);
          setSessionEstablished(false);
          setSessionError(message);
          toast.error(`Artist access check failed: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Palette className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Artist Studio</h1>
        <p className="text-sm text-muted-foreground mb-1 max-w-xs">
          Your creative command centre on PopUp.
        </p>
        <p className="text-xs text-muted-foreground mb-8 max-w-xs">
          Connect your whitelisted wallet to continue.
        </p>
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="rounded-full gradient-primary text-primary-foreground font-semibold px-8 h-12"
        >
          <Wallet className="h-4 w-4 mr-2" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Checking access</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Verifying your wallet against the secure artist whitelist.
        </p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Authentication Error</h1>
        <p className="text-sm text-muted-foreground mb-2 max-w-xs">
          We could not verify this wallet with the secure backend.
        </p>
        <p className="text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg mb-8 max-w-xs">
          {sessionError}
        </p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="rounded-full px-8 h-11 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Refresh Page
        </Button>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Not Whitelisted</h1>
        <p className="text-sm text-muted-foreground mb-2 max-w-xs">
          This wallet hasn't been approved as a PopUp artist yet.
        </p>
        <p className="text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg mb-4 max-w-xs truncate">
          {address}
        </p>
        <p className="text-xs text-muted-foreground mb-8 max-w-xs">
          Apply through the platform and wait for the team to whitelist your wallet.
        </p>
        <Button
          variant="outline"
          onClick={() => disconnect()}
          className="rounded-full px-8 h-11 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Try another wallet
        </Button>
      </div>
    );
  }

  if (!sessionEstablished) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Establishing Secure Session</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Authenticating your artist wallet with the backend before opening the studio.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ArtistGuard;
