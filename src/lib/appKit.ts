import { createAppKit, type OpenOptions } from "@reown/appkit";
import { ConnectionController, CoreHelperUtil, StorageUtil } from "@reown/appkit-controllers";
import { networks, projectId, wagmiAdapter } from "@/lib/wagmi";

let appKitPromise: Promise<ReturnType<typeof createAppKit>> | null = null;
const WALLET_CONNECT_CONNECTOR_ID = "walletConnect";
const EVM_NAMESPACE = "eip155";

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
  queueWalletAppHandoff({ delayMs: 0 });
}

function resolveConnectedWalletHref() {
  const activeLink = ConnectionController.state.wcLinking;
  if (activeLink?.href) {
    return activeLink.href;
  }

  return StorageUtil.getWalletConnectDeepLink()?.href;
}

function isWalletConnectMobileSession() {
  if (typeof window === "undefined" || !CoreHelperUtil.isMobile()) {
    return false;
  }

  return StorageUtil.getConnectedConnectorId(EVM_NAMESPACE) === WALLET_CONNECT_CONNECTOR_ID;
}

export function queueWalletAppHandoff(options?: { delayMs?: number }) {
  if (!isWalletConnectMobileSession()) {
    return false;
  }

  const href = resolveConnectedWalletHref();
  if (!href) {
    return false;
  }

  const target = CoreHelperUtil.isIframe() ? "_top" : "_self";
  const delayMs = Math.max(0, options?.delayMs ?? 180);

  const openWallet = () => {
    try {
      CoreHelperUtil.openHref(href, target);
    } catch (error) {
      console.warn("Unable to hand off to the connected wallet app:", error);
    }
  };

  if (delayMs > 0) {
    window.setTimeout(openWallet, delayMs);
  } else {
    openWallet();
  }

  return true;
}
