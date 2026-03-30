import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

const {
  PORT = "8787",
  FRONTEND_ORIGIN = "http://localhost:5173,https://testpop-one.vercel.app",
  APP_JWT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET,
  PINATA_JWT,
  ADMIN_WALLETS = "",
  BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org",
  ART_DROP_FACTORY_ADDRESS = "0xFd58d0f5F0423201Edb756d0f44D667106fc5705",
  DEPLOYER_PRIVATE_KEY,
  NODE_ENV = "development",
} = process.env;

if (!APP_JWT_SECRET) {
  throw new Error("APP_JWT_SECRET is required");
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Nonce storage moved to Supabase (see: auth/challenge and auth/verify endpoints)

function normalizeWallet(wallet = "") {
  return wallet.trim().toLowerCase();
}

function requireEnv(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
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

async function verifyNonce(wallet, nonce) {
  const normalized = normalizeWallet(wallet);
  const now = new Date().toISOString();

  // Get unused nonce
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

  // Mark as used (one-time use)
  const { error: updateError } = await supabase
    .from("nonces")
    .update({ used: true, used_at: now })
    .eq("id", data.id);

  if (updateError) {
    console.error("Failed to mark nonce as used:", updateError);
    // Don't throw - let verification succeed even if marking fails
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

function makeChallengeMessage(wallet, nonce, issuedAtIso) {
  return [
    "PopUp secure sign-in",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAtIso}`,
    "",
    "This signature proves wallet ownership for PopUp API access.",
    "It does not move funds or approve token transfers.",
  ].join("\n");
}

function issueAppToken(payload) {
  return jwt.sign(payload, APP_JWT_SECRET, {
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

    const decoded = jwt.verify(token, APP_JWT_SECRET, {
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

const FACTORY_ABI = [
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

  const tx = await factory.deployArtDrop(artistWallet);
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
  };
}

app.use(helmet());

// Log CORS configuration
const corsOrigins = FRONTEND_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
console.log("🔐 CORS Origins configured:", corsOrigins);

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

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "popup-api", env: NODE_ENV });
});

app.post("/auth/challenge", async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Clean up expired nonces from database
    await cleanupExpiredNonces();

    // Issue new nonce (stored in Supabase)
    const { nonce, issuedAt } = await issueNonce(wallet);
    const message = makeChallengeMessage(wallet, nonce, issuedAt);

    return res.json({ wallet, nonce, issuedAt, message });
  } catch (error) {
    console.error("Challenge error:", error);
    return res.status(500).json({ error: error.message || "Failed to issue challenge" });
  }
});

app.post("/auth/verify", async (req, res) => {
  try {
    const wallet = normalizeWallet(req.body?.wallet);
    const signature = req.body?.signature;

    if (!ethers.isAddress(wallet) || !signature) {
      return res.status(400).json({ error: "Wallet and signature are required" });
    }

    // Clean up expired nonces from database
    await cleanupExpiredNonces();

    // Verify nonce (marks as used, enforces one-time use)
    const nonce_record = await verifyNonce(wallet, signature.includes("\n") ? null : req.body?.nonce);
    
    // In production: For each submission attempt, search for the corresponding nonce
    // This prevents replay attacks across multiple instances
    const { data: nonceRecord, error: nonceError } = await supabase
      .from("nonces")
      .select("id, nonce, issued_at")
      .eq("wallet", wallet)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nonceError || !nonceRecord) {
      return res.status(400).json({ error: "Challenge expired or missing" });
    }

    const message = makeChallengeMessage(wallet, nonceRecord.nonce, nonceRecord.issued_at);
    const recovered = normalizeWallet(ethers.verifyMessage(message, signature));

    if (recovered !== wallet) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    // Mark nonce as used
    await supabase
      .from("nonces")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", nonceRecord.id);

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
    return res.status(500).json({ error: error.message || "Verification failed" });
  }
});

app.get("/auth/session", authRequired, (req, res) => {
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

  const { data, error } = await supabase
    .from("drops")
    .insert({ ...drop })
    .select("*")
    .single();

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

  const { data, error } = await supabase
    .from("products")
    .insert({ ...product, creator_wallet: creatorWallet })
    .select("*")
    .single();

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

app.post("/orders", authRequired, async (req, res) => {
  const order = req.body || {};
  const buyerWallet = normalizeWallet(order.buyer_wallet);
  if (!buyerWallet) return res.status(400).json({ error: "buyer_wallet is required" });
  if (!sameWalletOrAdmin(buyerWallet, req.auth)) {
    return res.status(403).json({ error: "Cannot create an order for another wallet" });
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({ ...order, buyer_wallet: buyerWallet })
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.patch("/orders/:id", authRequired, async (req, res) => {
  const { data: existing, error: existingError } = await supabase
    .from("orders")
    .select("id, buyer_wallet, product_id, products(creator_wallet)")
    .eq("id", req.params.id)
    .single();

  if (existingError) return res.status(404).json({ error: existingError.message });
  const creatorWallet = existing.products?.creator_wallet;
  const canUpdate = req.auth.role === "admin" || normalizeWallet(creatorWallet) === req.auth.wallet;
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

app.post("/pinata/file", authRequired, upload.single("file"), async (req, res) => {
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
});

app.post("/pinata/json", authRequired, async (req, res) => {
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
});

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Approve artist and deploy contract
 * ═════════════════════════════════════════════════════════════
 */
app.post("/admin/approve-artist", authRequired, adminRequired, async (req, res) => {
  try {
    const { wallet, approve = false, deployContract = true } = req.body || {};
    const normalized = normalizeWallet(wallet);
    
    if (!normalized) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    // Get artist profile
    const { data: artistData, error: artistError } = await supabase
      .from("artists")
      .select("*")
      .eq("wallet", normalized)
      .maybeSingle();

    if (artistError) {
      return res.status(400).json({ error: `Cannot fetch artist: ${artistError.message}` });
    }

    if (!artistData) {
      return res.status(404).json({ error: "Artist profile not found" });
    }

    // Update whitelist status
    const { error: whitelistError } = await supabase
      .from("whitelist")
      .update({
        status: approve ? "approved" : "rejected",
        status_updated_at: new Date().toISOString(),
      })
      .eq("wallet", normalized);

    if (whitelistError) {
      console.error("❌ Whitelist update error:", whitelistError);
      return res.status(400).json({ error: `Failed to update whitelist: ${whitelistError.message}` });
    }

    // Update onchain whitelist (ArtDropFactory contract)
    let onchainUpdate = null;
    if (approve && deployContract) {
      try {
        onchainUpdate = await setArtistApprovalOnchain(normalized, true);
        console.log("✅ Artist approval set onchain:", normalized);
      } catch (err) {
        console.warn("⚠️ Onchain approval warning (non-blocking):", err.message);
        // Don't fail the entire operation if onchain update fails
      }
    }

    // If approving and contract not deployed, attempt deployment
    let contractAddress = artistData.contract_address;
    let deploymentTx = artistData.contract_deployment_tx;
    let deploymentError = null;

    if (approve && deployContract && !contractAddress) {
      try {
        const deployment = await deployArtistContractForWallet(normalized);
        contractAddress = deployment.contractAddress;
        deploymentTx = deployment.deploymentTx;
        console.log("🚀 Contract deployed for artist:", normalized);
        console.log("   Contract address:", contractAddress);
      } catch (err) {
        console.error("❌ Contract deployment error:", err);
        deploymentError = err instanceof Error ? err.message : "Unknown deployment error";
      }
    }

    // Update artist record with deployment status
    const updatePayload = {
      whitelisted_at: approve ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (contractAddress) {
      updatePayload.contract_address = contractAddress;
      updatePayload.contract_deployment_tx = deploymentTx;
      updatePayload.contract_deployed_at = new Date().toISOString();
    }

    const { data: updatedArtist, error: updateError } = await supabase
      .from("artists")
      .update(updatePayload)
      .eq("wallet", normalized)
      .select("*")
      .single();

    if (updateError) {
      return res.status(400).json({ error: `Failed to update artist: ${updateError.message}` });
    }

    // Log admin action (audit trail)
    await supabase.from("admin_audit_log").insert({
      admin_wallet: req.auth.wallet,
      action: "approve_artist",
      target_wallet: normalized,
      status: approve ? "approved" : "rejected",
      details: {
        deploymentStatus: contractAddress ? "deployed" : deploymentError ? "failed" : "pending",
        contractAddress,
        deploymentTx,
      },
    }).catch((err) => console.warn("Audit log warning:", err.message));

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
    });
  } catch (error) {
    console.error("❌ Approval error:", error);
    return res.status(500).json({ error: error.message || "Approval processing failed" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Reject artist (dedicated endpoint)
 * ═════════════════════════════════════════════════════════════
 */
app.post("/admin/reject-artist", authRequired, adminRequired, async (req, res) => {
  try {
    const { wallet, reason = "" } = req.body || {};
    const normalized = normalizeWallet(wallet);

    if (!normalized) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    // Get artist profile
    const { data: artistData, error: artistError } = await supabase
      .from("artists")
      .select("*")
      .eq("wallet", normalized)
      .maybeSingle();

    if (artistError) {
      return res.status(400).json({ error: `Cannot fetch artist: ${artistError.message}` });
    }

    if (!artistData) {
      return res.status(404).json({ error: "Artist profile not found" });
    }

    // Update whitelist status to rejected
    const { error: whitelistError } = await supabase
      .from("whitelist")
      .update({
        status: "rejected",
        status_updated_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("wallet", normalized);

    if (whitelistError) {
      console.error("❌ Whitelist rejection error:", whitelistError);
      return res.status(400).json({ error: `Failed to reject artist: ${whitelistError.message}` });
    }

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
        updated_at: new Date().toISOString(),
      })
      .eq("wallet", normalized)
      .select("*")
      .single();

    if (updateError) {
      return res.status(400).json({ error: `Failed to update artist: ${updateError.message}` });
    }

    // Log admin action (audit trail)
    await supabase.from("admin_audit_log").insert({
      admin_wallet: req.auth.wallet,
      action: "reject_artist",
      target_wallet: normalized,
      status: "rejected",
      details: {
        reason,
      },
    }).catch((err) => console.warn("Audit log warning:", err.message));

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
});

/**
 * ═════════════════════════════════════════════════════════════
 * ADMIN - Get pending and approved artists
 * ═════════════════════════════════════════════════════════════
 */
app.get("/admin/artists", authRequired, adminRequired, async (req, res) => {
  try {
    const { status } = req.query; // "pending", "approved", or undefined for all
    
    let query = supabase.from("whitelist").select("*, artists!inner(*)");
    
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      artists: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error("❌ Admin artists fetch error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch artists" });
  }
});

const port = Number(PORT) || 3000;

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
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
