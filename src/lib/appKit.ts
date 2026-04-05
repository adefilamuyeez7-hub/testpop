import { createAppKit, type OpenOptions } from "@reown/appkit";
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
    experimental_preferUniversalLinks: true,
    enableMobileFullScreen: true,
    themeMode: isDarkMode ? "dark" : "light",
  });
}

export async function openAppKit(options?: OpenOptions) {
  if (!appKitPromise) {
    appKitPromise = Promise.resolve(createPopupAppKit());
  }

  const appKit = await appKitPromise;
  await appKit.open(options);
}

export async function openWalletConnectModal() {
  await openAppKit({ view: "Connect" });
}

export async function openWalletNetworkModal() {
  await openAppKit({ view: "Networks" });
}

export async function openWalletApprovalModal() {
  await openAppKit({ view: "ApproveTransaction" });
}
