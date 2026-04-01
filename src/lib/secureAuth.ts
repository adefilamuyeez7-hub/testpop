import { supabase } from "@/lib/db";
import {
  clearRuntimeSession,
  getRuntimeApiToken,
  getRuntimeSession,
  setRuntimeSession,
} from "@/lib/runtimeSession";
import { SECURE_API_BASE } from "@/lib/apiBase";
import { config as wagmiConfig } from "@/lib/wagmi";

const secureApiBaseUrl = SECURE_API_BASE;
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const SIGNATURE_TIMEOUT_MS = 45000;

export type SecureSession = {
  wallet: string;
  role: string;
  apiToken: string;
  supabaseToken?: string | null;
  expiresInSeconds: number;
};

export type ChallengeResponse = {
  wallet: string;
  nonce: string;
  issuedAt: string;
  message: string;
};

function requireSecureApi() {
  if (!secureApiBaseUrl) {
    throw new Error("VITE_SECURE_API_BASE_URL is required for secure wallet auth.");
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function requestWalletChallenge(wallet: string): Promise<ChallengeResponse> {
  requireSecureApi();

  const url = `${secureApiBaseUrl}/auth/challenge`;
  console.log("📡 Requesting challenge from:", url);

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
      credentials: "include",
    },
    AUTH_REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    const errorMsg = `Challenge request failed: ${response.status} ${response.statusText} - ${errorText}`;
    console.error("❌", errorMsg);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function signChallengeMessage(message: string, wallet: string): Promise<string> {
  try {
    const { getAccount, signMessage } = await import("@wagmi/core");
    const account = getAccount(wagmiConfig);
    const normalizedWallet = wallet.trim().toLowerCase();

    if (account.address && account.address.toLowerCase() === normalizedWallet) {
      const signature = await withTimeout(
        signMessage(wagmiConfig, {
          account: account.address,
          message,
        }),
        SIGNATURE_TIMEOUT_MS,
        "Wallet signature request timed out. Reopen your wallet and try again."
      );

      if (signature && typeof signature === "string") {
        return signature;
      }
    }
  } catch (error) {
    console.warn("Wagmi message signing unavailable, falling back to injected provider:", error);
  }

  const ethereum = (window as Window & { ethereum?: { request?: (...args: unknown[]) => Promise<unknown> } }).ethereum;
  if (!ethereum?.request) {
    throw new Error("No wallet signing provider found for secure signing.");
  }

  const signature = await withTimeout(
    ethereum.request({
      method: "personal_sign",
      params: [message, wallet],
    }) as Promise<unknown>,
    SIGNATURE_TIMEOUT_MS,
    "Wallet signature request timed out. Reopen your wallet and try again."
  );

  if (!signature || typeof signature !== "string") {
    throw new Error("Wallet did not return a signature.");
  }

  return signature;
}

export async function verifyWalletChallenge(
  wallet: string,
  signature: string,
  nonce: string
): Promise<SecureSession> {
  requireSecureApi();

  const url = `${secureApiBaseUrl}/auth/verify`;
  console.log("📡 Verifying challenge at:", url);

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, signature, nonce }),
      credentials: "include",
    },
    AUTH_REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    const errorMsg = `Verification failed: ${response.status} ${response.statusText} - ${errorText}`;
    console.error("❌", errorMsg);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function establishSecureSession(wallet: string): Promise<SecureSession> {
  try {
    const normalizedWallet = wallet.trim().toLowerCase();
    const existingSession = getRuntimeSession();
    if (
      existingSession.apiToken &&
      existingSession.wallet &&
      existingSession.wallet.trim().toLowerCase() === normalizedWallet &&
      existingSession.role
    ) {
      return {
        wallet: existingSession.wallet,
        role: existingSession.role,
        apiToken: existingSession.apiToken,
        supabaseToken: existingSession.supabaseToken || null,
        expiresInSeconds: 0,
      };
    }
    console.log("🔐 Starting secure session establishment for wallet:", wallet);
    console.log("🌐 API Base URL:", secureApiBaseUrl);

    console.log("📡 Step 1: Requesting wallet challenge...");
    const challenge = await requestWalletChallenge(wallet);
    console.log("✅ Challenge received:", challenge);

    console.log("📝 Step 2: Signing challenge message...");
    const signature = await signChallengeMessage(challenge.message, wallet);
    console.log("✅ Message signed, signature length:", signature.length);

    console.log("🔍 Step 3: Verifying wallet challenge...");
    const session = await verifyWalletChallenge(wallet, signature, challenge.nonce);
    console.log("✅ Session verified:", { wallet: session.wallet, role: session.role });

    console.log("💾 Step 4: Storing runtime session...");
    setRuntimeSession({
      apiToken: session.apiToken,
      supabaseToken: session.supabaseToken || "",
      wallet: session.wallet,
      role: session.role,
    });
    console.log("✅ Runtime session stored");

    try {
      const token = session.supabaseToken || "";
      if (token) {
        console.log("🔑 Step 5: Setting Supabase session...");
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token,
        });
        console.log("✅ Supabase session set");
      }
    } catch (err) {
      console.warn("⚠️ Supabase session warning (non-blocking):", err);
      // best-effort only
    }

    console.log("🎉 Secure session established successfully!");
    return session;
  } catch (error) {
    console.error("❌ Secure session establishment failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}

export function clearSecureSession() {
  clearRuntimeSession();
}

export function getStoredApiToken(): string {
  return getRuntimeApiToken();
}
