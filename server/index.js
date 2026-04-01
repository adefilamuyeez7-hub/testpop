import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistCandidates = [
  path.resolve(__dirname, "dist"),
  path.resolve(__dirname, "../dist"),
  path.resolve(process.cwd(), "server", "dist"),
  path.resolve(process.cwd(), "dist"),
];
const frontendDistPath =
  frontendDistCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html"))
  ) ||
  frontendDistCandidates.find((candidate) => fs.existsSync(candidate)) ||
  frontendDistCandidates[0];
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const LEGACY_DROP_COLUMNS = new Set([
  "id",
  "artist_id",
  "title",
  "description",
  "price_eth",
  "supply",
  "sold",
  "image_url",
  "image_ipfs_uri",
  "metadata_ipfs_uri",
  "status",
  "type",
  "contract_address",
  "contract_drop_id",
  "contract_kind",
  "revenue",
  "ends_at",
  "created_at",
  "updated_at",
]);

function stripUnsupportedDropColumns(drop = {}) {
  return Object.fromEntries(
    Object.entries(drop).filter(([key, value]) => LEGACY_DROP_COLUMNS.has(key) && value !== undefined)
  );
}

function isMissingDropColumnError(message = "") {
  const normalized = String(message).toLowerCase();
  return (
    normalized.includes("could not find the") ||
    normalized.includes("schema cache") ||
    normalized.includes("column") && normalized.includes("drops")
  );
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

[
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, ".env.local"),
  path.resolve(__dirname, ".env"),
].forEach((envPath) => {
  loadEnvFile(envPath);
});

const {
  PORT = "8787",
  FRONTEND_ORIGIN = "http://localhost:5173,https://testpop-one.vercel.app",
  APP_JWT_SECRET,
  JWT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET,
  PINATA_JWT,
  ADMIN_WALLETS = "",
  BASE_SEPOLIA_RPC_URL: rawBaseSepoliaRpcUrl = "https://sepolia.base.org",
  ART_DROP_FACTORY_ADDRESS: rawArtDropFactoryAddress = "0x2d044a0AFAbE0C07Ee12b8f4c18691b82fb6cF01",
  DEPLOYER_PRIVATE_KEY: rawDeployerPrivateKey,
  NODE_ENV = "development",
} = process.env;

const BASE_SEPOLIA_RPC_URL = rawBaseSepoliaRpcUrl.trim();
const ART_DROP_FACTORY_ADDRESS = rawArtDropFactoryAddress.trim();
const DEPLOYER_PRIVATE_KEY = rawDeployerPrivateKey?.trim();

const appJwtSecret = APP_JWT_SECRET || JWT_SECRET;

if (!appJwtSecret) {
  throw new Error("APP_JWT_SECRET or JWT_SECRET is required");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// Log startup configuration
console.log("═══════════════════════════════════════════════════════════");
console.log("🚀 PopUp API Starting");
console.log("═══════════════════════════════════════════════════════════");
console.log("📍 Environment:", NODE_ENV);
console.log("🌐 Frontend Origin:", FRONTEND_ORIGIN);
console.log("🔐 Admin Wallets:", ADMIN_WALLETS || "none");
console.log("═══════════════════════════════════════════════════════════");


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();

// Multer config: 10MB max with MIME type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max to match the frontend uploader
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/flac',
      'audio/mp4',
      'application/pdf',
      'application/epub+zip',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// Nonce storage moved to Supabase (see: auth/challenge and auth/verify endpoints)

function normalizeWallet(wallet = "") {
  return wallet.trim().toLowerCase();
}

function requireEnv(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function isPlaceholderSecret(value = "") {
  const normalized = String(value).trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("your_") ||
    normalized.includes("[your") ||
    normalized.includes("change_in_production") ||
    normalized.includes("placeholder")
  );
}

function isValidPrivateKey(value = "") {
  const normalized = String(value).trim();
  return /^0x[0-9a-fA-F]{64}$/.test(normalized);
}

function isMissingArtistContractColumnError(error) {
  const message = error?.message || "";
  return (
    typeof message === "string" &&
    message.includes("schema cache") &&
    (
      message.includes("'contract_address'") ||
      message.includes("'contract_deployment_tx'") ||
      message.includes("'contract_deployed_at'")
    )
  );
}

function isMissingArtistProfileColumnError(error, columnName) {
  const message = error?.message || "";
  return (
    typeof message === "string" &&
    message.includes("does not exist") &&
    message.includes(`artists.${columnName}`)
  );
}

function isMissingProductColumnError(error, columnName) {
  const message = error?.message || "";
  return (
    typeof message === "string" &&
    message.includes("does not exist") &&
    message.includes(`products.${columnName}`)
  );
}

let artistContractColumnsReady = null;

async function ensureArtistContractColumnsReady() {
  if (artistContractColumnsReady !== null) {
    return artistContractColumnsReady;
  }

  const { error } = await supabase
    .from("artists")
    .select("contract_address, contract_deployment_tx, contract_deployed_at")
    .limit(1);

  if (error && isMissingArtistContractColumnError(error)) {
    artistContractColumnsReady = false;
    return false;
  }

  if (error) {
    throw new Error(`Unable to verify artist contract metadata columns: ${error.message}`);
  }

  artistContractColumnsReady = true;
  return true;
}

async function findArtistIdByWallet(wallet) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("artists")
    .select("id")
    .eq("wallet", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve artist for wallet ${normalized}: ${error.message}`);
  }

  return data?.id || null;
}

function getContractDeploymentReadiness() {
  const missing = [];
  const invalid = [];

  if (!DEPLOYER_PRIVATE_KEY) missing.push("DEPLOYER_PRIVATE_KEY");
  if (!BASE_SEPOLIA_RPC_URL) missing.push("BASE_SEPOLIA_RPC_URL");
  if (!ART_DROP_FACTORY_ADDRESS) missing.push("ART_DROP_FACTORY_ADDRESS");

  if (DEPLOYER_PRIVATE_KEY && (isPlaceholderSecret(DEPLOYER_PRIVATE_KEY) || !isValidPrivateKey(DEPLOYER_PRIVATE_KEY))) {
    invalid.push("DEPLOYER_PRIVATE_KEY");
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

// ──────────────────────────────────────────────
//  Nonce Management (Supabase-backed for multi-instance support)
// ──────────────────────────────────────────────
async function issueNonce(wallet) {
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const { error } = await supabase.from("nonces").insert({
    wallet: normalizeWallet(wallet),
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

async function getValidNonceRecord(wallet, nonce) {
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

async function cleanupExpiredNonces() {
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

function makeChallengeMessage(wallet, nonce) {
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

function issueAppToken(payload) {
  return jwt.sign(payload, appJwtSecret, {
    algorithm: "HS256",
    expiresIn: "12h",
    issuer: "popup-api",
    audience: "popup-client",
  });
}

function issueSupabaseToken({ wallet, role }) {
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

async function resolveRole(wallet) {
  const normalized = normalizeWallet(wallet);
  const adminWallets = ADMIN_WALLETS.split(",").map(normalizeWallet).filter(Boolean);
  if (adminWallets.includes(normalized)) return "admin";

  const { data } = await supabase
    .from("whitelist")
    .select("status")
    .eq("wallet", normalized)
    .maybeSingle();

  if (data?.status === "approved") return "artist";
  return "collector";
}

function authRequired(req, res, next) {
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

    if (!req.auth.wallet) return res.status(401).json({ error: "Invalid session" });
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminRequired(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

function sameWalletOrAdmin(targetWallet, auth) {
  return auth?.role === "admin" || normalizeWallet(targetWallet) === auth?.wallet;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION HELPERS - Register routes for both / and /api prefixes
// ═════════════════════════════════════════════════════════════════════════════

const routes = {}; // Store route definitions

// Helper to register a route at both paths
function registerRoute(method, path, ...handlers) {
  const handler = handlers[handlers.length - 1]; // Last arg is the handler
  const middleware = handlers.slice(0, -1); // All others are middleware
  
  // Register at original path
  app[method](`${path}`, ...middleware, handler);
  
  // Register at /api path  
  app[method](`/api${path}`, ...middleware, handler);
  
  console.log(`✅ Registered ${method.toUpperCase()} ${path} and /api${path}`);
}

// CORS origin validation - ensure only valid HTTPS URLs in production
function isValidOrigin(origin) {
  try {
    const url = new URL(origin);
    // Only allow https in production
    if (NODE_ENV === 'production' && url.protocol !== 'https:') {
      console.warn(`⚠️ HTTP origin rejected in production: ${origin}`);
      return false;
    }
    // Allow localhost, vercel.app, and popup domains
    return ['localhost', '127.0.0.1', 'vercel.app'].some(host => url.hostname.includes(host));
  } catch (err) {
    console.warn(`⚠️ Invalid origin URL format: ${origin}`);
    return false;
  }
}

// Rate limiters for security
function getAuthRateLimitKey(req) {
  const wallet = normalizeWallet(req.body?.wallet);
  const actor = wallet || req.ip || 'unknown';
  return `${req.path}:${actor}`;
}

function createAuthLimiter(max, label) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    keyGenerator: (req) => getAuthRateLimitKey(req),
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`🚨 ${label} rate limit exceeded for ${getAuthRateLimitKey(req)}`);
      res.status(429).json({ error: 'Too many authentication attempts, please try again later' });
    },
  });
}

const authChallengeLimiter = createAuthLimiter(10, 'Auth challenge');
const authVerifyLimiter = createAuthLimiter(10, 'Auth verify');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per user per hour
  keyGenerator: (req) => req.auth?.wallet || req.ip || 'unknown',
  message: 'Too many upload attempts, please try again later',
});

const FACTORY_ABI = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_artistWallet", type: "address" }],
    name: "deployArtDrop",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_artist", type: "address" }],
    name: "getArtistContract",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_artist", type: "address" },
      { internalType: "bool", name: "_approved", type: "bool" },
    ],
    name: "setArtistApproval",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_artist", type: "address" }],
    name: "isArtistApproved",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "artist", type: "address" },
      { indexed: true, internalType: "address", name: "artDropContract", type: "address" },
      { indexed: true, internalType: "address", name: "founder", type: "address" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "ArtDropDeployed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "artist", type: "address" },
      { indexed: false, internalType: "bool", name: "approved", type: "bool" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "ArtistApprovalUpdated",
    type: "event",
  },
];

async function setArtistApprovalOnchain(wallet, isApproved) {
  requireEnv(DEPLOYER_PRIVATE_KEY, "DEPLOYER_PRIVATE_KEY");
  requireEnv(BASE_SEPOLIA_RPC_URL, "BASE_SEPOLIA_RPC_URL");
  requireEnv(ART_DROP_FACTORY_ADDRESS, "ART_DROP_FACTORY_ADDRESS");

  const artistWallet = ethers.getAddress(wallet);
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const factory = new ethers.Contract(ART_DROP_FACTORY_ADDRESS, FACTORY_ABI, signer);
  const signerAddress = ethers.getAddress(await signer.getAddress());
  const ownerAddress = ethers.getAddress(await factory.owner());

  if (signerAddress !== ownerAddress) {
    throw new Error(
      `DEPLOYER_PRIVATE_KEY wallet ${signerAddress} is not the factory owner ${ownerAddress}`
    );
  }

  const currentlyApproved = await factory.isArtistApproved(artistWallet);
  if (currentlyApproved === isApproved) {
    return {
      transactionHash: null,
      blockNumber: null,
      gasUsed: null,
      skipped: true,
      alreadyInState: true,
    };
  }

  // Call setArtistApproval on the factory contract
  const tx = await factory.setArtistApproval(artistWallet, isApproved);
  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber,
    gasUsed: receipt?.gasUsed?.toString(),
  };
}

async function deployArtistContractForWallet(wallet) {
  requireEnv(DEPLOYER_PRIVATE_KEY, "DEPLOYER_PRIVATE_KEY");
  requireEnv(BASE_SEPOLIA_RPC_URL, "BASE_SEPOLIA_RPC_URL");
  requireEnv(ART_DROP_FACTORY_ADDRESS, "ART_DROP_FACTORY_ADDRESS");

  const artistWallet = ethers.getAddress(wallet);
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const factory = new ethers.Contract(ART_DROP_FACTORY_ADDRESS, FACTORY_ABI, signer);
  const signerAddress = ethers.getAddress(await signer.getAddress());
  const ownerAddress = ethers.getAddress(await factory.owner());

  if (signerAddress !== ownerAddress) {
    throw new Error(
      `DEPLOYER_PRIVATE_KEY wallet ${signerAddress} is not the factory owner ${ownerAddress}`
    );
  }

  const existingContractAddress = await factory.getArtistContract(artistWallet);
  if (existingContractAddress && existingContractAddress !== ethers.ZeroAddress) {
    return {
      contractAddress: ethers.getAddress(existingContractAddress),
      deploymentTx: null,
      alreadyDeployed: true,
    };
  }

  let tx;
  try {
    tx = await factory.deployArtDrop(artistWallet);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Artist already has contract")) {
      const contractAddress = await factory.getArtistContract(artistWallet);
      if (contractAddress && contractAddress !== ethers.ZeroAddress) {
        return {
          contractAddress: ethers.getAddress(contractAddress),
          deploymentTx: null,
          alreadyDeployed: true,
        };
      }
    }
    throw error;
  }

  const receipt = await tx.wait();

  const deployedEvent = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "ArtDropDeployed");

  const contractAddress =
    deployedEvent?.args?.artDropContract ||
    deployedEvent?.args?.[1] ||
    (await factory.getArtistContract(artistWallet));

  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Factory deployment succeeded but contract address could not be resolved");
  }

  return {
    contractAddress: ethers.getAddress(contractAddress),
    deploymentTx: tx.hash,
    alreadyDeployed: false,
  };
}

async function getLatestArtistApplication(wallet) {
  const normalized = normalizeWallet(wallet);

  const { data, error } = await supabase
    .from("artist_applications")
    .select("*")
    .eq("wallet_address", normalized)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch artist application: ${error.message}`);
  }

  return data;
}

async function ensureArtistProfile(wallet) {
  const normalized = normalizeWallet(wallet);

  const { data: existingArtist, error: existingArtistError } = await supabase
    .from("artists")
    .select("*")
    .eq("wallet", normalized)
    .maybeSingle();

  if (existingArtistError) {
    throw new Error(`Cannot fetch artist: ${existingArtistError.message}`);
  }

  if (existingArtist) {
    return existingArtist;
  }

  const application = await getLatestArtistApplication(normalized);
  const now = new Date().toISOString();
  const portfolio = application?.portfolio_url ? [application.portfolio_url] : [];

  const { data: createdArtist, error: createArtistError } = await supabase
    .from("artists")
    .upsert(
      {
        wallet: normalized,
        name: application?.artist_name || normalized,
        bio: application?.bio || null,
        tag: Array.isArray(application?.art_types) && application.art_types.length > 0 ? application.art_types[0] : null,
        twitter_url: application?.twitter_url || null,
        instagram_url: application?.instagram_url || null,
        website_url: application?.website_url || application?.portfolio_url || null,
        portfolio,
        updated_at: now,
      },
      { onConflict: "wallet" }
    )
    .select("*")
    .single();

  if (createArtistError) {
    throw new Error(`Failed to create artist profile: ${createArtistError.message}`);
  }

  return createdArtist;
}

async function syncArtistApplicationStatus(wallet, status, reviewedBy, adminNotes = null) {
  const application = await getLatestArtistApplication(wallet);

  if (!application) {
    return null;
  }

  const { data, error } = await supabase
    .from("artist_applications")
    .update({
      status,
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", application.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update artist application: ${error.message}`);
  }

  return data;
}

app.use(helmet());

// Log and validate CORS configuration
const corsOrigins = FRONTEND_ORIGIN.split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .filter(origin => isValidOrigin(origin));

if (corsOrigins.length === 0) {
  throw new Error("\u274c No valid CORS origins configured. Check FRONTEND_ORIGIN environment variable.");
}

console.log("\ud83d\udd10 CORS Origins configured and validated:", corsOrigins);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Explicit OPTIONS handler for preflight requests
app.options('*', cors());

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

// ═════════════════════════════════════════════════════════════════════════════
// STATIC FILE SERVING - Serve frontend SPA from dist folder
// On Vercel, dist/ is copied to server/ by buildCommand
// ═════════════════════════════════════════════════════════════════════════════

app.use(express.static(frontendDistPath, {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    // Cache static assets long-term
    if (/\.(js|css|woff|woff2|ttf|eot|ico)$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Don't cache HTML
    else if (/\.html$/i.test(filePath)) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ═════════════════════════════════════════════════════════════════════════════
// URL REWRITING MIDDLEWARE - Critical for Vercel serverless
// When Vercel routes /api/auth/challenge -> server/api/index.js,
// the Express app receives the FULL path with /api prefix.
// We need to rewrite it so routes match.
// ═════════════════════════════════════════════════════════════════════════════

app.use((req, res, next) => {
  // Log EVERY request with full details
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📥 INCOMING REQUEST`);
  console.log(`   method: ${req.method}`);
  console.log(`   originalUrl: ${req.originalUrl}`);
  console.log(`   url: ${req.url}`);
  console.log(`   path: ${req.path}`);
  console.log(`   baseUrl: ${req.baseUrl}`);
  console.log(`   hostname: ${req.hostname}`);
  console.log(`   protocol: ${req.protocol}`);
  
  // Strip /api prefix - required for Vercel routing
  if (req.originalUrl?.startsWith('/api/')) {
    const newUrl = req.originalUrl.substring(4); // Remove '/api' (4 chars)
    console.log(`   ⚙️ REWRITING: ${req.originalUrl} → ${newUrl}`);
    req.url = newUrl;
    // Force Express to re-parse the new URL for routing
  } else if (req.url?.startsWith('/api/')) {
    const newUrl = req.url.substring(4);
    console.log(`   ⚙️ REWRITING url: ${req.url} → ${newUrl}`);
    req.url = newUrl;
  }
  
  console.log(`   AFTER REWRITE: url=${req.url}, path=${req.path}`);
  console.log(`${'═'.repeat(80)}\n`);
  next();
});

// Log all requests right before routing
app.use((req, res, next) => {
  console.log(`📨 ROUTING: ${req.method} ${req.url} (original path was ${req.path})`);
  next();
});

app.get("/health", (_req, res) => {
  console.log("✅ /health endpoint called");
  res.json({ ok: true, service: "popup-api", env: NODE_ENV });
});

// DEBUG: Check if dist folder exists
app.get("/debug/dist-status", (req, res) => {
  const distPath = frontendDistPath;
  const indexPath = frontendIndexPath;
  const distExists = fs.existsSync(distPath);
  const indexExists = fs.existsSync(indexPath);
  const dirContents = distExists ? fs.readdirSync(distPath).slice(0, 10) : [];
  
  // Check various potential locations
  const taskPath = '/var/task';
  const taskContents = fs.readdirSync(taskPath).sort();
  
  const taskDist = path.join(taskPath, 'dist');
  const taskDistServerDist = path.join(taskPath, 'server', 'dist');
  const vcDist = path.join(taskPath, '___vc', 'dist');
  const vcOutput = path.join(taskPath, '___vc', '.vc-config.json');
  
  // List server directory
  const serverPath = path.join(taskPath, 'server');
  const serverContents = fs.existsSync(serverPath) ? fs.readdirSync(serverPath).slice(0, 20) : [];
  
  // Check ___vc directory for output info
  const vcPath = path.join(taskPath, '___vc');
  const vcContents = fs.existsSync(vcPath) ? fs.readdirSync(vcPath).slice(0, 20) : [];
  
  res.json({
    "__dirname": __dirname,
    "process.cwd()": process.cwd(),
    "frontendDistCandidates": frontendDistCandidates,
    "distPath": distPath,
    "distExists": distExists,
    "indexExists": indexExists,
    "distContents": dirContents.length,
    "taskPath": taskPath,
    "taskContents": taskContents,
    "taskDist_exists": fs.existsSync(taskDist),
    "taskDistServerDist_exists": fs.existsSync(taskDistServerDist),
    "vcDist_exists": fs.existsSync(vcDist),
    "vcOutput_exists": fs.existsSync(vcOutput),
    "serverContents": serverContents,
    "vcContents": vcContents,
    "NODE_ENV": NODE_ENV
  });
});

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ AUTH ROUTES - Registered at both /path and /api/path for Vercel           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const authChallengeImpl = async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    await cleanupExpiredNonces();
    const { nonce, issuedAt } = await issueNonce(wallet);
    const message = makeChallengeMessage(wallet, nonce);

    return res.json({ wallet, nonce, issuedAt, message });
  } catch (error) {
    console.error("Challenge error:", error);
    const isDev = NODE_ENV === 'development';
    return res.status(500).json({ error: isDev ? error.message : "Failed to issue challenge" });
  }
};

// Register at both /auth/challenge and /api/auth/challenge
app.post("/auth/challenge", authChallengeLimiter, authChallengeImpl);
app.post("/api/auth/challenge", authChallengeLimiter, authChallengeImpl);

const authVerifyImpl = async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    const signature = req.body?.signature;
    const nonce = req.body?.nonce;

    if (!ethers.isAddress(wallet) || !signature || !nonce) {
      return res.status(400).json({ error: "Wallet, signature, and nonce are required" });
    }

    await cleanupExpiredNonces();
    const nonceRecord = await getValidNonceRecord(wallet, nonce);

    const message = makeChallengeMessage(wallet, nonceRecord.nonce);
    const recovered = normalizeWallet(ethers.verifyMessage(message, signature));

    if (recovered !== wallet) {
      console.warn(`🔓 Failed signature verification for ${wallet} from ${req.ip}`);
      return res.status(401).json({ error: "Signature verification failed" });
    }

    const { error: updateError } = await supabase
      .from("nonces")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", nonceRecord.id);

    if (updateError) {
      console.error("Failed to mark nonce as used:", updateError);
      return res.status(500).json({ error: "Failed to finalize authenticated session" });
    }

    const role = await resolveRole(wallet);
    const apiToken = issueAppToken({ wallet, role });
    const supabaseToken = issueSupabaseToken({ wallet, role });

    console.log(`✅ Auth verified for ${wallet} (role: ${role})`);
    return res.json({
      wallet,
      role,
      apiToken,
      supabaseToken,
      expiresInSeconds: 12 * 60 * 60,
    });
  } catch (error) {
    console.error("Verification error:", error);
    const isDev = NODE_ENV === 'development';
    return res.status(500).json({ error: isDev ? error.message : "Verification failed" });
  }
};

// Register at both /auth/verify and /api/auth/verify
app.post("/auth/verify", authVerifyLimiter, authVerifyImpl);
app.post("/api/auth/verify", authVerifyLimiter, authVerifyImpl);

app.get("/auth/session", authRequired, (req, res) => {
  return res.json({ wallet: req.auth.wallet, role: req.auth.role });
});

// Also at /api/auth/session
app.get("/api/auth/session", authRequired, (req, res) => {
  return res.json({ wallet: req.auth.wallet, role: req.auth.role });
});

app.post("/artists/profile", authRequired, async (req, res) => {
  const wallet = normalizeWallet(req.body?.wallet);
  if (!sameWalletOrAdmin(wallet, req.auth)) {
    return res.status(403).json({ error: "Cannot edit another wallet profile" });
  }

  const profile = req.body?.profile || {};
  const payload = {
    wallet,
    name: profile.name ?? null,
    handle: profile.handle ?? null,
    bio: profile.bio ?? null,
    tag: profile.tag ?? null,
    role: profile.role ?? null,
    subscription_price: profile.subscription_price ?? null,
    avatar_url: profile.avatar_url ?? null,
    banner_url: profile.banner_url ?? null,
    twitter_url: profile.twitter_url ?? null,
    instagram_url: profile.instagram_url ?? null,
    website_url: profile.website_url ?? null,
    poap_allocation: profile.poap_allocation ?? undefined,
    portfolio: profile.portfolio ?? undefined,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("artists")
    .upsert(payload, { onConflict: "wallet" })
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.post("/artists/contract-address", authRequired, async (req, res) => {
  const wallet = normalizeWallet(req.body?.wallet);
  if (!sameWalletOrAdmin(wallet, req.auth)) {
    return res.status(403).json({ error: "Cannot update another wallet contract address" });
  }

  const { contractAddress, deploymentTx } = req.body || {};
  if (!contractAddress || !deploymentTx) {
    return res.status(400).json({ error: "contractAddress and deploymentTx are required" });
  }

  const { data, error } = await supabase
    .from("artists")
    .update({
      contract_address: contractAddress,
      contract_deployment_tx: deploymentTx,
      contract_deployed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("wallet", wallet)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.post("/drops", authRequired, async (req, res) => {
  const drop = req.body || {};
  const artistId = drop.artist_id;
  if (!artistId) return res.status(400).json({ error: "artist_id is required" });

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id,wallet")
    .eq("id", artistId)
    .single();

  if (artistError) return res.status(400).json({ error: artistError.message });
  if (!sameWalletOrAdmin(artist.wallet, req.auth)) {
    return res.status(403).json({ error: "Cannot create a drop for another artist" });
  }

  let insertPayload = { ...drop };
  let { data, error } = await supabase
    .from("drops")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error && isMissingDropColumnError(error.message)) {
    insertPayload = stripUnsupportedDropColumns(drop);
    ({ data, error } = await supabase
      .from("drops")
      .insert(insertPayload)
      .select("*")
      .single());
  }

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.patch("/drops/:id", authRequired, async (req, res) => {
  const id = req.params.id;
  const { data: existing, error: existingError } = await supabase
    .from("drops")
    .select("id, artist_id, artists!inner(wallet)")
    .eq("id", id)
    .single();

  if (existingError) return res.status(404).json({ error: existingError.message });
  const ownerWallet = existing.artists.wallet;
  if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot update another artist drop" });
  }

  const { data, error } = await supabase
    .from("drops")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.delete("/drops/:id", authRequired, async (req, res) => {
  const id = req.params.id;
  const { data: existing, error: existingError } = await supabase
    .from("drops")
    .select("id, artist_id, artists!inner(wallet)")
    .eq("id", id)
    .single();

  if (existingError) return res.status(404).json({ error: existingError.message });
  const ownerWallet = existing.artists.wallet;
  if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot delete another artist drop" });
  }

  const { error } = await supabase.from("drops").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(204).send();
});

app.post("/products", authRequired, async (req, res) => {
  const product = req.body || {};
  const creatorWallet = normalizeWallet(product.creator_wallet);
  if (!creatorWallet) return res.status(400).json({ error: "creator_wallet is required" });
  if (!sameWalletOrAdmin(creatorWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot create products for another wallet" });
  }

  let inferredArtistId = product.artist_id ?? null;
  if (!inferredArtistId) {
    try {
      inferredArtistId = await findArtistIdByWallet(creatorWallet);
    } catch (resolveError) {
      return res.status(400).json({ error: resolveError.message || "Failed to resolve artist for product" });
    }
  }

  let insertPayload = {
    ...product,
    creator_wallet: creatorWallet,
    artist_id: inferredArtistId,
  };

  let { data, error } = await supabase
    .from("products")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error && isMissingProductColumnError(error, "artist_id")) {
    insertPayload = {
      ...product,
      creator_wallet: creatorWallet,
    };

    ({ data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("*")
      .single());
  }

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.patch("/products/:id", authRequired, async (req, res) => {
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id, creator_wallet")
    .eq("id", req.params.id)
    .single();

  if (existingError) return res.status(404).json({ error: existingError.message });
  if (!sameWalletOrAdmin(existing.creator_wallet, req.auth)) {
    return res.status(403).json({ error: "Cannot update another creator product" });
  }

  const { data, error } = await supabase
    .from("products")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

function toPositiveInteger(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function roundEth(value) {
  return Number(toNonNegativeNumber(value).toFixed(8));
}

function normalizeShippingAddress(rawShipping) {
  if (typeof rawShipping === "string") {
    const fullAddress = rawShipping.trim();
    return fullAddress ? { full_address: fullAddress } : null;
  }

  if (!rawShipping || typeof rawShipping !== "object" || Array.isArray(rawShipping)) {
    return null;
  }

  const shipping = {
    name: typeof rawShipping.name === "string" ? rawShipping.name.trim() : "",
    email: typeof rawShipping.email === "string" ? rawShipping.email.trim() : "",
    phone: typeof rawShipping.phone === "string" ? rawShipping.phone.trim() : "",
    dial_code: typeof rawShipping.dial_code === "string" ? rawShipping.dial_code.trim() : "",
    street: typeof rawShipping.street === "string" ? rawShipping.street.trim() : "",
    city: typeof rawShipping.city === "string" ? rawShipping.city.trim() : "",
    state: typeof rawShipping.state === "string" ? rawShipping.state.trim() : "",
    postal_code: typeof rawShipping.postal_code === "string" ? rawShipping.postal_code.trim() : "",
    country: typeof rawShipping.country === "string" ? rawShipping.country.trim() : "",
    notes: typeof rawShipping.notes === "string" ? rawShipping.notes.trim() : "",
  };

  const fullAddress = [
    shipping.street,
    shipping.city,
    shipping.state,
    shipping.postal_code,
    shipping.country,
    shipping.phone ? `Phone: ${shipping.phone}` : "",
    shipping.notes ? `Notes: ${shipping.notes}` : "",
  ].filter(Boolean).join(", ");

  return {
    ...shipping,
    full_address: fullAddress,
  };
}

const LEGACY_ORDER_SELECT = `
  id,
  product_id,
  buyer_wallet,
  quantity,
  currency,
  subtotal_eth,
  shipping_eth,
  tax_eth,
  total_price_eth,
  status,
  shipping_address,
  shipping_address_jsonb,
  tracking_code,
  paid_at,
  shipped_at,
  delivered_at,
  created_at,
  updated_at,
  products(
    id,
    name,
    image_url,
    image_ipfs_uri,
    product_type,
    asset_type,
    preview_uri,
    delivery_uri,
    is_gated,
    creator_wallet
  )
`;

const ORDER_SELECT = `
  ${LEGACY_ORDER_SELECT},
  order_items(
    id,
    product_id,
    quantity,
    unit_price_eth,
    line_total_eth,
    fulfillment_type,
    delivery_status,
    products(
      id,
      name,
      image_url,
      image_ipfs_uri,
      product_type,
      asset_type,
      preview_uri,
      delivery_uri,
      is_gated,
      creator_wallet
    )
  )
`;

function isMissingOrderSchemaCompatError(errorOrMessage) {
  const message = typeof errorOrMessage === "string"
    ? errorOrMessage
    : errorOrMessage?.message || "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") &&
    (
      normalized.includes("create_checkout_order") ||
      normalized.includes("order_items")
    )
  );
}

function firstRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function normalizeOrderRecord(order) {
  if (!order || (Array.isArray(order.order_items) && order.order_items.length > 0)) {
    return order;
  }

  const product = firstRelationRecord(order.products);
  if (!order.product_id || !product) {
    return {
      ...order,
      order_items: [],
    };
  }

  const quantity = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  const lineTotal = Number(order.total_price_eth) || 0;

  return {
    ...order,
    order_items: [
      {
        id: `${order.id}:${order.product_id}`,
        product_id: order.product_id,
        quantity,
        unit_price_eth: quantity > 0 ? lineTotal / quantity : lineTotal,
        line_total_eth: lineTotal,
        fulfillment_type: product.product_type === "physical" ? "physical" : "digital",
        delivery_status: order.status || "paid",
        products: product,
      },
    ],
  };
}

async function listOrdersForBuyer(wallet) {
  let { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_wallet", wallet)
    .order("created_at", { ascending: false });

  if (error && isMissingOrderSchemaCompatError(error)) {
    ({ data, error } = await supabase
      .from("orders")
      .select(LEGACY_ORDER_SELECT)
      .eq("buyer_wallet", wallet)
      .order("created_at", { ascending: false }));
  }

  if (error) throw error;
  return (data || []).map(normalizeOrderRecord);
}

async function getOrderById(orderId) {
  let { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error && isMissingOrderSchemaCompatError(error)) {
    ({ data, error } = await supabase
      .from("orders")
      .select(LEGACY_ORDER_SELECT)
      .eq("id", orderId)
      .single());
  }

  if (error) throw error;
  return normalizeOrderRecord(data);
}

async function createLegacyCheckoutOrders({
  buyerWallet,
  normalizedItems,
  shippingAddressJsonb,
  currency,
  trackingCode,
}) {
  const productIds = normalizedItems.map((item) => item.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price_eth, stock, sold, status, product_type, asset_type, preview_uri, delivery_uri, image_url, image_ipfs_uri, is_gated, creator_wallet")
    .in("id", productIds);

  if (productsError) {
    throw new Error(productsError.message || "Failed to load products for checkout");
  }

  const productsById = new Map((products || []).map((product) => [product.id, product]));
  const createdOrderIds = [];

  for (const item of normalizedItems) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw new Error("One or more items are no longer available.");
    }

    if (product.status && product.status !== "published") {
      throw new Error(`${product.name || "Item"} is no longer available.`);
    }

    const currentStock = product.stock == null ? null : Number(product.stock);
    if (currentStock !== null && currentStock < item.quantity) {
      throw new Error(`${product.name || "Item"} only has ${Math.max(currentStock, 0)} left in stock.`);
    }

    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Number(product.price_eth) || 0;
    const totalPrice = roundEth(unitPrice * quantity);
    const shippingAddress = typeof shippingAddressJsonb?.full_address === "string"
      ? shippingAddressJsonb.full_address
      : "";

    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        buyer_wallet: buyerWallet,
        product_id: product.id,
        quantity,
        currency,
        total_price_eth: totalPrice,
        status: "paid",
        shipping_address: shippingAddress,
        tracking_code: trackingCode,
      })
      .select("id")
      .single();

    if (insertError || !insertedOrder?.id) {
      throw new Error(insertError?.message || "Failed to create order");
    }

    createdOrderIds.push(insertedOrder.id);

    const nextStock = currentStock === null ? null : Math.max(currentStock - quantity, 0);
    const nextSold = Math.max(Number(product.sold) || 0, 0) + quantity;
    const productUpdates = {
      sold: nextSold,
      ...(nextStock === null
        ? {}
        : {
            stock: nextStock,
            status: nextStock > 0 ? product.status || "published" : "out_of_stock",
          }),
    };

    const { error: updateProductError } = await supabase
      .from("products")
      .update(productUpdates)
      .eq("id", product.id);

    if (updateProductError) {
      throw new Error(updateProductError.message || "Failed to update product inventory");
    }
  }

  return createdOrderIds;
}

app.get("/orders", authRequired, async (req, res) => {
  const requestedWallet = normalizeWallet(typeof req.query.buyer_wallet === "string" ? req.query.buyer_wallet : req.auth.wallet);

  if (!sameWalletOrAdmin(requestedWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot view another wallet's orders" });
  }

  try {
    const data = await listOrdersForBuyer(requestedWallet);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/orders", authRequired, async (req, res) => {
  const order = req.body || {};
  const buyerWallet = normalizeWallet(order.buyer_wallet);
  if (!buyerWallet) return res.status(400).json({ error: "buyer_wallet is required" });
  if (!sameWalletOrAdmin(buyerWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot create an order for another wallet" });
  }

  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : order.product_id
      ? [{
          product_id: order.product_id,
          quantity: order.quantity || 1,
        }]
      : [];

  const mergedItems = new Map();
  for (const item of rawItems) {
    const productId = typeof item?.product_id === "string" ? item.product_id.trim() : "";
    if (!productId) continue;

    mergedItems.set(productId, (mergedItems.get(productId) || 0) + toPositiveInteger(item.quantity, 1));
  }

  const normalizedItems = Array.from(mergedItems.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));

  if (normalizedItems.length === 0) {
    return res.status(400).json({ error: "At least one order item is required" });
  }

  const shippingAddressJsonb = normalizeShippingAddress(order.shipping_address_jsonb ?? order.shipping_address);
  const shippingEth = roundEth(order.shipping_eth ?? 0);
  const taxEth = roundEth(order.tax_eth ?? 0);
  const currency = typeof order.currency === "string" && order.currency.trim() ? order.currency.trim() : "ETH";
  const trackingCode = typeof order.tracking_code === "string" && order.tracking_code.trim()
    ? order.tracking_code.trim()
    : `TRK-${Date.now().toString(36).toUpperCase()}`;
  let createdOrderIds = [];
  let orderError = null;

  const { data: createdOrderId, error: rpcOrderError } = await supabase.rpc("create_checkout_order", {
    p_buyer_wallet: buyerWallet,
    p_items: normalizedItems,
    p_shipping_address_jsonb: shippingAddressJsonb,
    p_shipping_eth: shippingEth,
    p_tax_eth: taxEth,
    p_currency: currency,
    p_tracking_code: trackingCode,
  });

  if (rpcOrderError && isMissingOrderSchemaCompatError(rpcOrderError)) {
    try {
      createdOrderIds = await createLegacyCheckoutOrders({
        buyerWallet,
        normalizedItems,
        shippingAddressJsonb,
        currency,
        trackingCode,
      });
    } catch (legacyError) {
      orderError = legacyError;
    }
  } else if (rpcOrderError || !createdOrderId) {
    orderError = rpcOrderError || new Error("Failed to create order");
  } else {
    createdOrderIds = [createdOrderId];
  }

  if (orderError || createdOrderIds.length === 0) {
    const errorMessage = orderError?.message || "Failed to create order";
    const lowered = errorMessage.toLowerCase();
    const statusCode =
      lowered.includes("left in stock") ||
      lowered.includes("no longer available") ||
      lowered.includes("just changed stock")
        ? 409
        : 400;

    return res.status(statusCode).json({ error: errorMessage });
  }

  try {
    const hydratedOrder = await getOrderById(createdOrderIds[0]);
    return res.json(hydratedOrder);
  } catch (_hydratedOrderError) {
    return res.json({ id: createdOrderIds[0] });
  }
});

app.patch("/orders/:id", authRequired, async (req, res) => {
  let { data: existing, error: existingError } = await supabase
    .from("orders")
    .select("id, buyer_wallet, product_id, products(creator_wallet), order_items(product_id, products(creator_wallet))")
    .eq("id", req.params.id)
    .single();

  if (existingError && isMissingOrderSchemaCompatError(existingError)) {
    ({ data: existing, error: existingError } = await supabase
      .from("orders")
      .select("id, buyer_wallet, product_id, products(creator_wallet)")
      .eq("id", req.params.id)
      .single());
  }

  if (existingError) return res.status(404).json({ error: existingError.message });

  const creatorWallets = new Set();
  const directCreatorWallet = existing.products?.creator_wallet;
  if (directCreatorWallet) creatorWallets.add(normalizeWallet(directCreatorWallet));

  for (const item of existing.order_items || []) {
    const itemProduct = Array.isArray(item.products) ? item.products[0] : item.products;
    const creatorWallet = itemProduct?.creator_wallet;
    if (creatorWallet) creatorWallets.add(normalizeWallet(creatorWallet));
  }

  const canUpdate =
    req.auth.role === "admin" ||
    Array.from(creatorWallets).includes(req.auth.wallet);

  if (!canUpdate) return res.status(403).json({ error: "Only the creator or admin can update this order" });

  const { data, error } = await supabase
    .from("orders")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.post("/whitelist", authRequired, async (req, res) => {
  const entry = req.body || {};
  const wallet = normalizeWallet(entry.wallet || req.auth.wallet);
  if (!sameWalletOrAdmin(wallet, req.auth)) {
    return res.status(403).json({ error: "Cannot submit whitelist entry for another wallet" });
  }

  const payload = {
    wallet,
    name: entry.name,
    tag: entry.tag ?? null,
    notes: entry.notes ?? null,
    status: req.auth.role === "admin" ? (entry.status ?? "pending") : "pending",
    joined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approved_at:
      req.auth.role === "admin" && entry.status === "approved" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("whitelist")
    .upsert(payload, { onConflict: "wallet" })
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.patch("/whitelist/:id", authRequired, adminRequired, async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  if (updates.status === "approved" && !updates.approved_at) {
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("whitelist")
    .update(updates)
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.delete("/whitelist/:id", authRequired, adminRequired, async (req, res) => {
  const { error } = await supabase
    .from("whitelist")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(204).send();
});

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ PINATA FILE UPLOAD ROUTES - Registered at both /path and /api/path        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const pinataFileImpl = async (req, res) => {
  try {
    requireEnv(PINATA_JWT, "PINATA_JWT");
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer]), req.file.originalname);

    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).send(text);
    }

    const parsed = JSON.parse(text);
    return res.json({
      cid: parsed?.data?.cid || parsed?.cid,
      uri: parsed?.data?.cid ? `ipfs://${parsed.data.cid}` : undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Pinata upload failed" });
  }
};

const pinataJsonImpl = async (req, res) => {
  try {
    requireEnv(PINATA_JWT, "PINATA_JWT");
    const metadata = req.body?.metadata;
    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({ error: "metadata object is required" });
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    const text = await response.text();
    if (!response.ok) return res.status(response.status).send(text);

    const parsed = JSON.parse(text);
    return res.json({
      cid: parsed?.IpfsHash,
      uri: parsed?.IpfsHash ? `ipfs://${parsed.IpfsHash}` : undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Pinata metadata upload failed" });
  }
};

// Register at both /pinata/* and /api/pinata/*
app.post("/pinata/file", authRequired, upload.single("file"), pinataFileImpl);
app.post("/api/pinata/file", authRequired, upload.single("file"), pinataFileImpl);
app.post("/pinata/json", authRequired, pinataJsonImpl);
app.post("/api/pinata/json", authRequired, pinataJsonImpl);

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Approve artist and deploy contract
 * Registered at both /admin/* and /api/admin/*
 * ═════════════════════════════════════════════════════════════
 */
const approveArtistImpl = async (req, res) => {
  try {
    const { wallet, approve = false, deployContract = true } = req.body || {};
    const normalized = normalizeWallet(wallet);
    
    if (!normalized) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    // Get artist profile
    const now = new Date().toISOString();
    const artistData = await ensureArtistProfile(normalized);
    const latestApplication = await getLatestArtistApplication(normalized);

    const artistName = artistData.name || latestApplication?.artist_name || normalized;

    // Provision onchain first so approve+deploy acts like a single workflow.
    let onchainUpdate = null;
    let contractAddress = artistData.contract_address;
    let deploymentTx = artistData.contract_deployment_tx;
    let deploymentError = null;
    const needsOnchainProvision = approve && deployContract;

    if (needsOnchainProvision) {
      const deploymentReadiness = getContractDeploymentReadiness();

      if (!deploymentReadiness.ready) {
        const configIssues = [
          deploymentReadiness.missing.length
            ? `missing ${deploymentReadiness.missing.join(", ")}`
            : null,
          deploymentReadiness.invalid.length
            ? `invalid ${deploymentReadiness.invalid.join(", ")}`
            : null,
        ].filter(Boolean);

        return res.status(500).json({
          error: `Contract deployment configuration error: ${configIssues.join("; ")}`,
        });
      }

      const hasArtistContractColumns = await ensureArtistContractColumnsReady();
      if (!hasArtistContractColumns) {
        return res.status(500).json({
          error: "Artist contract metadata columns are missing in Supabase. Apply the artist contract migration before deploying artists.",
        });
      }

      try {
        onchainUpdate = await setArtistApprovalOnchain(normalized, true);
        console.log("✅ Artist approval set onchain:", normalized);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown onchain approval error";
        console.error("❌ Onchain approval error:", err);
        return res.status(500).json({ error: `Onchain approval failed: ${message}` });
      }

      if (!contractAddress) {
        try {
          const deployment = await deployArtistContractForWallet(normalized);
          contractAddress = deployment.contractAddress;
          deploymentTx = deployment.deploymentTx;
          console.log("🚀 Contract deployed for artist:", normalized);
          console.log("   Contract address:", contractAddress);
        } catch (err) {
          deploymentError = err instanceof Error ? err.message : "Unknown deployment error";
          console.error("❌ Contract deployment error:", err);

          try {
            await setArtistApprovalOnchain(normalized, false);
            console.log("🔄 Reverted onchain approval after deployment failure:", normalized);
          } catch (rollbackErr) {
            console.error("❌ Failed to rollback onchain approval:", rollbackErr);
          }

          return res.status(500).json({ error: `Contract deployment failed: ${deploymentError}` });
        }
      }
    }

    // Update whitelist status only after the combined approve+deploy flow succeeds.
    const { error: whitelistError } = await supabase
      .from("whitelist")
      .upsert(
        {
          wallet: normalized,
          name: artistName,
          tag: artistData.tag || null,
          status: approve ? "approved" : "rejected",
          approved_at: approve ? now : null,
          rejection_reason: approve ? null : "Rejected by admin",
          updated_at: now,
          notes: null,
        },
        { onConflict: "wallet" }
      );

    if (whitelistError) {
      console.error("❌ Whitelist update error:", whitelistError);
      return res.status(400).json({ error: `Failed to update whitelist: ${whitelistError.message}` });
    }

    await syncArtistApplicationStatus(
      normalized,
      approve ? "approved" : "rejected",
      req.auth.wallet,
      null
    );

    // Update artist record with deployment status
    const updatePayload = {
      updated_at: now,
    };

    if (contractAddress) {
      updatePayload.contract_address = contractAddress;
      updatePayload.contract_deployment_tx = deploymentTx;
      updatePayload.contract_deployed_at = now;
    }

    let updateWarning = null;

    let { data: updatedArtist, error: updateError } = await supabase
      .from("artists")
      .upsert(
        {
          wallet: normalized,
          name: artistName,
          bio: artistData.bio || latestApplication?.bio || null,
          tag: artistData.tag || null,
          twitter_url: artistData.twitter_url || latestApplication?.twitter_url || null,
          instagram_url: artistData.instagram_url || latestApplication?.instagram_url || null,
          website_url: artistData.website_url || latestApplication?.website_url || latestApplication?.portfolio_url || null,
          portfolio:
            Array.isArray(artistData.portfolio) && artistData.portfolio.length > 0
              ? artistData.portfolio
              : latestApplication?.portfolio_url
                ? [latestApplication.portfolio_url]
                : [],
          ...updatePayload,
        },
        { onConflict: "wallet" }
      )
      .select("*")
      .single();

    if (updateError && contractAddress && isMissingArtistContractColumnError(updateError)) {
      return res.status(500).json({
        error: "Artist contract deployed onchain, but Supabase could not persist contract metadata. Apply the artist contract migration before approving more artists.",
      });
    }

    if (updateError) {
      return res.status(400).json({ error: `Failed to update artist: ${updateError.message}` });
    }

    // Log admin action (audit trail)
    const { error: auditLogError } = await supabase.from("admin_audit_log").insert({
      admin_wallet: req.auth.wallet,
      action: "approve_artist",
      target_wallet: normalized,
      status: approve ? "approved" : "rejected",
      details: {
        deploymentStatus: contractAddress ? "deployed" : deploymentError ? "failed" : "pending",
        contractAddress,
        deploymentTx,
        updateWarning,
      },
    });

    if (auditLogError) {
      console.warn("Audit log warning:", auditLogError.message);
    }

    return res.json({
      success: true,
      artist: updatedArtist,
      deployment: {
        status: contractAddress ? "deployed" : deploymentError ? "failed" : "pending",
        address: contractAddress,
        tx: deploymentTx,
        error: deploymentError,
      },
      onchain: onchainUpdate,
      warning: updateWarning,
    });
  } catch (error) {
    console.error("❌ Approval error:", error);
    return res.status(500).json({ error: error.message || "Approval processing failed" });
  }
};

// Register at both /admin/approve-artist and /api/admin/approve-artist
app.post("/admin/approve-artist", authRequired, adminRequired, approveArtistImpl);
app.post("/api/admin/approve-artist", authRequired, adminRequired, approveArtistImpl);

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Reject artist (dedicated endpoint)
 * Registered at both /admin/* and /api/admin/*
 * ═════════════════════════════════════════════════════════════
 */
const rejectArtistImpl = async (req, res) => {
  try {
    const { wallet, reason = "" } = req.body || {};
    const normalized = normalizeWallet(wallet);

    if (!normalized) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    const now = new Date().toISOString();
    const latestApplication = await getLatestArtistApplication(normalized);

    const { error: whitelistError } = await supabase
      .from("whitelist")
      .upsert(
        {
          wallet: normalized,
          name: latestApplication?.artist_name || normalized,
          status: "rejected",
          approved_at: null,
          rejection_reason: reason,
          updated_at: now,
        },
        { onConflict: "wallet" }
      );

    if (whitelistError) {
      console.error("❌ Whitelist rejection error:", whitelistError);
      return res.status(400).json({ error: `Failed to reject artist: ${whitelistError.message}` });
    }

    await syncArtistApplicationStatus(normalized, "rejected", req.auth.wallet, reason || null);

    // Update onchain whitelist (remove approval)
    let onchainUpdate = null;
    try {
      onchainUpdate = await setArtistApprovalOnchain(normalized, false);
      console.log("✅ Artist approval removed onchain:", normalized);
    } catch (err) {
      console.warn("⚠️ Onchain removal warning (non-blocking):", err.message);
      // Don't fail the entire operation if onchain update fails
    }

    // Update artist record
    const { data: updatedArtist, error: updateError } = await supabase
      .from("artists")
      .update({
        updated_at: now,
      })
      .eq("wallet", normalized)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return res.status(400).json({ error: `Failed to update artist: ${updateError.message}` });
    }

    // Log admin action (audit trail)
    const { error: auditLogError } = await supabase.from("admin_audit_log").insert({
      admin_wallet: req.auth.wallet,
      action: "reject_artist",
      target_wallet: normalized,
      status: "rejected",
      details: {
        reason,
      },
    });

    if (auditLogError) {
      console.warn("Audit log warning:", auditLogError.message);
    }

    return res.json({
      success: true,
      artist: updatedArtist,
      rejection: {
        reason,
        rejectedAt: new Date().toISOString(),
      },
      onchain: onchainUpdate,
    });
  } catch (error) {
    console.error("❌ Rejection error:", error);
    return res.status(500).json({ error: error.message || "Rejection processing failed" });
  }
};

// Register at both /admin/reject-artist and /api/admin/reject-artist
app.post("/admin/reject-artist", authRequired, adminRequired, rejectArtistImpl);
app.post("/api/admin/reject-artist", authRequired, adminRequired, rejectArtistImpl);

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Get pending and approved artists
 * Registered at both /admin/* and /api/admin/*
 * ═════════════════════════════════════════════════════════════
 */
const getAdminArtistsImpl = async (req, res) => {
  try {
    const { status } = req.query; // "pending", "approved", or undefined for all
    
    let query = supabase.from("whitelist").select("*");
    
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const whitelistEntries = data || [];
    const wallets = whitelistEntries
      .map((entry) => normalizeWallet(entry.wallet))
      .filter(Boolean);

    let artistsByWallet = new Map();
    if (wallets.length > 0) {
      let { data: artistRows, error: artistError } = await supabase
        .from("artists")
        .select("id, wallet, name, avatar_url, bio, contract_address")
        .in("wallet", wallets);

      if (artistError && isMissingArtistProfileColumnError(artistError, "contract_address")) {
        ({ data: artistRows, error: artistError } = await supabase
          .from("artists")
          .select("id, wallet, name, avatar_url, bio")
          .in("wallet", wallets));
      }

      if (artistError) {
        return res.status(400).json({ error: artistError.message });
      }

      artistsByWallet = new Map(
        (artistRows || []).map((artist) => [normalizeWallet(artist.wallet), artist])
      );
    }

    const merged = whitelistEntries.map((entry) => ({
      ...entry,
      artists: artistsByWallet.get(normalizeWallet(entry.wallet)) || null,
    }));

    return res.json({
      artists: merged,
      total: merged.length,
    });
  } catch (error) {
    console.error("❌ Admin artists fetch error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch artists" });
  }
};

// Register at both /admin/artists and /api/admin/artists
app.get("/admin/artists", authRequired, adminRequired, getAdminArtistsImpl);
app.get("/api/admin/artists", authRequired, adminRequired, getAdminArtistsImpl);

const port = Number(PORT) || 3000;

// ═════════════════════════════════════════════════════════════════════════════
// SPA FALLBACK - Serve index.html for all non-API routes
// This allows React Router to handle client-side navigation
// ═════════════════════════════════════════════════════════════════════════════
app.get('*', (req, res, next) => {
  // If it's an API route, skip to 404 handler
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  // For all other routes, serve index.html from dist
  console.log(`📄 SPA fallback: serving index.html for path: ${req.path}`);
  if (fs.existsSync(frontendIndexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html');
    return res.sendFile(frontendIndexPath);
  }
  
  // If index.html doesn't exist, continue to 404 handler
  next();
});

// 404 handler - API routes that don't match
app.use((_req, res) => {
  console.warn(`⚠️ 404 NOT FOUND: ${_req.method} ${_req.path} | Full URL: ${_req.originalUrl}`);
  res.status(404).json({ 
    error: "Endpoint not found", 
    path: _req.path, 
    method: _req.method,
    hint: "Check that your route is defined and /api prefix is correct for Vercel"
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  res.status(err.status || 500).json({ 
    error: err.message || "Internal server error",
    path: _req.path,
    method: _req.method
  });
});

// Only listen locally, not on Vercel serverless
if (NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`PopUp API listening on http://localhost:${port}`);
  });
}

// Export app for serverless (Vercel)
export default app;
