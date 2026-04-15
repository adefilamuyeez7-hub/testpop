import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  ADMIN_WALLETS,
  appJwtSecret,
  SUPABASE_JWT_SECRET,
} from "../config.js";

const router = express.Router();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// ═════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Normalize wallet address to lowercase checksum format
 * @param {string} wallet - Raw wallet address
 * @returns {string} Normalized wallet address
 */
export function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== "string") return "";
  try {
    return ethers.getAddress(wallet);
  } catch {
    return "";
  }
}

/**
 * Wallet address comparison that works across checksums
 * @param {string} wallet1 - First wallet address
 * @param {string} wallet2 - Second wallet address
 * @returns {boolean} Whether addresses match
 */
export function normalizeAndCompare(wallet1, wallet2) {
  return normalizeWallet(wallet1).toLowerCase() === normalizeWallet(wallet2).toLowerCase();
}

// ═════════════════════════════════════════════════════════════════════════════
// NONCE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Issue a unique nonce for wallet authentication
 * @param {string} wallet - Wallet address
 * @returns {Promise<{nonce: string, issuedAt: string}>}
 */
export async function issueNonce(wallet) {
  const normalizedWallet = normalizeWallet(wallet);
  const nonce = ethers.hexlify(ethers.randomBytes(32)).slice(2).toLowerCase();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const { error } = await supabase.from("nonces").insert({
    wallet: normalizedWallet,
    nonce,
    issued_at: issuedAt,
    expires_at: expiresAt,
    used: false,
  });

  if (error) {
    console.error("Failed to store nonce:", error);
    throw new Error(`Failed to issue nonce: ${error.message}`);
  }

  return { nonce, issuedAt };
}

/**
 * Retrieve and validate a nonce record
 * @param {string} wallet - Wallet address
 * @param {string} nonce - Nonce value
 * @returns {Promise<Object>} Nonce record
 * @throws {Error} If nonce is invalid or expired
 */
export async function getValidNonceRecord(wallet, nonce) {
  const normalized = normalizeWallet(wallet);
  const now = new Date().toISOString();

  const { data, error: selectError } = await supabase
    .from("nonces")
    .select("id, nonce, issued_at, expires_at")
    .eq("wallet", normalized)
    .eq("nonce", nonce)
    .eq("used", false)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Nonce verification failed: ${selectError.message}`);
  }

  if (!data) {
    throw new Error("Invalid or expired nonce");
  }

  // Check expiration
  if (data.expires_at < now) {
    throw new Error("Challenge expired");
  }

  return data;
}

/**
 * Cleanup expired nonces from database
 * @returns {Promise<void>}
 */
export async function cleanupExpiredNonces() {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("nonces")
    .delete()
    .lt("expires_at", now)
    .eq("used", false);

  if (error) {
    console.warn("Nonce cleanup warning:", error.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGE & TOKEN GENERATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generate challenge message for wallet signature
 * @param {string} wallet - Wallet address
 * @param {string} nonce - Nonce for signature
 * @returns {string} Challenge message to sign
 */
export function makeChallengeMessage(wallet, nonce) {
  return [
    "PopUp secure sign-in",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "",
    "This signature proves wallet ownership for PopUp API access.",
    "It does not move funds or approve token transfers.",
  ].join("\n");
}

/**
 * Issue JWT token for PopUp API authentication
 * @param {Object} payload - Token payload {wallet, role}
 * @returns {string} Signed JWT token
 */
export function issueAppToken(payload) {
  return jwt.sign(payload, appJwtSecret, {
    algorithm: "HS256",
    expiresIn: "12h",
    issuer: "popup-api",
    audience: "popup-client",
  });
}

/**
 * Issue Supabase JWT token for RLS access
 * @param {Object} options - Token options {wallet, role}
 * @returns {string|null} Signed JWT token or null if secret not configured
 */
export function issueSupabaseToken({ wallet, role }) {
  if (!SUPABASE_JWT_SECRET) return null;

  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      aud: "authenticated",
      exp: now + 60 * 60,
      iat: now,
      iss: "popup-api",
      role: "authenticated",
      wallet,
      app_role: role,
      role_name: role,
      sub: wallet,
    },
    SUPABASE_JWT_SECRET,
    { algorithm: "HS256" }
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROLE RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Determine user role based on wallet and whitelist status
 * @param {string} wallet - Wallet address
 * @returns {Promise<string>} User role: 'admin', 'artist', or 'collector'
 */
export async function resolveRole(wallet) {
  const normalized = normalizeWallet(wallet);
  const adminWallets = ADMIN_WALLETS.split(",")
    .map(normalizeWallet)
    .filter(Boolean);

  if (adminWallets.includes(normalized)) return "admin";

  const { data } = await supabase
    .from("whitelist")
    .select("status")
    .eq("wallet", normalized)
    .maybeSingle();

  if (data?.status === "approved") return "artist";
  return "collector";
}

// ═════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Rate limiter key generator for auth endpoints
 * Uses wallet or IP to rate limit by identity
 */
function getAuthRateLimitKey(req) {
  const wallet = normalizeWallet(req.body?.wallet);
  const actor = wallet || req.ip || "unknown";
  return `${req.path}:${actor}`;
}

/**
 * Create an auth-specific rate limiter
 */
function createAuthLimiter(max, label) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    keyGenerator: (req) => getAuthRateLimitKey(req),
    message: "Too many authentication attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`🚨 ${label} rate limit exceeded for ${getAuthRateLimitKey(req)}`);
      res.status(429).json({ error: "Too many authentication attempts, please try again later" });
    },
  });
}

export const authChallengeLimiter = createAuthLimiter(10, "Auth challenge");
export const authVerifyLimiter = createAuthLimiter(10, "Auth verify");

/**
 * Auth required middleware - verifies JWT bearer token
 * Sets req.auth = {wallet, role}
 */
export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const decoded = jwt.verify(token, appJwtSecret, {
      algorithms: ["HS256"],
      issuer: "popup-api",
      audience: "popup-client",
    });

    req.auth = {
      wallet: normalizeWallet(decoded.wallet || ""),
      role: decoded.role || "collector",
    };

    if (!req.auth.wallet) {
      return res.status(401).json({ error: "Invalid token: missing wallet claim" });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn(`Auth token validation failed: ${error.message}`);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Admin only middleware - requires admin role
 */
export function adminRequired(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/**
 * Same wallet or admin check - ensure user owns resource or is admin
 */
export function sameWalletOrAdmin(resourceWallet, auth) {
  if (!auth) return false;
  if (auth.role === "admin") return true;
  return normalizeAndCompare(resourceWallet, auth.wallet);
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/challenge
 * Issue nonce for wallet challenge
 */
const authChallengeImpl = async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    cleanupExpiredNonces().catch((cleanupError) => {
      console.warn("Nonce cleanup failed (continuing):", cleanupError?.message || cleanupError);
    });

    const { nonce, issuedAt } = await issueNonce(wallet);
    const message = makeChallengeMessage(wallet, nonce);

    return res.json({ wallet, nonce, issuedAt, message });
  } catch (error) {
    console.error("Challenge error:", error);
    const isDev = process.env.NODE_ENV === "development";
    return res
      .status(500)
      .json({ error: isDev ? error.message : "Failed to issue challenge" });
  }
};

router.post("/challenge", authChallengeLimiter, authChallengeImpl);

/**
 * POST /auth/verify
 * Verify wallet signature and return API token
 */
const authVerifyImpl = async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    const signature = req.body?.signature;
    const nonce = req.body?.nonce;

    if (!ethers.isAddress(wallet) || !signature || !nonce) {
      return res
        .status(400)
        .json({ error: "Wallet, signature, and nonce are required" });
    }

    await cleanupExpiredNonces().catch((cleanupError) => {
      console.warn(
        "Nonce cleanup failed before verification:",
        cleanupError?.message || cleanupError
      );
    });

    const nonceRecord = await getValidNonceRecord(wallet, nonce);
    const message = makeChallengeMessage(wallet, nonceRecord.nonce);
    const recovered = normalizeWallet(ethers.verifyMessage(message, signature));

    if (recovered !== wallet) {
      console.warn("Failed signature verification for an auth request");
      return res.status(401).json({ error: "Signature verification failed" });
    }

    const { error: updateError } = await supabase
      .from("nonces")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", nonceRecord.id);

    if (updateError) {
      console.error("Failed to mark nonce as used:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to finalize authenticated session" });
    }

    const role = await resolveRole(wallet);
    const apiToken = issueAppToken({ wallet, role });
    const supabaseToken = issueSupabaseToken({ wallet, role });

    return res.json({
      wallet,
      role,
      apiToken,
      supabaseToken,
      expiresInSeconds: 12 * 60 * 60,
    });
  } catch (error) {
    console.error("Verification error:", error);
    const isDev = process.env.NODE_ENV === "development";
    return res
      .status(500)
      .json({ error: isDev ? error.message : "Verification failed" });
  }
};

router.post("/verify", authVerifyLimiter, authVerifyImpl);

/**
 * GET /auth/session
 * Get current session info
 */
router.get("/session", authRequired, (req, res) => {
  return res.json({ wallet: req.auth.wallet, role: req.auth.role });
});

export default router;
