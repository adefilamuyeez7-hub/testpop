function normalizeApiBase(rawBase: string) {
  const trimmed = rawBase.replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }

  if (trimmed.endsWith("/api")) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

const configuredBase =
  import.meta.env.VITE_SECURE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "";

export const SECURE_API_BASE = normalizeApiBase(configuredBase);

// ═══════════════════════════════════════════════════════════════════════════
// CSRF TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

/**
 * Fetch CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  // Prevent multiple concurrent requests
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = (async () => {
    try {
      const response = await fetch(`${SECURE_API_BASE}/csrf-token`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
      }

      const data = await response.json();
      csrfToken = data.token;
      csrfTokenPromise = null;
      return csrfToken;
    } catch (error) {
      csrfTokenPromise = null;
      console.error("Error fetching CSRF token:", error);
      throw error;
    }
  })();

  return csrfTokenPromise;
}

/**
 * Initialize CSRF token on app startup
 */
export async function initializeCSRFToken(): Promise<void> {
  try {
    await fetchCSRFToken();
  } catch (error) {
    console.warn("Failed to initialize CSRF token:", error);
    // Continue anyway - token will be fetched on first mutation
  }
}

/**
 * Get the current CSRF token, fetching if necessary
 */
export async function getCSRFToken(): Promise<string> {
  return fetchCSRFToken();
}

/**
 * Clear cached CSRF token (for logout or token rotation)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
}
