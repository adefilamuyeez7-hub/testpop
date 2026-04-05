type RuntimeSessionState = {
  apiToken: string;
  supabaseToken: string;
  wallet: string;
  role: string;
  guestCustomerId: string;
};

type PersistedRuntimeSessionState = Pick<
  RuntimeSessionState,
  "apiToken" | "supabaseToken" | "wallet" | "role" | "guestCustomerId"
>;

const SESSION_STORAGE_KEY = "popup.runtime-session";

declare global {
  interface Window {
    __POPUP_RUNTIME_SESSION__?: RuntimeSessionState;
  }
}

const defaultRuntimeSession: RuntimeSessionState = {
  apiToken: "",
  supabaseToken: "",
  wallet: "",
  role: "",
  guestCustomerId: "",
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readStoredSession(): Partial<RuntimeSessionState> {
  if (!canUseStorage()) return {};

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<PersistedRuntimeSessionState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistRuntimeSession(session: RuntimeSessionState) {
  if (!canUseStorage()) return;

  try {
    const persistedSession: PersistedRuntimeSessionState = {
      apiToken: session.apiToken,
      supabaseToken: session.supabaseToken,
      wallet: session.wallet,
      role: session.role,
      guestCustomerId: session.guestCustomerId,
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persistedSession));
  } catch {
    // best-effort only
  }
}

function getRuntimeSessionState(): RuntimeSessionState {
  if (typeof window !== "undefined") {
    if (!window.__POPUP_RUNTIME_SESSION__) {
      window.__POPUP_RUNTIME_SESSION__ = {
        ...defaultRuntimeSession,
        ...readStoredSession(),
      };
    }

    return window.__POPUP_RUNTIME_SESSION__;
  }

  return defaultRuntimeSession;
}

function createGuestCustomerId() {
  return `guest:${Math.random().toString(36).slice(2, 10)}`;
}

export function setRuntimeSession(session: Partial<RuntimeSessionState>) {
  const runtimeSession = getRuntimeSessionState();
  if (session.apiToken !== undefined) runtimeSession.apiToken = session.apiToken;
  if (session.supabaseToken !== undefined) runtimeSession.supabaseToken = session.supabaseToken;
  if (session.wallet !== undefined) runtimeSession.wallet = session.wallet;
  if (session.role !== undefined) runtimeSession.role = session.role;
  if (session.guestCustomerId !== undefined) runtimeSession.guestCustomerId = session.guestCustomerId;
  persistRuntimeSession(runtimeSession);
}

export function getRuntimeSession() {
  const runtimeSession = getRuntimeSessionState();
  return { ...runtimeSession };
}

export function clearRuntimeSession() {
  const runtimeSession = getRuntimeSessionState();
  runtimeSession.apiToken = "";
  runtimeSession.supabaseToken = "";
  runtimeSession.wallet = "";
  runtimeSession.role = "";
  persistRuntimeSession(runtimeSession);
}

export function getRuntimeApiToken() {
  const runtimeSession = getRuntimeSessionState();
  return runtimeSession.apiToken;
}

export function getRuntimeSupabaseToken() {
  const runtimeSession = getRuntimeSessionState();
  return runtimeSession.supabaseToken;
}

export function getOrCreateGuestCustomerId() {
  const runtimeSession = getRuntimeSessionState();
  if (!runtimeSession.guestCustomerId) {
    runtimeSession.guestCustomerId = createGuestCustomerId();
    persistRuntimeSession(runtimeSession);
  }

  return runtimeSession.guestCustomerId;
}
