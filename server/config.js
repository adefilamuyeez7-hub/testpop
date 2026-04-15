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

// Environment and configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Environment variables
const {
  PORT = "8787",
  FRONTEND_ORIGIN = "http://localhost:5173,https://testpop-one.vercel.app",
  APP_JWT_SECRET,
  JWT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SECRET_KEY,
  SUPABASE_JWT_SECRET,
  PINATA_JWT,
  PINATA_API_KEY,
  PINATA_API_SECRET,
  ADMIN_WALLETS = "",
  BASE_SEPOLIA_RPC_URL: rawBaseSepoliaRpcUrl = "https://sepolia-preconf.base.org",
  ART_DROP_FACTORY_ADDRESS: rawArtDropFactoryAddress = "0x2d044a0AFAbE0C07Ee12b8f4c18691b82fb6cF01",
  POAP_CAMPAIGN_V2_ADDRESS: rawPoapCampaignV2Address = "0x532dd9e3232B59eDc62B82e4822482696e49A627",
  PRODUCT_STORE_ADDRESS: rawProductStoreAddress = "0x58BB50b4370898dED4d5d724E4A521825a4B0cE6",
  CREATIVE_RELEASE_ESCROW_ADDRESS: rawCreativeReleaseEscrowAddress = "0xf95505B5c4738dc39250f32DeFd3E1FC3196C478",
  DEPLOYER_PRIVATE_KEY: rawDeployerPrivateKey,
  NODE_ENV = "development",
} = process.env;

const BASE_SEPOLIA_RPC_URL = rawBaseSepoliaRpcUrl.trim();
const ART_DROP_FACTORY_ADDRESS = rawArtDropFactoryAddress.trim();
const POAP_CAMPAIGN_V2_ADDRESS = rawPoapCampaignV2Address.trim();
const PRODUCT_STORE_ADDRESS = rawProductStoreAddress.trim();
const CREATIVE_RELEASE_ESCROW_ADDRESS = rawCreativeReleaseEscrowAddress.trim();
const DEPLOYER_PRIVATE_KEY = rawDeployerPrivateKey?.trim();
const SUPABASE_SERVER_KEY = SUPABASE_SECRET_KEY?.trim() || SUPABASE_SERVICE_ROLE_KEY?.trim();
const EXPIRED_DROP_RETENTION_HOURS = Math.max(24, Number(process.env.EXPIRED_DROP_RETENTION_HOURS || 24 * 30));
const DROP_MAINTENANCE_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.DROP_MAINTENANCE_INTERVAL_MS || 30 * 60 * 1000),
);

const appJwtSecret = APP_JWT_SECRET || JWT_SECRET;

// Constants
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
  "revenue",
  "ends_at",
  "created_at",
  "updated_at",
]);

const DROP_UPDATE_COLUMNS = new Set([
  "creative_release_id",
  "title",
  "description",
  "price_eth",
  "supply",
  "image_url",
  "image_ipfs_uri",
  "metadata_ipfs_uri",
  "asset_type",
  "preview_uri",
  "delivery_uri",
  "is_gated",
  "status",
  "type",
  "contract_address",
  "contract_drop_id",
  "contract_kind",
  "revenue",
  "ends_at",
  "metadata",
]);

const LIVE_DROP_STATUSES = ["live", "active", "published"];
const PUBLIC_PRODUCT_STATUSES = ["published", "active"];
const DEFAULT_IPFS_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";
const IPFS_GATEWAY_BASE = (process.env.VITE_IPFS_GATEWAY_URL || DEFAULT_IPFS_GATEWAY_BASE).replace(/\/$/, "");

const ARTIST_SUBSCRIPTION_ABI = [
  "function getSubscriberCount() view returns (uint256)",
];

// Utility functions
function stripUnsupportedDropColumns(drop = {}) {
  return Object.fromEntries(
    Object.entries(drop).filter(([key, value]) => LEGACY_DROP_COLUMNS.has(key) && value !== undefined)
  );
}

function normalizeDropMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function sanitizeDropPayload(drop = {}, { includeArtistId = false } = {}) {
  const allowedColumns = includeArtistId
    ? new Set([...DROP_UPDATE_COLUMNS, "artist_id"])
    : DROP_UPDATE_COLUMNS;

  const sanitized = Object.fromEntries(
    Object.entries(drop).filter(([key, value]) => allowedColumns.has(key) && value !== undefined)
  );

  if (Object.prototype.hasOwnProperty.call(sanitized, "metadata")) {
    sanitized.metadata = normalizeDropMetadata(sanitized.metadata);
  }

  return sanitized;
}

function isMissingDropColumnError(message = "") {
  const normalized = String(message).toLowerCase();
  return (
    normalized.includes("could not find the") ||
    normalized.includes("schema cache") ||
    normalized.includes("column") && normalized.includes("drops")
  );
}

function isBareIpfsCid(value = "") {
  return /^(bafy[a-z2-7]+|bafk[a-z2-7]+|Qm[1-9A-HJ-NP-Za-km-z]{44,})$/i.test(value.trim());
}

function resolveMediaProxyTarget(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const httpGatewayMatch = normalized.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
  if (httpGatewayMatch?.[1]) {
    return `${IPFS_GATEWAY_BASE}/${httpGatewayMatch[1]}`;
  }

  if (normalized.startsWith("ipfs://ipfs/")) {
    return `${IPFS_GATEWAY_BASE}/${normalized.slice("ipfs://ipfs/".length)}`;
  }

  if (normalized.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY_BASE}/${normalized.slice(7)}`;
  }

  if (isBareIpfsCid(normalized)) {
    return `${IPFS_GATEWAY_BASE}/${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeWallet(wallet = "") {
  const normalized = String(wallet || "").trim().toLowerCase();
  if (!normalized) return "";
  if (!normalized.startsWith("0x")) return `0x${normalized}`;
  return normalized;
}

function requireEnv(value, label) {
  if (!value || isPlaceholderSecret(value)) {
    throw new Error(`${label} is required but not configured`);
  }
  return value;
}

function isPlaceholderSecret(value = "") {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("your") || normalized.includes("placeholder") || normalized.length < 10;
}

function isValidPrivateKey(value = "") {
  if (!value) return false;
  try {
    new ethers.Wallet(value);
    return true;
  } catch {
    return false;
  }
}

function isMissingArtistContractColumnError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("artist_contracts");
}

function isMissingArtistProfileColumnError(error, columnName) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("artists") && message.includes(columnName);
}

function isMissingProductColumnError(error, columnName) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("products") && message.includes(columnName);
}

function isMissingCampaignSubmissionTableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("relation") && message.includes("campaign_submissions") ||
    message.includes("does not exist") && message.includes("campaign_submissions")
  );
}

// Initialize Supabase
const supabase = createClient(
  requireEnv(SUPABASE_URL, "SUPABASE_URL"),
  requireEnv(SUPABASE_SERVER_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "ipfs:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "ipfs:"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = FRONTEND_ORIGIN.split(",").map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});


// ════════════════════════════════════════════════════════
// CONTRACT ABIs for On-Chain Event Listeners
// ════════════════════════════════════════════════════════

// Artist Contract ABI - For listening to subscription events
const ARTIST_CONTRACT_ABI = [
  {
    type: "event",
    name: "NewSubscription",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "artistShare", type: "uint256", indexed: false },
      { name: "founderShare", type: "uint256", indexed: false },
      { name: "expiryTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionRenewed",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newExpiryTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionCancelled",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
    ],
  },
];

// Product Store Contract ABI - For listening to purchase events
const PRODUCT_STORE_ABI = [
  {
    type: "event",
    name: "PurchaseCompleted",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "productId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "totalPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProductCreated",
    inputs: [
      { name: "productId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "royaltyPercent", type: "uint256", indexed: false },
    ],
  },
];

export {
  app,
  supabase,
  appJwtSecret,
  BASE_SEPOLIA_RPC_URL,
  ART_DROP_FACTORY_ADDRESS,
  POAP_CAMPAIGN_V2_ADDRESS,
  PRODUCT_STORE_ADDRESS,
  CREATIVE_RELEASE_ESCROW_ADDRESS,
  DEPLOYER_PRIVATE_KEY,
  DROP_MAINTENANCE_INTERVAL_MS,
  EXPIRED_DROP_RETENTION_HOURS,
  normalizeWallet,
  requireEnv,
  isPlaceholderSecret,
  isValidPrivateKey,
  sanitizeDropPayload,
  resolveMediaProxyTarget,
  authLimiter,
  ARTIST_CONTRACT_ABI,
  PRODUCT_STORE_ABI,
};
