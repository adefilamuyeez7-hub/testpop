import jwt from "jsonwebtoken";

function normalizeWallet(wallet = "") {
  const normalized = String(wallet || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
}

function getAppJwtSecret(env = process.env) {
  return env.APP_JWT_SECRET || env.JWT_SECRET || "";
}

export function verifyApiBearerToken(authHeader, env = process.env) {
  const secret = getAppJwtSecret(env);
  if (!secret) {
    throw new Error("APP_JWT_SECRET is not configured");
  }

  const header = String(authHeader || "");
  const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];
  if (!token) {
    const error = new Error("Missing bearer token");
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "popup-api",
      audience: "popup-client",
    });

    const wallet = normalizeWallet(decoded.wallet || "");
    if (!wallet) {
      const error = new Error("Invalid session");
      error.statusCode = 401;
      throw error;
    }

    return {
      wallet,
      role: decoded.role || "collector",
      token,
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    const authError = new Error("Invalid or expired token");
    authError.statusCode = 401;
    throw authError;
  }
}

export function requireApiBearerAuth(req, env = process.env) {
  return verifyApiBearerToken(req?.headers?.authorization, env);
}
