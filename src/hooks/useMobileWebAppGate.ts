import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function getStandaloneState() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function getAppleMobileState() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useMobileWebAppGate() {
  const isMobile = useIsMobile();
  const [isStandalone, setIsStandalone] = useState(() => getStandaloneState());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const refreshStandaloneState = () => setIsStandalone(getStandaloneState());
    refreshStandaloneState();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      refreshStandaloneState();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    document.addEventListener("visibilitychange", refreshStandaloneState);
    window.addEventListener("focus", refreshStandaloneState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      document.removeEventListener("visibilitychange", refreshStandaloneState);
      window.removeEventListener("focus", refreshStandaloneState);
    };
  }, []);

  const isAppleMobile = useMemo(() => getAppleMobileState(), []);
  const shouldGateMobileApp = false;

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return false;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome !== "accepted") {
      return false;
    }

    setDeferredPrompt(null);
    return true;
  };

  return {
    deferredPrompt,
    isAppleMobile,
    isMobile,
    isStandalone,
    promptInstall,
    shouldGateMobileApp,
  };
}
