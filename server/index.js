import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { dropUpdateSchema, validateInput } from "./validation.js";
import { appJwtSecret } from "./config.js";
import { getPinataAuthMode } from "./pinataAuth.js";

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

const DROP_UPDATE_COLUMNS = new Set([
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

if (!appJwtSecret) {
  throw new Error("APP_JWT_SECRET or JWT_SECRET is required");
}

if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY are required");
}

// Log startup configuration
console.log("═══════════════════════════════════════════════════════════");
console.log("🚀 PopUp API Starting");
console.log("═══════════════════════════════════════════════════════════");
console.log("📍 Environment:", NODE_ENV);
console.log("🌐 Frontend Origin:", FRONTEND_ORIGIN);
console.log("🔐 Admin Wallets:", ADMIN_WALLETS || "none");
console.log("🧷 Pinata Auth:", getPinataAuthMode(process.env) || "none");
console.log("═══════════════════════════════════════════════════════════");


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
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

function isMissingCampaignSubmissionTableError(error) {
  const message = error?.message || "";
  return (
    typeof message === "string" &&
    (
      message.includes("campaign_submissions") ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    )
  );
}

let artistContractColumnsReady = null;
let campaignSubmissionsTableReady = null;
let campaignSigner = null;
let campaignProvider = null;
let productStoreProvider = null;

const POAP_CAMPAIGN_V2_ABI = [
  "function grantContentCredits(uint256 campaignId, address wallet, uint256 quantity)",
  "function revokeContentCredits(uint256 campaignId, address wallet, uint256 quantity)",
  "function campaigns(uint256 campaignId) view returns (address artist, string metadataURI, uint8 entryMode, uint8 status, uint256 maxSupply, uint256 minted, uint256 ticketPriceWei, uint64 startTime, uint64 endTime, uint64 redeemStartTime)",
];
const PRODUCT_STORE_INTERFACE = new ethers.Interface([
  "event PurchaseCompleted(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 quantity, uint256 totalPrice)",
]);
const CREATIVE_RELEASE_ESCROW_INTERFACE = new ethers.Interface([
  "event ReleasePurchased(uint256 indexed orderId, uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPrice)",
]);

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

async function ensureCampaignSubmissionsTableReady() {
  if (campaignSubmissionsTableReady !== null) {
    return campaignSubmissionsTableReady;
  }

  const { error } = await supabase
    .from("campaign_submissions")
    .select("id")
    .limit(1);

  if (error && isMissingCampaignSubmissionTableError(error)) {
    campaignSubmissionsTableReady = false;
    return false;
  }

  if (error) {
    throw new Error(`Unable to verify campaign submissions table: ${error.message}`);
  }

  campaignSubmissionsTableReady = true;
  return true;
}

function getCampaignSigner() {
  if (campaignSigner) return campaignSigner;
  if (!DEPLOYER_PRIVATE_KEY || !isValidPrivateKey(DEPLOYER_PRIVATE_KEY)) {
    throw new Error("DEPLOYER_PRIVATE_KEY is missing or invalid");
  }

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  campaignSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  return campaignSigner;
}

function getCampaignProvider() {
  if (campaignProvider) return campaignProvider;
  campaignProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  return campaignProvider;
}

function getProductStoreProvider() {
  if (productStoreProvider) return productStoreProvider;
  productStoreProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  return productStoreProvider;
}

function normalizeTxHash(txHash) {
  const value = typeof txHash === "string" ? txHash.trim() : "";
  return /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
}

function extractContractProductId(metadata, explicitValue = null) {
  const rawValue = explicitValue ?? (
    metadata && typeof metadata === "object" ? metadata.contract_product_id : null
  );
  const parsed =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" && rawValue.trim()
      ? Number(rawValue)
      : null;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.floor(parsed);
  return normalized >= 1 ? normalized : null;
}

async function loadCheckoutProducts(productIds) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, creative_release_id, name, price_eth, stock, sold, status, product_type, asset_type, preview_uri, delivery_uri, image_url, image_ipfs_uri, is_gated, creator_wallet, metadata, contract_kind, contract_listing_id, contract_product_id")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message || "Failed to load products for checkout");
  }

  return new Map((data || []).map((product) => [product.id, product]));
}

async function verifyProductPurchaseTx({ txHash, buyerWallet, normalizedItems, productsById }) {
  const normalizedTxHash = normalizeTxHash(txHash);
  if (!normalizedTxHash) {
    throw new Error("A valid tx_hash is required");
  }

  const provider = getProductStoreProvider();
  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(normalizedTxHash),
    provider.getTransactionReceipt(normalizedTxHash),
  ]);

  if (!transaction || !receipt) {
    throw new Error("Purchase transaction could not be found onchain");
  }

  if (receipt.status !== 1) {
    throw new Error("Purchase transaction did not succeed onchain");
  }

  const expectedTo = normalizeWallet(PRODUCT_STORE_ADDRESS);
  const actualTo = normalizeWallet(receipt.to || transaction.to || "");
  if (!expectedTo || actualTo !== expectedTo) {
    throw new Error("Purchase transaction was not sent to the product store contract");
  }

  if (normalizeWallet(transaction.from || "") !== normalizeWallet(buyerWallet)) {
    throw new Error("Purchase transaction does not belong to the connected buyer wallet");
  }

  const expectedItems = new Map();
  for (const item of normalizedItems) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw new Error("One or more checkout products could not be found");
    }

    const contractProductId = extractContractProductId(product.metadata, product.contract_product_id);
    if (contractProductId === null) {
      throw new Error(`${product.name || "A product"} is missing its contract product ID`);
    }

    expectedItems.set(String(contractProductId), Number(item.quantity) || 1);
  }

  const purchasedItems = new Map();
  for (const log of receipt.logs || []) {
    if (normalizeWallet(log.address || "") !== expectedTo) {
      continue;
    }

    try {
      const decoded = PRODUCT_STORE_INTERFACE.parseLog(log);
      if (!decoded || decoded.name !== "PurchaseCompleted") {
        continue;
      }

      const eventBuyer = normalizeWallet(decoded.args.buyer);
      if (eventBuyer !== normalizeWallet(buyerWallet)) {
        continue;
      }

      const eventProductId = String(Number(decoded.args.productId));
      const eventQuantity = Number(decoded.args.quantity);
      purchasedItems.set(eventProductId, (purchasedItems.get(eventProductId) || 0) + eventQuantity);
    } catch {
      // Ignore unrelated logs.
    }
  }

  if (purchasedItems.size === 0) {
    throw new Error("Purchase transaction did not emit a matching ProductStore purchase event");
  }

  if (purchasedItems.size !== expectedItems.size) {
    throw new Error("Purchase transaction does not match the requested checkout items");
  }

  for (const [productId, quantity] of expectedItems.entries()) {
    if ((purchasedItems.get(productId) || 0) !== quantity) {
      throw new Error("Purchase transaction quantities do not match the requested checkout items");
    }
  }

  return normalizedTxHash;
}

async function verifyCreativeReleasePurchaseTx({ txHash, buyerWallet, normalizedItems, productsById }) {
  const normalizedTxHash = normalizeTxHash(txHash);
  if (!normalizedTxHash) {
    throw new Error("A valid tx_hash is required");
  }

  const provider = getProductStoreProvider();
  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(normalizedTxHash),
    provider.getTransactionReceipt(normalizedTxHash),
  ]);

  if (!transaction || !receipt) {
    throw new Error("Purchase transaction could not be found onchain");
  }

  if (receipt.status !== 1) {
    throw new Error("Purchase transaction did not succeed onchain");
  }

  const expectedTo = normalizeWallet(CREATIVE_RELEASE_ESCROW_ADDRESS);
  const actualTo = normalizeWallet(receipt.to || transaction.to || "");
  if (!expectedTo || expectedTo === normalizeWallet("0x0000000000000000000000000000000000000000")) {
    throw new Error("CREATIVE_RELEASE_ESCROW_ADDRESS is not configured");
  }
  if (actualTo !== expectedTo) {
    throw new Error("Purchase transaction was not sent to the creative release escrow contract");
  }

  if (normalizeWallet(transaction.from || "") !== normalizeWallet(buyerWallet)) {
    throw new Error("Purchase transaction does not belong to the connected buyer wallet");
  }

  const expectedItems = new Map();
  for (const item of normalizedItems) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw new Error("One or more checkout products could not be found");
    }

    const contractListingId = Number(product.contract_listing_id);
    if (!Number.isFinite(contractListingId) || contractListingId < 0) {
      throw new Error(`${product.name || "A release"} is missing its escrow listing ID`);
    }

    expectedItems.set(String(contractListingId), Number(item.quantity) || 1);
  }

  const purchasedItems = new Map();
  for (const log of receipt.logs || []) {
    if (normalizeWallet(log.address || "") !== expectedTo) {
      continue;
    }

    try {
      const decoded = CREATIVE_RELEASE_ESCROW_INTERFACE.parseLog(log);
      if (!decoded || decoded.name !== "ReleasePurchased") {
        continue;
      }

      const eventBuyer = normalizeWallet(decoded.args.buyer);
      if (eventBuyer !== normalizeWallet(buyerWallet)) {
        continue;
      }

      const eventListingId = String(Number(decoded.args.listingId));
      const eventQuantity = Number(decoded.args.quantity);
      purchasedItems.set(eventListingId, (purchasedItems.get(eventListingId) || 0) + eventQuantity);
    } catch {
      // Ignore unrelated logs.
    }
  }

  if (purchasedItems.size === 0) {
    throw new Error("Purchase transaction did not emit a matching creative release escrow purchase event");
  }

  if (purchasedItems.size !== expectedItems.size) {
    throw new Error("Purchase transaction does not match the requested checkout items");
  }

  for (const [listingId, quantity] of expectedItems.entries()) {
    if ((purchasedItems.get(listingId) || 0) !== quantity) {
      throw new Error("Purchase transaction quantities do not match the requested checkout items");
    }
  }

  return normalizedTxHash;
}

async function findCampaignDropById(dropId) {
  const { data, error } = await supabase
    .from("drops")
    .select("id, artist_id, title, type, status, ends_at, contract_address, contract_drop_id, contract_kind, artists!inner(wallet)")
    .eq("id", dropId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getCampaignWindow(drop) {
  if (drop?.contract_address && drop?.contract_drop_id !== null && drop?.contract_drop_id !== undefined) {
    try {
      const contract = new ethers.Contract(drop.contract_address, POAP_CAMPAIGN_V2_ABI, getCampaignProvider());
      const campaign = await contract.campaigns(BigInt(drop.contract_drop_id));
      return {
        startTime: Number(campaign.startTime ?? 0n),
        endTime: Number(campaign.endTime ?? 0n),
        redeemStartTime: Number(campaign.redeemStartTime ?? 0n),
      };
    } catch (error) {
      console.warn("Unable to read onchain campaign window:", error?.message || error);
    }
  }

  const endsAt = drop?.ends_at ? Math.floor(new Date(drop.ends_at).getTime() / 1000) : null;
  return {
    startTime: 0,
    endTime: endsAt,
    redeemStartTime: endsAt ? endsAt + 24 * 60 * 60 : null,
  };
}

let expiredDropMaintenancePromise = null;
let lastExpiredDropMaintenanceAt = 0;

async function cleanupExpiredDropsAndCampaigns() {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(
    now.getTime() - EXPIRED_DROP_RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const summary = {
    ended: 0,
    removed: 0,
  };

  const { data: endedRows, error: endedError } = await supabase
    .from("drops")
    .update({
      status: "ended",
      updated_at: nowIso,
    })
    .in("status", LIVE_DROP_STATUSES)
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso)
    .select("id");

  if (endedError) {
    throw new Error(`Failed to end expired drops: ${endedError.message}`);
  }

  summary.ended = endedRows?.length || 0;

  const { data: staleDrops, error: staleError } = await supabase
    .from("drops")
    .select("id")
    .in("status", ["ended", "draft"])
    .not("ends_at", "is", null)
    .lt("ends_at", cutoffIso);

  if (staleError) {
    throw new Error(`Failed to find stale drops: ${staleError.message}`);
  }

  const staleDropIds = (staleDrops || []).map((drop) => drop.id).filter(Boolean);
  if (staleDropIds.length === 0) {
    return summary;
  }

  const campaignSubmissionReady = await ensureCampaignSubmissionsTableReady().catch(() => false);
  if (campaignSubmissionReady) {
    const { error: submissionsError } = await supabase
      .from("campaign_submissions")
      .delete()
      .in("drop_id", staleDropIds);

    if (submissionsError) {
      throw new Error(`Failed to remove stale campaign submissions: ${submissionsError.message}`);
    }
  }

  const { error: deleteError } = await supabase
    .from("drops")
    .delete()
    .in("id", staleDropIds);

  if (deleteError) {
    throw new Error(`Failed to remove stale drops: ${deleteError.message}`);
  }

  summary.removed = staleDropIds.length;
  return summary;
}

async function runExpiredDropMaintenanceIfDue(force = false) {
  const now = Date.now();
  if (!force && now - lastExpiredDropMaintenanceAt < DROP_MAINTENANCE_INTERVAL_MS) {
    return null;
  }

  if (expiredDropMaintenancePromise) {
    return expiredDropMaintenancePromise;
  }

  lastExpiredDropMaintenanceAt = now;
  expiredDropMaintenancePromise = cleanupExpiredDropsAndCampaigns()
    .catch((error) => {
      console.error("Expired drop maintenance failed:", error);
      throw error;
    })
    .finally(() => {
      expiredDropMaintenancePromise = null;
    });

  return expiredDropMaintenancePromise;
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
  // The Supabase nonce schema expects 32 bytes of lowercase hex without a 0x prefix.
  const nonce = ethers.hexlify(ethers.randomBytes(32)).slice(2).toLowerCase();
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

function authOptional(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      req.auth = null;
      return next();
    }

    const decoded = jwt.verify(token, appJwtSecret, {
      algorithms: ["HS256"],
      issuer: "popup-api",
      audience: "popup-client",
    });

    const wallet = normalizeWallet(decoded.wallet || "");
    req.auth = wallet
      ? {
          wallet,
          role: decoded.role || "collector",
        }
      : null;

    return next();
  } catch (_error) {
    req.auth = null;
    return next();
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

async function getArtistRecordByWallet(wallet) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) return null;

  const { data, error } = await supabase
    .from("artists")
    .select("id, wallet, name, handle, contract_address, shares_enabled, shares_contract_address")
    .eq("wallet", normalizedWallet)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load artist profile");
  }

  return data || null;
}

async function getWhitelistStatusByWallet(wallet) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) return null;

  const { data, error } = await supabase
    .from("whitelist")
    .select("status")
    .eq("wallet", normalizedWallet)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load whitelist status");
  }

  return data?.status || null;
}

async function getArtistSubscriberCount(contractAddress) {
  const normalizedAddress = String(contractAddress || "").trim();
  if (!normalizedAddress) return 0;

  try {
    const provider = getCampaignProvider();
    const contract = new ethers.Contract(normalizedAddress, ARTIST_SUBSCRIPTION_ABI, provider);
    const count = await contract.getSubscriberCount();
    return Number(count || 0n);
  } catch (error) {
    console.warn("Unable to read artist subscriber count:", error?.message || error);
    return 0;
  }
}

function normalizeIPCampaignPayload(payload = {}) {
  const trimOrNull = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    slug: trimOrNull(payload.slug)?.toLowerCase() || null,
    title: trimOrNull(payload.title),
    summary: trimOrNull(payload.summary),
    description: trimOrNull(payload.description),
    campaign_type: trimOrNull(payload.campaign_type) || "production_raise",
    rights_type: trimOrNull(payload.rights_type) || "creative_ip",
    visibility: trimOrNull(payload.visibility) || "private",
    funding_target_eth: numberOrNull(payload.funding_target_eth),
    minimum_raise_eth: numberOrNull(payload.minimum_raise_eth),
    unit_price_eth: numberOrNull(payload.unit_price_eth),
    total_units: numberOrNull(payload.total_units),
    opens_at: trimOrNull(payload.opens_at),
    closes_at: trimOrNull(payload.closes_at),
    legal_doc_uri: trimOrNull(payload.legal_doc_uri),
    cover_image_uri: trimOrNull(payload.cover_image_uri),
    metadata: typeof payload.metadata === "object" && payload.metadata !== null ? payload.metadata : {},
  };
}

function normalizeCreativeReleasePayload(payload = {}) {
  const trimOrNull = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const jsonObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const releaseType = trimOrNull(payload.release_type) || "collectible";
  const status = trimOrNull(payload.status) || "draft";
  const contractKind =
    trimOrNull(payload.contract_kind) ||
    (releaseType === "collectible" ? "artDrop" : "creativeReleaseEscrow");

  return {
    artist_id: trimOrNull(payload.artist_id),
    release_type: releaseType,
    title: trimOrNull(payload.title),
    description: trimOrNull(payload.description),
    status,
    price_eth: numberOrNull(payload.price_eth) ?? 0,
    supply: Math.max(1, Math.floor(numberOrNull(payload.supply) ?? 1)),
    sold: Math.max(0, Math.floor(numberOrNull(payload.sold) ?? 0)),
    art_metadata_uri: trimOrNull(payload.art_metadata_uri),
    cover_image_uri: trimOrNull(payload.cover_image_uri),
    contract_kind: contractKind,
    contract_address:
      trimOrNull(payload.contract_address) ||
      (contractKind === "creativeReleaseEscrow" ? CREATIVE_RELEASE_ESCROW_ADDRESS : null),
    contract_listing_id: numberOrNull(payload.contract_listing_id),
    contract_drop_id: numberOrNull(payload.contract_drop_id),
    creator_notes: trimOrNull(payload.creator_notes),
    physical_details_jsonb: jsonObject(payload.physical_details_jsonb),
    shipping_profile_jsonb: jsonObject(payload.shipping_profile_jsonb),
    metadata: jsonObject(payload.metadata),
    published_at: trimOrNull(payload.published_at),
  };
}

function isMissingCreativeReleaseSchemaError(error) {
  const message = error?.message || "";
  return (
    typeof message === "string" &&
    (
      message.includes("creative_releases") ||
      message.includes("creative_release_id")
    )
  );
}

async function writeAdminAuditLog({
  adminWallet,
  action,
  targetWallet = null,
  status = null,
  details = null,
}) {
  if (!adminWallet || !action) return;

  try {
    await supabase.from("admin_audit_log").insert({
      admin_wallet: normalizeWallet(adminWallet),
      action,
      target_wallet: targetWallet ? normalizeWallet(targetWallet) : null,
      status,
      details,
    });
  } catch (error) {
    console.warn("Admin audit log insert failed:", error?.message || error);
  }
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
  const portfolio = [];

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

app.use((req, _res, next) => {
  if (!req.url.startsWith("/auth/")) {
    void runExpiredDropMaintenanceIfDue().catch((error) => {
      console.warn("Background drop maintenance warning:", error?.message || error);
    });
  }
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

    await cleanupExpiredNonces().catch((cleanupError) => {
      console.warn("Nonce cleanup failed before verification:", cleanupError?.message || cleanupError);
    });
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
  const { data: whitelistEntry } = await supabase
    .from("whitelist")
    .select("status")
    .eq("wallet", wallet)
    .maybeSingle();

  const inferredStatus =
    profile.status ??
    (whitelistEntry?.status === "approved"
      ? "approved"
      : whitelistEntry?.status === "rejected"
        ? "rejected"
        : whitelistEntry?.status === "pending"
          ? "pending"
          : undefined);

  const payload = {
    wallet,
    name: profile.name ?? null,
    handle: profile.handle ?? null,
    bio: profile.bio ?? null,
    tag: profile.tag ?? null,
    role: profile.role ?? null,
    status: inferredStatus,
    subscription_price: profile.subscription_price ?? profile.subscriptionPrice ?? null,
    avatar_url: profile.avatar_url ?? profile.avatar ?? null,
    banner_url: profile.banner_url ?? profile.banner ?? null,
    twitter_url: profile.twitter_url ?? profile.twitterUrl ?? null,
    instagram_url: profile.instagram_url ?? profile.instagramUrl ?? null,
    website_url: profile.website_url ?? profile.websiteUrl ?? null,
    poap_allocation: profile.poap_allocation ?? profile.defaultPoapAllocation ?? undefined,
    portfolio: profile.portfolio ?? undefined,
    contract_address: profile.contract_address ?? profile.contractAddress ?? undefined,
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

app.post("/maintenance/cleanup-drops", authRequired, async (req, res) => {
  if (req.auth.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const result = await runExpiredDropMaintenanceIfDue(true);
    return res.json({
      ok: true,
      retentionHours: EXPIRED_DROP_RETENTION_HOURS,
      ...(result || { ended: 0, removed: 0 }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Cleanup failed" });
  }
});

app.post("/drops", authRequired, async (req, res) => {
  const drop = sanitizeDropPayload(req.body || {}, { includeArtistId: true });
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
  const { signature, signatureMessage } = req.body;

  // Require signature for drop updates
  if (!signature || !signatureMessage) {
    return res.status(400).json({ error: "Signature and signatureMessage are required for drop updates" });
  }

  const { data: existing, error: existingError } = await supabase
    .from("drops")
    .select("id, artist_id, artists!inner(wallet)")
    .eq("id", id)
    .single();

  if (existingError) return res.status(404).json({ error: existingError.message });
  const ownerWallet = existing.artists.wallet;

  // Verify signature
  try {
    const recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
    if (normalizeWallet(recoveredAddress) !== normalizeWallet(ownerWallet)) {
      return res.status(403).json({ error: "Invalid signature for drop update" });
    }
  } catch (sigError) {
    return res.status(400).json({ error: "Invalid signature format" });
  }

  if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot update another artist drop" });
  }

  // Validate input
  const validation = validateInput(dropUpdateSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid input", details: validation.error });
  }

  const updates = {
    ...sanitizeDropPayload(validation.data),
    updated_at: new Date().toISOString(),
  };

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return res.status(400).json({ error: "No supported drop fields were provided" });
  }

  let { data, error } = await supabase
    .from("drops")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error && isMissingDropColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("drops")
      .update(stripUnsupportedDropColumns(updates))
      .eq("id", id)
      .select("*")
      .single());
  }

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

const createCampaignSubmissionImpl = async (req, res) => {
  try {
    const tableReady = await ensureCampaignSubmissionsTableReady();
    if (!tableReady) {
      return res.status(503).json({
        error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
      });
    }

    const dropId = req.body?.dropId;
    const contentUrl = req.body?.contentUrl?.trim() || null;
    const caption = req.body?.caption?.trim() || null;

    if (!dropId) {
      return res.status(400).json({ error: "dropId is required" });
    }

    if (!contentUrl && !caption) {
      return res.status(400).json({ error: "contentUrl or caption is required" });
    }

    const drop = await findCampaignDropById(dropId);
    if (drop.type !== "campaign") {
      return res.status(400).json({ error: "Submissions are only supported for campaign drops" });
    }

    const campaignWindow = await getCampaignWindow(drop);
    const now = Math.floor(Date.now() / 1000);
    if (
      campaignWindow.startTime &&
      campaignWindow.endTime &&
      (now < campaignWindow.startTime || now > campaignWindow.endTime)
    ) {
      return res.status(400).json({ error: "Campaign submissions are only accepted during the live campaign window." });
    }

    const { data, error } = await supabase
      .from("campaign_submissions")
      .insert({
        drop_id: dropId,
        submitter_wallet: req.auth.wallet,
        content_url: contentUrl,
        caption,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to submit campaign content" });
  }
};

registerRoute("post", "/campaigns/submissions", authRequired, createCampaignSubmissionImpl);

const listCampaignSubmissionsImpl = async (req, res) => {
  try {
    const tableReady = await ensureCampaignSubmissionsTableReady();
    if (!tableReady) {
      return res.status(503).json({
        error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
      });
    }

    const dropId = req.params.dropId;
    const scope = String(req.query.scope || "").toLowerCase();
    const drop = await findCampaignDropById(dropId);

    let query = supabase
      .from("campaign_submissions")
      .select("*")
      .eq("drop_id", dropId)
      .order("created_at", { ascending: false });

    if (scope === "mine") {
      query = query.eq("submitter_wallet", req.auth.wallet);
    } else {
      const ownerWallet = drop.artists?.wallet;
      if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
        return res.status(403).json({ error: "Artist or admin access required" });
      }
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch campaign submissions" });
  }
};

registerRoute("get", "/campaigns/:dropId/submissions", authRequired, listCampaignSubmissionsImpl);

const reviewCampaignSubmissionImpl = async (req, res) => {
  try {
    const tableReady = await ensureCampaignSubmissionsTableReady();
    if (!tableReady) {
      return res.status(503).json({
        error: "campaign_submissions table is missing. Run the latest Supabase campaign migration first.",
      });
    }

    const dropId = req.params.dropId;
    const submissionId = req.params.submissionId;
    const status = String(req.body?.status || "").toLowerCase();

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "status must be approved or rejected" });
    }

    const drop = await findCampaignDropById(dropId);
    const ownerWallet = drop.artists?.wallet;
    if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
      return res.status(403).json({ error: "Artist or admin access required" });
    }

    const { data: existingSubmission, error: existingError } = await supabase
      .from("campaign_submissions")
      .select("*")
      .eq("id", submissionId)
      .eq("drop_id", dropId)
      .single();

    if (existingError) {
      return res.status(404).json({ error: existingError.message });
    }

    let onchainTxHash = existingSubmission.onchain_tx_hash || null;
    const previousStatus = existingSubmission.status;
    let compensatingAction = null;

    if (
      drop.contract_address &&
      drop.contract_drop_id !== null &&
      drop.contract_drop_id !== undefined &&
      String(drop.contract_kind || "").toLowerCase() === "poapcampaignv2"
    ) {
      const signer = getCampaignSigner();
      const contract = new ethers.Contract(drop.contract_address, POAP_CAMPAIGN_V2_ABI, signer);

      if (previousStatus !== "approved" && status === "approved") {
        const tx = await contract.grantContentCredits(
          BigInt(drop.contract_drop_id),
          existingSubmission.submitter_wallet,
          1n
        );
        const receipt = await tx.wait();
        onchainTxHash = receipt?.hash || tx.hash || null;
        compensatingAction = async () => {
          const rollbackTx = await contract.revokeContentCredits(
            BigInt(drop.contract_drop_id),
            existingSubmission.submitter_wallet,
            1n
          );
          await rollbackTx.wait();
        };
      } else if (previousStatus === "approved" && status === "rejected") {
        const tx = await contract.revokeContentCredits(
          BigInt(drop.contract_drop_id),
          existingSubmission.submitter_wallet,
          1n
        );
        const receipt = await tx.wait();
        onchainTxHash = receipt?.hash || tx.hash || null;
        compensatingAction = async () => {
          const rollbackTx = await contract.grantContentCredits(
            BigInt(drop.contract_drop_id),
            existingSubmission.submitter_wallet,
            1n
          );
          await rollbackTx.wait();
        };
      }
    }

    const { data, error } = await supabase
      .from("campaign_submissions")
      .update({
        status,
        reviewed_by: req.auth.wallet,
        reviewed_at: new Date().toISOString(),
        onchain_tx_hash: onchainTxHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("drop_id", dropId)
      .eq("status", previousStatus)
      .select("*")
      .single();

    if (error) {
      if (compensatingAction) {
        try {
          await compensatingAction();
        } catch (rollbackError) {
          console.error("Failed to compensate campaign credit update:", rollbackError);
          return res.status(500).json({
            error: "Campaign review partially failed and needs manual reconciliation.",
            details: error.message,
          });
        }
      }
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to review campaign submission" });
  }
};

registerRoute("post", "/campaigns/:dropId/submissions/:submissionId/review", authRequired, reviewCampaignSubmissionImpl);

registerRoute("get", "/creative-releases", async (req, res) => {
  try {
    let query = supabase
      .from("creative_releases")
      .select("*")
      .order("created_at", { ascending: false });

    if (typeof req.query.artist_id === "string" && req.query.artist_id.trim()) {
      query = query.eq("artist_id", req.query.artist_id.trim());
    }

    if (typeof req.query.release_type === "string" && req.query.release_type.trim()) {
      query = query.eq("release_type", req.query.release_type.trim());
    }

    if (typeof req.query.status === "string" && req.query.status.trim()) {
      query = query.eq("status", req.query.status.trim());
    } else if (!(typeof req.query.artist_id === "string" && req.query.artist_id.trim())) {
      query = query.in("status", ["published", "live"]);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load creative releases" });
  }
});

registerRoute("get", "/creative-releases/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("creative_releases")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Creative release not found" });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load creative release" });
  }
});

registerRoute("post", "/creative-releases", authRequired, async (req, res) => {
  try {
    const payload = normalizeCreativeReleasePayload(req.body || {});
    if (!payload.title) {
      return res.status(400).json({ error: "title is required" });
    }

    let artistRecord = null;
    if (payload.artist_id && req.auth.role === "admin") {
      const { data, error } = await supabase
        .from("artists")
        .select("id, wallet")
        .eq("id", payload.artist_id)
        .maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      artistRecord = data;
    } else {
      artistRecord = await getArtistRecordByWallet(req.auth.wallet);
    }

    if (!artistRecord?.id) {
      return res.status(400).json({ error: "Artist profile not found. Complete your profile first." });
    }

    if (!sameWalletOrAdmin(artistRecord.wallet, req.auth)) {
      return res.status(403).json({ error: "Cannot create releases for another artist" });
    }

    const now = new Date().toISOString();
    const insertPayload = {
      ...payload,
      artist_id: artistRecord.id,
      published_at: payload.status === "published" || payload.status === "live"
        ? payload.published_at || now
        : payload.published_at,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("creative_releases")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create creative release" });
  }
});

registerRoute("patch", "/creative-releases/:id", authRequired, async (req, res) => {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("creative_releases")
      .select("id, artist_id, artists(wallet)")
      .eq("id", req.params.id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: existingError?.message || "Creative release not found" });
    }

    const ownerWallet = Array.isArray(existing.artists) ? existing.artists[0]?.wallet : existing.artists?.wallet;
    if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
      return res.status(403).json({ error: "Only the artist or admin can update this release" });
    }

    const payload = normalizeCreativeReleasePayload(req.body || {});
    const updates = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("creative_releases")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update creative release" });
  }
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
  creative_release_id,
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
  tx_hash,
  contract_kind,
  contract_order_id,
  payout_status,
  approval_status,
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
    creative_release_id,
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

const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

function normalizeOrderStatus(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_ORDER_STATUSES.has(normalized) ? normalized : null;
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
  productsById,
  shippingAddressJsonb,
  shippingEth,
  taxEth,
  currency,
  trackingCode,
  txHash,
  contractKind = "productStore",
  contractOrderId = null,
  skipAvailabilityValidation = false,
}) {
  const createdOrderIds = [];
  const resolvedProductsById =
    productsById instanceof Map ? productsById : await loadCheckoutProducts(normalizedItems.map((item) => item.product_id));
  const paidAt = txHash ? new Date().toISOString() : null;

  for (const item of normalizedItems) {
    const product = resolvedProductsById.get(item.product_id);
    if (!product) {
      throw new Error("One or more items are no longer available.");
    }

    const normalizedProductStatus = String(product.status || "").toLowerCase();
    if (
      !skipAvailabilityValidation &&
      normalizedProductStatus &&
      !PUBLIC_PRODUCT_STATUSES.includes(normalizedProductStatus)
    ) {
      throw new Error(`${product.name || "Item"} is no longer available.`);
    }

    const currentStock = product.stock == null ? null : Number(product.stock);
    if (!skipAvailabilityValidation && currentStock !== null && currentStock < item.quantity) {
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
        creative_release_id: product.creative_release_id || null,
        quantity,
        currency,
        subtotal_eth: totalPrice,
        shipping_eth: shippingEth,
        tax_eth: taxEth,
        total_price_eth: totalPrice,
        status: txHash ? "paid" : "pending",
        shipping_address: shippingAddress,
        shipping_address_jsonb: shippingAddressJsonb,
        tracking_code: trackingCode,
        tx_hash: txHash,
        contract_kind: product.contract_kind || contractKind,
        contract_order_id: contractOrderId,
        payout_status:
          String(product.contract_kind || contractKind) === "creativeReleaseEscrow"
            ? "unreleased"
            : "released",
        approval_status:
          String(product.contract_kind || contractKind) === "creativeReleaseEscrow"
            ? "pending"
            : "approved",
        paid_at: paidAt,
      })
      .select("id")
      .single();

    if (insertError || !insertedOrder?.id) {
      throw new Error(insertError?.message || "Failed to create order");
    }

    createdOrderIds.push(insertedOrder.id);

    const orderItemPayload = {
      order_id: insertedOrder.id,
      product_id: product.id,
      creative_release_id: product.creative_release_id || null,
      quantity,
      unit_price_eth: unitPrice,
      line_total_eth: totalPrice,
      fulfillment_type: product.product_type === "digital" ? "digital" : "physical",
      delivery_status: txHash ? "paid" : "pending",
    };

    const { data: orderItem, error: orderItemError } = await supabase
      .from("order_items")
      .insert(orderItemPayload)
      .select("id")
      .single();

    if (orderItemError) {
      throw new Error(orderItemError.message || "Failed to create order item");
    }

    if (product.product_type === "physical" || product.product_type === "hybrid") {
      const { error: fulfillmentError } = await supabase
        .from("fulfillments")
        .insert({
          order_id: insertedOrder.id,
          order_item_id: orderItem?.id || null,
          product_id: product.id,
          creator_wallet: product.creator_wallet || null,
          fulfillment_type: product.product_type === "hybrid" ? "hybrid" : "physical",
          status: "pending",
          shipping_address_jsonb: shippingAddressJsonb,
          metadata: {
            contract_kind: product.contract_kind || contractKind,
            tx_hash: txHash,
          },
        });

      if (fulfillmentError && !String(fulfillmentError.message || "").toLowerCase().includes("does not exist")) {
        throw new Error(fulfillmentError.message || "Failed to create fulfillment");
      }
    }

    if (txHash) {
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
  }

  return createdOrderIds;
}

registerRoute("get", "/products/:id/assets", authRequired, async (req, res) => {
  try {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, creator_wallet")
      .eq("id", req.params.id)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: productError?.message || "Product not found" });
    }

    const { data: ownedOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("buyer_wallet", req.auth.wallet)
      .eq("product_id", product.id)
      .in("status", ["paid", "processing", "shipped", "delivered"])
      .maybeSingle();

    const canViewPrivate =
      req.auth.role === "admin" ||
      normalizeWallet(product.creator_wallet) === req.auth.wallet ||
      Boolean(ownedOrder?.id);

    let query = supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", product.id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });

    if (!canViewPrivate) {
      query = query.eq("visibility", "public");
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load product assets" });
  }
});

registerRoute("post", "/product-assets", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const productId = typeof payload.product_id === "string" ? payload.product_id.trim() : "";
    if (!productId) {
      return res.status(400).json({ error: "product_id is required" });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, creator_wallet")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: productError?.message || "Product not found" });
    }

    if (!sameWalletOrAdmin(product.creator_wallet, req.auth)) {
      return res.status(403).json({ error: "Only the creator or admin can attach product assets" });
    }

    const assets = Array.isArray(payload.assets) ? payload.assets : [payload];
    const sanitizedAssets = assets
      .map((asset) => ({
        product_id: productId,
        role: typeof asset.role === "string" ? asset.role.trim() : "gallery_photo",
        visibility: typeof asset.visibility === "string" ? asset.visibility.trim() : "public",
        asset_type: typeof asset.asset_type === "string" ? asset.asset_type.trim() : "image",
        storage_provider: typeof asset.storage_provider === "string" ? asset.storage_provider.trim() : "ipfs",
        uri: typeof asset.uri === "string" ? asset.uri.trim() : "",
        preview_uri: typeof asset.preview_uri === "string" ? asset.preview_uri.trim() : null,
        mime_type: typeof asset.mime_type === "string" ? asset.mime_type.trim() : null,
        file_name: typeof asset.file_name === "string" ? asset.file_name.trim() : null,
        file_size_bytes: Number.isFinite(Number(asset.file_size_bytes)) ? Number(asset.file_size_bytes) : null,
        sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : 0,
        is_primary: Boolean(asset.is_primary),
        requires_signed_url: Boolean(asset.requires_signed_url),
        metadata: asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata) ? asset.metadata : {},
      }))
      .filter((asset) => asset.uri);

    if (sanitizedAssets.length === 0) {
      return res.status(400).json({ error: "At least one asset with a uri is required" });
    }

    const { data, error } = await supabase
      .from("product_assets")
      .insert(sanitizedAssets)
      .select("*");

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create product assets" });
  }
});

registerRoute("get", "/entitlements", authRequired, async (req, res) => {
  try {
    const requestedWallet =
      typeof req.query.buyer_wallet === "string" && req.query.buyer_wallet.trim()
        ? normalizeWallet(req.query.buyer_wallet)
        : req.auth.wallet;

    if (!sameWalletOrAdmin(requestedWallet, req.auth)) {
      return res.status(403).json({ error: "Cannot view another wallet's entitlements" });
    }

    const { data, error } = await supabase
      .from("entitlements")
      .select("*")
      .eq("buyer_wallet", requestedWallet)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load entitlements" });
  }
});

registerRoute("get", "/orders/:id/fulfillments", authRequired, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const creatorWallets = new Set();
    const directCreatorWallet = order.products?.creator_wallet;
    if (directCreatorWallet) creatorWallets.add(normalizeWallet(directCreatorWallet));
    for (const item of order.order_items || []) {
      const itemProduct = Array.isArray(item.products) ? item.products[0] : item.products;
      if (itemProduct?.creator_wallet) {
        creatorWallets.add(normalizeWallet(itemProduct.creator_wallet));
      }
    }

    if (
      req.auth.role !== "admin" &&
      normalizeWallet(order.buyer_wallet) !== req.auth.wallet &&
      !creatorWallets.has(req.auth.wallet)
    ) {
      return res.status(403).json({ error: "You do not have access to this order's fulfillments" });
    }

    const { data, error } = await supabase
      .from("fulfillments")
      .select("*")
      .eq("order_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load fulfillments" });
  }
});

registerRoute("get", "/royalty-distributions", authRequired, async (req, res) => {
  try {
    const requestedWallet =
      typeof req.query.recipient_wallet === "string" && req.query.recipient_wallet.trim()
        ? normalizeWallet(req.query.recipient_wallet)
        : req.auth.wallet;

    if (!sameWalletOrAdmin(requestedWallet, req.auth)) {
      return res.status(403).json({ error: "Cannot view another wallet's distributions" });
    }

    const { data, error } = await supabase
      .from("royalty_distributions")
      .select("*")
      .eq("recipient_wallet", requestedWallet)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load royalty distributions" });
  }
});

app.get("/orders", authRequired, async (req, res) => {
  const requestedWallet = normalizeWallet(typeof req.query.buyer_wallet === "string" ? req.query.buyer_wallet : req.auth.wallet);
  const accessibleOnly =
    String(req.query.accessible_only || "").toLowerCase() === "true" ||
    String(req.query.owned_only || "").toLowerCase() === "true";
  const statusesFilter =
    typeof req.query.statuses === "string" && req.query.statuses.trim()
      ? new Set(
          req.query.statuses
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        )
      : null;

  if (!sameWalletOrAdmin(requestedWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot view another wallet's orders" });
  }

  try {
    const data = await listOrdersForBuyer(requestedWallet);
    const accessibleStatuses = new Set(["paid", "processing", "shipped", "delivered"]);
    const filtered = data.filter((order) => {
      const normalizedStatus = String(order?.status || "").toLowerCase();
      if (accessibleOnly && !accessibleStatuses.has(normalizedStatus)) {
        return false;
      }
      if (statusesFilter && statusesFilter.size > 0 && !statusesFilter.has(normalizedStatus)) {
        return false;
      }
      return true;
    });
    return res.json(filtered);
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
  const rawTxHash = typeof order.tx_hash === "string" && order.tx_hash.trim()
    ? order.tx_hash.trim()
    : null;
  if (!rawTxHash) {
    return res.status(400).json({
      error: "tx_hash is required and must reference the verified onchain purchase",
    });
  }
  let productsById;
  try {
    productsById = await loadCheckoutProducts(normalizedItems.map((item) => item.product_id));
  } catch (productsError) {
    return res.status(400).json({
      error: productsError?.message || "Failed to load checkout products",
    });
  }
  const normalizedContractKinds = new Set(
    Array.from(productsById.values()).map((product) => String(product.contract_kind || "productStore"))
  );
  if (normalizedContractKinds.size > 1) {
    return res.status(400).json({
      error: "Orders must use a single contract kind. Split mixed carts into separate checkouts.",
    });
  }
  const orderContractKind = Array.from(normalizedContractKinds)[0] || "productStore";
  const contractOrderId = Number.isFinite(Number(order.contract_order_id))
    ? Number(order.contract_order_id)
    : null;
  let txHash = null;
  let createdOrderIds = [];
  let orderError = null;

  try {
    if (rawTxHash) {
      if (orderContractKind === "creativeReleaseEscrow") {
        txHash = await verifyCreativeReleasePurchaseTx({
          txHash: rawTxHash,
          buyerWallet,
          normalizedItems,
          productsById,
        });
      } else {
        txHash = await verifyProductPurchaseTx({
          txHash: rawTxHash,
          buyerWallet,
          normalizedItems,
          productsById,
        });
      }
    }
  } catch (verificationError) {
    return res.status(400).json({
      error: verificationError?.message || "Purchase transaction could not be verified",
    });
  }

  if (txHash) {
    try {
      createdOrderIds = await createLegacyCheckoutOrders({
        buyerWallet,
        normalizedItems,
        productsById,
        shippingAddressJsonb,
        shippingEth,
        taxEth,
        currency,
        trackingCode,
        txHash,
        contractKind: orderContractKind,
        contractOrderId,
        skipAvailabilityValidation: true,
      });
    } catch (legacyError) {
      orderError = legacyError;
    }
  } else {
    const { data: createdOrderId, error: rpcOrderError } = await supabase.rpc("create_checkout_order", {
      p_buyer_wallet: buyerWallet,
      p_items: normalizedItems,
      p_shipping_address_jsonb: shippingAddressJsonb,
      p_shipping_eth: shippingEth,
      p_tax_eth: taxEth,
      p_currency: currency,
      p_tracking_code: trackingCode,
      p_tx_hash: txHash,
    });

    if (rpcOrderError && isMissingOrderSchemaCompatError(rpcOrderError)) {
      try {
        createdOrderIds = await createLegacyCheckoutOrders({
          buyerWallet,
          normalizedItems,
          productsById,
          shippingAddressJsonb,
          shippingEth,
          taxEth,
          currency,
          trackingCode,
          txHash,
          contractKind: orderContractKind,
          contractOrderId,
        });
      } catch (legacyError) {
        orderError = legacyError;
      }
    } else if (rpcOrderError || !createdOrderId) {
      orderError = rpcOrderError || new Error("Failed to create order");
    } else {
      createdOrderIds = [createdOrderId];
    }
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

  if (txHash) {
    const { error: txUpdateError } = await supabase
      .from("orders")
      .update({
        tx_hash: txHash,
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", createdOrderIds);

    if (txUpdateError) {
      console.warn("Order tx_hash update warning:", txUpdateError.message);
    }
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
    .select("id, buyer_wallet, product_id, status, paid_at, approval_status, payout_status, products(creator_wallet), order_items(product_id, products(creator_wallet))")
    .eq("id", req.params.id)
    .single();

  if (existingError && isMissingOrderSchemaCompatError(existingError)) {
    ({ data: existing, error: existingError } = await supabase
      .from("orders")
      .select("id, buyer_wallet, product_id, status, paid_at, approval_status, payout_status, products(creator_wallet)")
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

  const now = new Date().toISOString();
  const updates = { updated_at: now };
  let hasAllowedUpdate = false;

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
    const normalizedStatus = normalizeOrderStatus(req.body?.status);
    if (!normalizedStatus) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    updates.status = normalizedStatus;
    hasAllowedUpdate = true;

    if (normalizedStatus === "paid" && !existing.paid_at) {
      updates.paid_at = now;
    }
    if (normalizedStatus === "shipped") {
      updates.shipped_at = now;
    }
    if (normalizedStatus === "delivered") {
      updates.delivered_at = now;
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "tracking_code")) {
    const trackingCode =
      typeof req.body?.tracking_code === "string" ? req.body.tracking_code.trim() : "";
    updates.tracking_code = trackingCode || null;
    hasAllowedUpdate = true;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "approval_status")) {
    if (req.auth.role !== "admin") {
      return res.status(403).json({ error: "Only admin can change approval_status" });
    }

    const nextApprovalStatus =
      typeof req.body?.approval_status === "string" ? req.body.approval_status.trim().toLowerCase() : "";
    const allowedApprovalStatuses = new Set([
      "pending",
      "approved",
      "rejected",
      "production_accepted",
      "shipped",
      "delivered",
      "refunded",
    ]);

    if (!allowedApprovalStatuses.has(nextApprovalStatus)) {
      return res.status(400).json({ error: "Invalid approval_status" });
    }

    updates.approval_status = nextApprovalStatus;
    hasAllowedUpdate = true;

    if (nextApprovalStatus === "approved") {
      updates.payout_status = "approved";
    }
    if (nextApprovalStatus === "refunded") {
      updates.payout_status = "refunded";
      updates.status = "refunded";
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "payout_status")) {
    if (req.auth.role !== "admin") {
      return res.status(403).json({ error: "Only admin can change payout_status" });
    }

    const nextPayoutStatus =
      typeof req.body?.payout_status === "string" ? req.body.payout_status.trim().toLowerCase() : "";
    const allowedPayoutStatuses = new Set(["unreleased", "approved", "released", "refunded", "failed"]);

    if (!allowedPayoutStatuses.has(nextPayoutStatus)) {
      return res.status(400).json({ error: "Invalid payout_status" });
    }

    updates.payout_status = nextPayoutStatus;
    hasAllowedUpdate = true;
  }

  if (!hasAllowedUpdate) {
    return res.status(400).json({
      error: "Only status, tracking_code, approval_status, and payout_status can be updated via this endpoint",
    });
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (updates.status || updates.tracking_code || updates.approval_status) {
    const fulfillmentUpdates = { updated_at: now };
    let shouldUpdateFulfillments = false;

    if (updates.tracking_code !== undefined) {
      fulfillmentUpdates.tracking_code = updates.tracking_code;
      shouldUpdateFulfillments = true;
    }
    if (updates.status === "shipped") {
      fulfillmentUpdates.status = "shipped";
      fulfillmentUpdates.shipped_at = now;
      shouldUpdateFulfillments = true;
    }
    if (updates.status === "delivered") {
      fulfillmentUpdates.status = "delivered";
      fulfillmentUpdates.delivered_at = now;
      shouldUpdateFulfillments = true;
    }
    if (updates.approval_status === "production_accepted") {
      fulfillmentUpdates.status = "processing";
      shouldUpdateFulfillments = true;
    }
    if (updates.approval_status === "refunded") {
      fulfillmentUpdates.status = "cancelled";
      shouldUpdateFulfillments = true;
    }

    if (shouldUpdateFulfillments) {
      await supabase
        .from("fulfillments")
        .update(fulfillmentUpdates)
        .eq("order_id", req.params.id);
    }
  }

  if (req.auth.role === "admin") {
    if (updates.approval_status === "approved") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "approve_release_order",
        status: "approved",
        details: { order_id: req.params.id },
      });
    }
    if (updates.approval_status === "production_accepted") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "mark_production_accepted",
        status: "approved",
        details: { order_id: req.params.id },
      });
    }
    if (updates.tracking_code !== undefined) {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "attach_tracking",
        status: "approved",
        details: { order_id: req.params.id, tracking_code: updates.tracking_code },
      });
    }
    if (updates.status === "shipped") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "mark_shipped",
        status: "shipped",
        details: { order_id: req.params.id },
      });
    }
    if (updates.status === "delivered") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "mark_delivered",
        status: "delivered",
        details: { order_id: req.params.id },
      });
    }
    if (updates.payout_status === "released") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "release_creator_payout",
        status: "released",
        details: { order_id: req.params.id },
      });
    }
    if (updates.payout_status === "refunded" || updates.approval_status === "refunded") {
      await writeAdminAuditLog({
        adminWallet: req.auth.wallet,
        targetWallet: existing.buyer_wallet,
        action: "refund_release_order",
        status: "refunded",
        details: { order_id: req.params.id },
      });
    }
  }

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

function isPublicIPCampaign(campaign = {}) {
  return (
    ["listed", "unlisted"].includes(String(campaign.visibility || "")) &&
    ["active", "funded", "settled", "closed"].includes(String(campaign.status || ""))
  );
}

registerRoute("get", "/ip-campaigns", authOptional, async (req, res) => {
  try {
    const isAdmin = req.auth?.role === "admin";
    const requestedArtistId =
      typeof req.query.artist_id === "string" && req.query.artist_id.trim()
        ? req.query.artist_id.trim()
        : null;
    const requestedStatus =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : null;

    const ownedArtist = req.auth?.wallet
      ? await getArtistRecordByWallet(req.auth.wallet)
      : null;
    const isOwnerScopedRequest = Boolean(
      requestedArtistId &&
      ownedArtist?.id &&
      requestedArtistId === ownedArtist.id
    );
    let query = supabase
      .from("ip_campaigns")
      .select("*, artists(id, wallet, name, handle)")
      .order("created_at", { ascending: false });

    if (requestedArtistId) {
      query = query.eq("artist_id", requestedArtistId);
      if (!isAdmin && !isOwnerScopedRequest) {
        query = query
          .in("visibility", ["listed", "unlisted"])
          .in("status", ["active", "funded", "settled", "closed"]);
      }
    } else if (!isAdmin) {
      query = query
        .in("visibility", ["listed", "unlisted"])
        .in("status", ["active", "funded", "settled", "closed"]);
    }

    if (requestedStatus) {
      query = query.eq("status", requestedStatus);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const filtered = (data || []).filter((campaign) => {
      if (isAdmin) return true;
      if (isOwnerScopedRequest) return true;
      return isPublicIPCampaign(campaign);
    });

    return res.json(filtered);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load IP campaigns" });
  }
});

registerRoute("post", "/ip-campaigns", authRequired, async (req, res) => {
  try {
    const isAdmin = req.auth.role === "admin";
    const payload = normalizeIPCampaignPayload(req.body || {});
    if (!payload.title) {
      return res.status(400).json({ error: "title is required" });
    }

    let artistRecord = null;
    if (isAdmin && req.body?.artist_id) {
      const { data, error } = await supabase
        .from("artists")
        .select("id, wallet, name, handle, contract_address")
        .eq("id", req.body.artist_id)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      artistRecord = data;
    } else {
      artistRecord = await getArtistRecordByWallet(req.auth.wallet);
    }

    if (!artistRecord?.id) {
      return res.status(400).json({ error: "Artist profile not found. Complete your artist profile first." });
    }

    if (!isAdmin) {
      const whitelistStatus = await getWhitelistStatusByWallet(artistRecord.wallet);
      if (whitelistStatus !== "approved") {
        return res.status(403).json({ error: "Only approved artists can request an IP raise" });
      }
    }

    const followerCount = await getArtistSubscriberCount(artistRecord.contract_address);
    if (!isAdmin && followerCount < 100) {
      return res.status(403).json({
        error: `This artist needs at least 100 followers before requesting an IP raise. Current followers: ${followerCount}.`,
      });
    }

    const now = new Date().toISOString();
    const insertPayload = {
      artist_id: artistRecord.id,
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary,
      description: payload.description,
      campaign_type: payload.campaign_type,
      rights_type: payload.rights_type,
      status: isAdmin ? req.body?.status || "review" : "review",
      visibility: payload.visibility,
      funding_target_eth: payload.funding_target_eth ?? 0,
      minimum_raise_eth: payload.minimum_raise_eth ?? 0,
      unit_price_eth: payload.unit_price_eth,
      total_units: payload.total_units,
      opens_at: payload.opens_at,
      closes_at: payload.closes_at,
      legal_doc_uri: payload.legal_doc_uri,
      cover_image_uri: payload.cover_image_uri,
      metadata: {
        ...(payload.metadata || {}),
        review_status: isAdmin ? "approved" : "pending",
        eligibility_followers: followerCount,
        eligibility_threshold: 100,
        requested_by_wallet: normalizeWallet(req.auth.wallet),
        requested_at: now,
      },
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("ip_campaigns")
      .insert(insertPayload)
      .select("*, artists(id, wallet, name, handle)")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create IP campaign request" });
  }
});

registerRoute("patch", "/ip-campaigns/:id", authRequired, async (req, res) => {
  try {
    const isAdmin = req.auth.role === "admin";
    const { data: existing, error: existingError } = await supabase
      .from("ip_campaigns")
      .select("*, artists(id, wallet, name, handle, contract_address)")
      .eq("id", req.params.id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: existingError?.message || "IP campaign not found" });
    }

    const ownerWallet = normalizeWallet(existing.artists?.wallet || "");
    if (!sameWalletOrAdmin(ownerWallet, req.auth)) {
      return res.status(403).json({ error: "Only the artist or admin can update this IP campaign" });
    }

    const payload = normalizeIPCampaignPayload(req.body || {});
    const nextMetadata = {
      ...(existing.metadata || {}),
      ...(payload.metadata || {}),
    };

    const updates = {
      slug: payload.slug ?? existing.slug,
      title: payload.title ?? existing.title,
      summary: payload.summary,
      description: payload.description,
      campaign_type: payload.campaign_type ?? existing.campaign_type,
      rights_type: payload.rights_type ?? existing.rights_type,
      visibility: payload.visibility ?? existing.visibility,
      funding_target_eth: payload.funding_target_eth ?? existing.funding_target_eth,
      minimum_raise_eth: payload.minimum_raise_eth ?? existing.minimum_raise_eth,
      unit_price_eth: payload.unit_price_eth,
      total_units: payload.total_units,
      opens_at: payload.opens_at,
      closes_at: payload.closes_at,
      legal_doc_uri: payload.legal_doc_uri,
      cover_image_uri: payload.cover_image_uri,
      updated_at: new Date().toISOString(),
    };

    if (isAdmin && typeof req.body?.status === "string" && req.body.status.trim()) {
      const requestedStatus = req.body.status.trim();
      updates.status = requestedStatus;
      if (requestedStatus === "active") {
        if (existing.visibility === "private") {
          updates.visibility = "listed";
        }
        nextMetadata.review_status = "approved";
        nextMetadata.reviewed_by = req.auth.wallet;
        nextMetadata.reviewed_at = updates.updated_at;
        if (!existing.opens_at) {
          updates.opens_at = updates.updated_at;
        }
      } else if (requestedStatus === "cancelled" && existing.status === "review") {
        nextMetadata.review_status = "rejected";
        nextMetadata.reviewed_by = req.auth.wallet;
        nextMetadata.reviewed_at = updates.updated_at;
      }
    } else if (!isAdmin) {
      if (!["review", "draft"].includes(String(existing.status || ""))) {
        return res.status(400).json({ error: "Artist edits are only allowed while a raise is under review" });
      }
      updates.status = "review";
      nextMetadata.review_status = "pending";
    }

    updates.metadata = nextMetadata;

    const { data, error } = await supabase
      .from("ip_campaigns")
      .update(updates)
      .eq("id", req.params.id)
      .select("*, artists(id, wallet, name, handle)")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update IP campaign" });
  }
});

registerRoute("get", "/ip-investments", authRequired, async (req, res) => {
  try {
    const requestedWallet =
      typeof req.query.investor_wallet === "string" && req.query.investor_wallet.trim()
        ? normalizeWallet(req.query.investor_wallet)
        : req.auth.wallet;

    if (!sameWalletOrAdmin(requestedWallet, req.auth)) {
      return res.status(403).json({ error: "Cannot view another investor's positions" });
    }

    let query = supabase
      .from("ip_investments")
      .select("*, ip_campaigns(id, title, status, artist_id)")
      .eq("investor_wallet", requestedWallet)
      .order("created_at", { ascending: false });

    if (typeof req.query.campaign_id === "string" && req.query.campaign_id.trim()) {
      query = query.eq("campaign_id", req.query.campaign_id.trim());
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load investor positions" });
  }
});

registerRoute("post", "/ip-investments", authRequired, async (req, res) => {
  try {
    const campaignId = typeof req.body?.campaign_id === "string" ? req.body.campaign_id.trim() : "";
    if (!campaignId) {
      return res.status(400).json({ error: "campaign_id is required" });
    }

    const amountEth = Number(req.body?.amount_eth ?? 0);
    const requestedUnits = Number(req.body?.units_purchased ?? 0);
    if ((!Number.isFinite(amountEth) || amountEth <= 0) && (!Number.isFinite(requestedUnits) || requestedUnits <= 0)) {
      return res.status(400).json({ error: "A positive amount_eth or units_purchased is required" });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("ip_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: campaignError?.message || "IP campaign not found" });
    }

    if (campaign.status !== "active") {
      return res.status(400).json({ error: "This raise is not open for investors" });
    }

    if (!["listed", "unlisted"].includes(String(campaign.visibility || ""))) {
      return res.status(400).json({ error: "This raise is not visible to investors yet" });
    }

    const investorWallet = req.auth.wallet;
    const unitPrice = Number(campaign.unit_price_eth || 0);
    const computedUnits =
      requestedUnits > 0
        ? requestedUnits
        : unitPrice > 0
          ? Number((amountEth / unitPrice).toFixed(8))
          : 0;
    const computedAmount =
      amountEth > 0
        ? amountEth
        : unitPrice > 0 && requestedUnits > 0
          ? Number((requestedUnits * unitPrice).toFixed(8))
          : 0;

    if (computedUnits <= 0 || computedAmount <= 0) {
      return res.status(400).json({ error: "Unable to compute a valid investment amount" });
    }

    const now = new Date().toISOString();
    const investmentPayload = {
      campaign_id: campaign.id,
      investor_wallet: investorWallet,
      amount_eth: computedAmount,
      units_purchased: computedUnits,
      unit_price_eth: unitPrice || null,
      status: "pending",
      invested_at: now,
      metadata: {
        source: "web_app",
        note: "Pending until payment rail is finalized",
      },
      created_at: now,
      updated_at: now,
    };

    const { data: investment, error: investmentError } = await supabase
      .from("ip_investments")
      .insert(investmentPayload)
      .select("*")
      .single();

    if (investmentError) return res.status(400).json({ error: investmentError.message });

    const nextUnitsSold = Number(campaign.units_sold || 0) + computedUnits;
    const campaignUpdates = {
      units_sold: nextUnitsSold,
      updated_at: now,
      metadata: {
        ...(campaign.metadata || {}),
        last_investment_at: now,
      },
    };

    if (campaign.total_units && nextUnitsSold >= Number(campaign.total_units)) {
      campaignUpdates.status = "funded";
    }

    if (campaign.funding_target_eth && Number(campaign.funding_target_eth) > 0) {
      const totalRaised = Number((Number(campaign.metadata?.committed_amount_eth || 0) + computedAmount).toFixed(8));
      campaignUpdates.metadata.committed_amount_eth = totalRaised;
      if (totalRaised >= Number(campaign.funding_target_eth)) {
        campaignUpdates.status = "funded";
      }
    }

    await supabase
      .from("ip_campaigns")
      .update(campaignUpdates)
      .eq("id", campaign.id);

    return res.json(investment);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create investment" });
  }
});

const pinataFileImpl = async (req, res) => {
  try {
    const pinataAuthStrategies = requirePinataAuthStrategies(process.env);
    if (!req.file) return res.status(400).json({ error: "file is required" });

    let response = null;
    let text = "";
    let authMode = null;

    for (let index = 0; index < pinataAuthStrategies.length; index += 1) {
      const strategy = pinataAuthStrategies[index];
      authMode = strategy.mode;
      const form = new FormData();
      form.append("file", new Blob([req.file.buffer]), req.file.originalname);

      response = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: strategy.headers,
        body: form,
      });

      text = await response.text();
      if (response.ok || response.status !== 401 || index === pinataAuthStrategies.length - 1) {
        break;
      }

      console.warn(`Pinata file upload auth failed with ${strategy.mode}, retrying with next credential.`);
    }

    if (!response.ok) {
      console.error("Pinata file upload failed:", authMode, response.status, text);
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
    const pinataAuthStrategies = requirePinataAuthStrategies(process.env);
    const metadata = req.body?.metadata;
    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({ error: "metadata object is required" });
    }

    const payload = JSON.stringify(metadata);
    let response = null;
    let text = "";
    let authMode = null;

    for (let index = 0; index < pinataAuthStrategies.length; index += 1) {
      const strategy = pinataAuthStrategies[index];
      authMode = strategy.mode;
      response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          ...strategy.headers,
          "Content-Type": "application/json",
        },
        body: payload,
      });

      text = await response.text();
      if (response.ok || response.status !== 401 || index === pinataAuthStrategies.length - 1) {
        break;
      }

      console.warn(`Pinata JSON upload auth failed with ${strategy.mode}, retrying with next credential.`);
    }

    if (!response.ok) {
      console.error("Pinata JSON upload failed:", authMode, response.status, text);
      return res.status(response.status).send(text);
    }

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

const mediaProxyImpl = async (req, res) => {
  try {
    const target = resolveMediaProxyTarget(req.query?.url || req.query?.uri || "");
    if (!target) {
      return res.status(400).json({ error: "A valid media URL or IPFS URI is required." });
    }

    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        Accept: req.headers.accept || "*/*",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream media request failed with ${upstream.status} ${upstream.statusText}`,
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const cacheControl = upstream.headers.get("cache-control") || "public, max-age=3600";
    const contentLength = upstream.headers.get("content-length");
    const arrayBuffer = await upstream.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Allow-Credentials", "false");

    // For PDFs, ensure proper headers
    if (contentType.includes("pdf")) {
      res.setHeader("Content-Disposition", "inline");
    }

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to proxy media",
    });
  }
};

app.get("/media/proxy", mediaProxyImpl);
app.get("/api/media/proxy", mediaProxyImpl);

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
          status: approve ? (contractAddress ? "active" : "approved") : "rejected",
          bio: artistData.bio || latestApplication?.bio || null,
          tag: artistData.tag || null,
          twitter_url: artistData.twitter_url || latestApplication?.twitter_url || null,
          instagram_url: artistData.instagram_url || latestApplication?.instagram_url || null,
          website_url: artistData.website_url || latestApplication?.website_url || latestApplication?.portfolio_url || null,
          portfolio:
            Array.isArray(artistData.portfolio) && artistData.portfolio.length > 0
              ? artistData.portfolio
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
