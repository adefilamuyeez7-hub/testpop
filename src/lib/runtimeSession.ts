type RuntimeSessionState = {
  apiToken: string;
  supabaseToken: string;
  wallet: string;
  role: string;
  guestCustomerId: string;
};

const runtimeSession: RuntimeSessionState = {
  apiToken: "",
  supabaseToken: "",
  wallet: "",
  role: "",
  guestCustomerId: "",
};

function createGuestCustomerId() {
  return `guest:${Math.random().toString(36).slice(2, 10)}`;
}

export function setRuntimeSession(session: Partial<RuntimeSessionState>) {
  if (session.apiToken !== undefined) runtimeSession.apiToken = session.apiToken;
  if (session.supabaseToken !== undefined) runtimeSession.supabaseToken = session.supabaseToken;
  if (session.wallet !== undefined) runtimeSession.wallet = session.wallet;
  if (session.role !== undefined) runtimeSession.role = session.role;
  if (session.guestCustomerId !== undefined) runtimeSession.guestCustomerId = session.guestCustomerId;
}

export function getRuntimeSession() {
  return { ...runtimeSession };
}

export function clearRuntimeSession() {
  runtimeSession.apiToken = "";
  runtimeSession.supabaseToken = "";
  runtimeSession.wallet = "";
  runtimeSession.role = "";
}

export function getRuntimeApiToken() {
  return runtimeSession.apiToken;
}

export function getRuntimeSupabaseToken() {
  return runtimeSession.supabaseToken;
}

export function getOrCreateGuestCustomerId() {
  if (!runtimeSession.guestCustomerId) {
    runtimeSession.guestCustomerId = createGuestCustomerId();
  }

  return runtimeSession.guestCustomerId;
}
