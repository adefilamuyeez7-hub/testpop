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

type ChallengeResponse = {
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

  const response = await fetch(`${secureApiBaseUrl}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
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

export async function verifyWalletChallenge(wallet: string, signature: string): Promise<SecureSession> {
  requireSecureApi();

  const response = await fetch(`${secureApiBaseUrl}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, signature }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function establishSecureSession(wallet: string): Promise<SecureSession> {
  const challenge = await requestWalletChallenge(wallet);
  const signature = await signChallengeMessage(challenge.message, wallet);
  const session = await verifyWalletChallenge(wallet, signature);

  setRuntimeSession({
    apiToken: session.apiToken,
    supabaseToken: session.supabaseToken || "",
    wallet: session.wallet,
    role: session.role,
  });

  try {
    const token = session.supabaseToken || "";
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: token,
      });
    }
  } catch {
    // best-effort only
  }

  return session;
}

export function clearSecureSession() {
  clearRuntimeSession();
}

export function getStoredApiToken(): string {
  return getRuntimeApiToken();
}
