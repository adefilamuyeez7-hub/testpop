import { supabase } from "@/lib/db";
import {
  clearRuntimeSession,
  getRuntimeApiToken,
  setRuntimeSession,
} from "@/lib/runtimeSession";

const secureApiBaseUrl = (import.meta.env.VITE_SECURE_API_BASE_URL || "").replace(/\/$/, "");

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

export async function requestWalletChallenge(wallet: string): Promise<ChallengeResponse> {
  requireSecureApi();

  const url = `${secureApiBaseUrl}/auth/challenge`;
  console.log("📡 Requesting challenge from:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorMsg = `Challenge request failed: ${response.status} ${response.statusText} - ${errorText}`;
    console.error("❌", errorMsg);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function signChallengeMessage(message: string, wallet: string): Promise<string> {
  const ethereum = (window as Window & { ethereum?: { request?: (...args: unknown[]) => Promise<unknown> } }).ethereum;
  if (!ethereum?.request) {
    throw new Error("No injected wallet provider found for secure signing.");
  }

  const signature = await ethereum.request({
    method: "personal_sign",
    params: [message, wallet],
  });

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, signature, nonce }),
    credentials: "include",
  });

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
