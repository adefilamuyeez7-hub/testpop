import type { ReactNode } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileWebAppGate } from "@/hooks/useMobileWebAppGate";

type MobileWebAppGateProps = {
  children: ReactNode;
};

const MobileWebAppGate = ({ children }: MobileWebAppGateProps) => {
  const { deferredPrompt, isAppleMobile, promptInstall, shouldGateMobileApp } = useMobileWebAppGate();

  if (!shouldGateMobileApp) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.22),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eaf3ff_100%)] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between rounded-[2rem] border border-[#dbe7ff] bg-white/95 p-6 shadow-[0_30px_90px_rgba(37,99,235,0.14)]">
        <div>
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,#60a5fa_0%,#1d4ed8_100%)] text-white shadow-lg">
            <Smartphone className="h-7 w-7" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#1d4ed8]">Mobile Web App</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground">Install POPUP to continue</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            On mobile, POPUP now opens as a homescreen web app. Add it to your homescreen, then reopen it from there to continue.
          </p>

          <div className="mt-6 rounded-[1.5rem] border border-[#dbe7ff] bg-[#f4f8ff] p-4">
            {isAppleMobile ? (
              <div className="space-y-3 text-sm text-foreground">
                <p className="font-semibold">iPhone or iPad steps</p>
                <p>1. Tap the <span className="font-semibold">Share</span> button in Safari.</p>
                <p>2. Choose <span className="font-semibold">Add to Home Screen</span>.</p>
                <p>3. Open POPUP again from the new homescreen icon.</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-foreground">
                <p className="font-semibold">Android steps</p>
                <p>1. Tap the install button below if your browser offers it.</p>
                <p>2. If not, open the browser menu and choose <span className="font-semibold">Add to Home screen</span> or <span className="font-semibold">Install app</span>.</p>
                <p>3. Launch POPUP from the new icon on your homescreen.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {deferredPrompt ? (
            <Button onClick={() => void promptInstall()} className="h-12 w-full rounded-full gradient-primary text-primary-foreground">
              <Download className="mr-2 h-4 w-4" />
              Add POPUP to Homescreen
            </Button>
          ) : (
            <Button disabled className="h-12 w-full rounded-full bg-[#dbeafe] text-[#1d4ed8] opacity-100">
              <Share className="mr-2 h-4 w-4" />
              Use Browser Add to Homescreen
            </Button>
          )}

          <Button variant="outline" onClick={() => window.location.reload()} className="h-12 w-full rounded-full">
            I already added it
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileWebAppGate;
