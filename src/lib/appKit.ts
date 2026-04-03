import { createAppKit } from "@reown/appkit";
import { networks, projectId, wagmiAdapter } from "@/lib/wagmi";

let appKitPromise: Promise<ReturnType<typeof createAppKit>> | null = null;

function createPopupAppKit() {
  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata: {
      name: "POPUP",
      description: "Drop it. Own it. Get paid.",
      url: "https://testpop-one.vercel.app",
      icons: ["https://testpop-one.vercel.app/favicon.png"],
    },
    features: {
      analytics: false,
    },
    themeMode: isDarkMode ? "dark" : "light",
  });
}

export async function openAppKit() {
  if (!appKitPromise) {
    appKitPromise = Promise.resolve(createPopupAppKit());
  }

  const appKit = await appKitPromise;
  appKit.open();
}
