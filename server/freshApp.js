import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "fresh-db.json");
const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";
const PINATA_ENDPOINT = process.env.PINATA_ENDPOINT || "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const READ_ONLY_FS_ERROR_CODES = new Set(["EROFS", "EACCES", "EPERM"]);
let useInMemoryDb = false;
let inMemoryDb = null;

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Collector-Id"],
  }),
);
app.options("*", cors());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

function nowIso() {
  return new Date().toISOString();
}

function cloneDb(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function enableInMemoryDb(seed) {
  useInMemoryDb = true;
  if (!inMemoryDb) {
    inMemoryDb = seed ? cloneDb(seed) : createSeedDb();
  }
}

function readDb() {
  ensureDb();
  if (useInMemoryDb) {
    if (!inMemoryDb) {
      inMemoryDb = createSeedDb();
    }
    return cloneDb(inMemoryDb);
  }
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function writeDb(payload) {
  if (useInMemoryDb) {
    inMemoryDb = cloneDb(payload);
    return;
  }

  try {
    fs.writeFileSync(DB_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    if (READ_ONLY_FS_ERROR_CODES.has(error?.code)) {
      enableInMemoryDb(payload);
      return;
    }
    throw error;
  }
}

function ensureDb() {
  if (useInMemoryDb) {
    if (!inMemoryDb) {
      inMemoryDb = createSeedDb();
    }
    return;
  }

  try {
    if (fs.existsSync(DB_PATH)) return;
    writeDb(createSeedDb());
  } catch (error) {
    if (READ_ONLY_FS_ERROR_CODES.has(error?.code)) {
      enableInMemoryDb();
      return;
    }
    throw error;
  }
}

function createSeedDb() {
  const createdAt = nowIso();
  return {
    version: 1,
    creators: [
      {
        id: "creator-aurora",
        name: "Aurora Vale",
        handle: "@auroravale",
        wallet: "0xAuroraCreatorWallet",
        bio: "Mixed media storyteller blending neon fragments with handwritten textures.",
        profile_image:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80",
        banner_image:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
        featured_portfolio: [
          {
            id: "portfolio-aurora-1",
            title: "Starlit Panels",
            asset_url:
              "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
            asset_type: "image",
            created_at: createdAt,
          },
        ],
      },
      {
        id: "creator-nova",
        name: "Nova Ikeda",
        handle: "@novaikeda",
        wallet: "0xNovaCreatorWallet",
        bio: "Futurist illustrator shipping episodic worlds and collector zines.",
        profile_image:
          "https://images.unsplash.com/photo-1542206395-9feb3edaa68d?auto=format&fit=crop&w=1200&q=80",
        banner_image:
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80",
        featured_portfolio: [
          {
            id: "portfolio-nova-1",
            title: "Neon Futures",
            asset_url:
              "https://images.unsplash.com/photo-1472162314594-9b9b1ea60944?auto=format&fit=crop&w=1200&q=80",
            asset_type: "image",
            created_at: createdAt,
          },
        ],
      },
      {
        id: "creator-rio",
        name: "Rio Mercer",
        handle: "@riomercer",
        wallet: "0xRioCreatorWallet",
        bio: "Motion design kits for creators who ship fast.",
        profile_image:
          "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=1200&q=80",
        banner_image:
          "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80",
        featured_portfolio: [
          {
            id: "portfolio-rio-1",
            title: "Motion Kit Frames",
            asset_url:
              "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
            asset_type: "image",
            created_at: createdAt,
          },
        ],
      },
    ],
    products: [
      {
        id: "product-starlit-book",
        creator_id: "creator-aurora",
        title: "Starlit Sketchbook",
        description: "Digital art bundle with layered PSD source files and print-ready exports.",
        image_url:
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1600&q=80",
        delivery_url:
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=2200&q=90",
        price_eth: 0.032,
        product_type: "art",
        delivery_mode: "render_online",
      },
      {
        id: "product-neon-ebook",
        creator_id: "creator-nova",
        title: "Neon Futures eBook",
        description: "Interactive eBook featuring concept art, process notes, and bonus chapter drops.",
        image_url:
          "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        delivery_url:
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        price_eth: 0.018,
        product_type: "pdf",
        delivery_mode: "render_online",
      },
      {
        id: "product-rio-pack",
        creator_id: "creator-rio",
        title: "Rio Motion Kit",
        description: "Downloadable creator toolkit: overlays, transitions, LUTs, and presets.",
        image_url:
          "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1600&q=80",
        delivery_url:
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        price_eth: 0.025,
        product_type: "downloadable",
        delivery_mode: "download_mobile",
      },
      {
        id: "product-aurora-zine",
        creator_id: "creator-aurora",
        title: "Midnight Zine Vol.1",
        description: "Collector zine PDF with behind-the-scenes project breakdowns.",
        image_url:
          "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        delivery_url:
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        price_eth: 0.014,
        product_type: "pdf",
        delivery_mode: "render_online",
      },
      {
        id: "product-aurora-print",
        creator_id: "creator-aurora",
        title: "Aurora Holo Print",
        description: "Limited run physical print with holographic foil finish.",
        image_url:
          "https://images.unsplash.com/photo-1457305237443-44c3d5a30b89?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://images.unsplash.com/photo-1457305237443-44c3d5a30b89?auto=format&fit=crop&w=1600&q=80",
        delivery_url: "",
        price_eth: 0.09,
        product_type: "physical",
        delivery_mode: "deliver_physical",
      },
      {
        id: "product-nova-collectible",
        creator_id: "creator-nova",
        title: "Neon Token Collectible",
        description: "Onchain collectible drop with unlockable art pack.",
        image_url:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80",
        delivery_url: "",
        price_eth: 0.055,
        product_type: "art",
        delivery_mode: "collect_onchain",
        onchain: {
          chain: "base-sepolia",
          contract_address: "0xNeonCollectibleContract",
          drop_id: 1,
        },
      },
      {
        id: "product-nova-video",
        creator_id: "creator-nova",
        title: "Neon Futures Trailer",
        description: "Short cinematic teaser to view directly in the app.",
        image_url:
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1400&q=80",
        preview_url:
          "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
        delivery_url:
          "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
        price_eth: 0.022,
        product_type: "video",
        delivery_mode: "render_online",
      },
    ],
    posts: [
      {
        id: "post-1",
        product_id: "product-starlit-book",
        creator_id: "creator-aurora",
        caption: "Fresh deck drop. Layered files included for collectors.",
        featured: true,
        created_at: createdAt,
      },
      {
        id: "post-2",
        product_id: "product-neon-ebook",
        creator_id: "creator-nova",
        caption: "Episode zero of the Neon Futures release is now live.",
        featured: true,
        created_at: createdAt,
      },
      {
        id: "post-3",
        product_id: "product-rio-pack",
        creator_id: "creator-rio",
        caption: "Motion kit update includes 24 new transitions.",
        featured: false,
        created_at: createdAt,
      },
      {
        id: "post-4",
        product_id: "product-aurora-zine",
        creator_id: "creator-aurora",
        caption: "Limited zine preview. Comment with your favorite spread.",
        featured: false,
        created_at: createdAt,
      },
      {
        id: "post-5",
        product_id: "product-aurora-print",
        creator_id: "creator-aurora",
        caption: "Holo print shipment available for the next 48 hours.",
        featured: false,
        created_at: createdAt,
      },
      {
        id: "post-6",
        product_id: "product-nova-collectible",
        creator_id: "creator-nova",
        caption: "Collectible drop: claim onchain + unlocks digital pack.",
        featured: true,
        created_at: createdAt,
      },
    ],
    likes: [],
    comments: [],
    carts: {},
    orders: [],
    gifts: [],
    collections: [],
    poaps: [],
    subscriptions: [],
    pins: [],
    creator_applications: [
      {
        id: "application-aurora",
        creator_id: "creator-aurora",
        status: "approved",
        submitted_at: createdAt,
      },
      {
        id: "application-nova",
        creator_id: "creator-nova",
        status: "review",
        submitted_at: createdAt,
      },
    ],
  };
}

function normalizeCollectorId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.replace(/[^a-z0-9-_]/g, "").slice(0, 64);
}

function resolveCollectorId(req) {
  const bodyValue =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body.collector_id
      : "";
  const queryValue = typeof req.query.collector_id === "string" ? req.query.collector_id : "";
  const headerValue = req.get("x-collector-id") || "";
  const candidate = bodyValue || queryValue || headerValue;
  const normalized = normalizeCollectorId(candidate);
  return normalized || `guest-${randomUUID().slice(0, 8)}`;
}

function firstById(list, id) {
  return list.find((entry) => entry.id === id) || null;
}

function normalizeProductType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "digital_art") return "digital_art";
  if (normalized === "ebook") return "ebook";
  if (normalized === "file") return "file";
  if (normalized === "physical") return "physical";
  if (normalized === "collectible") return "collectible";
  if (normalized === "art") return "art";
  if (normalized === "video") return "video";
  if (normalized === "pdf") return "pdf";
  if (normalized === "downloadable") return "downloadable";
  return "file";
}

function resolveDeliveryMode(product) {
  const explicit = String(product?.delivery_mode || "").trim();
  if (explicit) return explicit;
  if (product?.onchain) return "collect_onchain";
  const type = normalizeProductType(product?.product_type);
  if (type === "digital_art") return "render_online";
  if (type === "art") return "render_online";
  if (type === "video") return "render_online";
  if (type === "pdf") return "render_online";
  if (type === "ebook") return "render_online";
  if (type === "physical") return "deliver_physical";
  if (type === "collectible") return "collect_onchain";
  if (type === "downloadable") return "download_mobile";
  return "download_mobile";
}

function resolveFulfillmentLabel(deliveryMode) {
  switch (deliveryMode) {
    case "deliver_physical":
      return "Physical delivery";
    case "collect_onchain":
      return "Collect onchain";
    case "render_online":
      return "Render online";
    case "download_mobile":
      return "Download to mobile";
    default:
      return "Digital delivery";
  }
}

function resolveProductRender(product) {
  const type = normalizeProductType(product?.product_type);
  const imageUrl = String(product?.image_url || "").trim();
  const previewUrl = String(product?.preview_url || "").trim();
  const deliveryUrl = String(product?.delivery_url || "").trim();
  const deliveryMode = resolveDeliveryMode(product);

  if (deliveryMode === "deliver_physical") {
    return {
      product_type: type,
      delivery_mode: deliveryMode,
      render_mode: "delivery",
      image_url: imageUrl || previewUrl || null,
      readable_url: null,
      download_url: null,
    };
  }

  if (type === "digital_art" || type === "art" || type === "collectible") {
    return {
      product_type: type,
      delivery_mode: deliveryMode,
      render_mode: "image",
      image_url: previewUrl || imageUrl,
      readable_url: null,
      download_url: deliveryUrl || previewUrl || imageUrl || null,
    };
  }

  if (type === "ebook") {
    const readable = previewUrl || deliveryUrl || null;
    return {
      product_type: type,
      delivery_mode: deliveryMode,
      render_mode: "ebook",
      image_url: imageUrl || null,
      readable_url: readable,
      download_url: deliveryUrl || readable,
    };
  }

  if (type === "video") {
    const readable = previewUrl || deliveryUrl || null;
    return {
      product_type: type,
      delivery_mode: deliveryMode,
      render_mode: "video",
      image_url: imageUrl || previewUrl || null,
      readable_url: readable,
      download_url: deliveryUrl || readable,
    };
  }

  if (type === "pdf") {
    const readable = previewUrl || deliveryUrl || null;
    return {
      product_type: type,
      delivery_mode: deliveryMode,
      render_mode: "pdf",
      image_url: imageUrl || null,
      readable_url: readable,
      download_url: deliveryUrl || readable,
    };
  }

  return {
    product_type: type,
    delivery_mode: deliveryMode,
    render_mode: "download",
    image_url: imageUrl || previewUrl || null,
    readable_url: null,
    download_url: deliveryUrl || null,
  };
}

function resolveInAppAction(product, render) {
  const resolvedRender = render || resolveProductRender(product);
  const mode = String(resolvedRender?.render_mode || "").trim().toLowerCase();
  const deliveryMode = String(resolvedRender?.delivery_mode || "").trim().toLowerCase();

  if (mode === "video" || mode === "pdf" || mode === "ebook") {
    return {
      in_app_action: "view_in_app",
      in_app_action_label: "View in app",
    };
  }

  if (deliveryMode === "collect_onchain") {
    return {
      in_app_action: "collect_in_app",
      in_app_action_label: "Collect onchain",
    };
  }

  return {
    in_app_action: "collect_in_app",
    in_app_action_label: "Collect in app",
  };
}

function isOnchainGated(product, render) {
  const resolvedRender = render || resolveProductRender(product);
  return String(resolvedRender?.delivery_mode || "").trim().toLowerCase() === "collect_onchain";
}

function grantOnchainCollection(db, collectorId, productId, txHash) {
  const product = firstById(db.products, productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const render = resolveProductRender(product);
  const deliveryMode = String(render?.delivery_mode || "").trim().toLowerCase();
  if (deliveryMode !== "collect_onchain") {
    throw new Error("This product is not configured for onchain collection.");
  }

  const existing = db.collections.find(
    (entry) =>
      entry.collector_id === collectorId &&
      entry.product_id === productId,
  );
  if (existing) {
    return existing;
  }

  const entry = {
    id: `collection-${randomUUID().slice(0, 10)}`,
    collector_id: collectorId,
    order_id: null,
    product_id: productId,
    quantity: 1,
    delivery_mode: deliveryMode,
    is_gated: true,
    onchain_tx_hash: String(txHash || "").trim() || null,
    acquired_at: nowIso(),
  };
  db.collections.push(entry);
  return entry;
}

function summarizeCart(db, collectorId) {
  const items = Array.isArray(db.carts[collectorId]) ? db.carts[collectorId] : [];
  const hydrated = items
    .map((entry) => {
      const product = firstById(db.products, entry.product_id);
      const creator = product ? firstById(db.creators, product.creator_id) : null;
      if (!product) return null;

      const quantity = Math.max(1, Number(entry.quantity) || 1);
      const unitPriceEth = Number(product.price_eth) || 0;
      const render = resolveProductRender(product);
      const inAppAction = resolveInAppAction(product, render);
      const isGated = isOnchainGated(product, render);
      return {
        product_id: product.id,
        creator_id: product.creator_id,
        quantity,
        unit_price_eth: unitPriceEth,
        line_total_eth: Number((unitPriceEth * quantity).toFixed(6)),
        title: product.title,
        image_url: render.image_url || product.image_url,
        product_type: render.product_type,
        render_mode: render.render_mode,
        delivery_mode: render.delivery_mode,
        fulfillment_label: resolveFulfillmentLabel(render.delivery_mode),
        in_app_action: inAppAction.in_app_action,
        in_app_action_label: inAppAction.in_app_action_label,
        readable_url: render.readable_url,
        download_url: render.download_url,
        is_gated: isGated,
        creator_name: creator?.name || "Creator",
        creator_handle: creator?.handle || "",
      };
    })
    .filter(Boolean);

  return {
    collector_id: collectorId,
    items: hydrated,
    total_eth: Number(hydrated.reduce((sum, item) => sum + Number(item.line_total_eth || 0), 0).toFixed(6)),
  };
}

function buildFeedItem(db, collectorId, post) {
  const product = firstById(db.products, post.product_id);
  const creator = firstById(db.creators, post.creator_id);
  if (!product || !creator) return null;
  const render = resolveProductRender(product);
  const inAppAction = resolveInAppAction(product, render);
  const isGated = isOnchainGated(product, render);

  const likeCount = db.likes.filter((like) => like.post_id === post.id).length;
  const commentCount = db.comments.filter((comment) => comment.post_id === post.id).length;
  const liked = db.likes.some((like) => like.post_id === post.id && like.collector_id === collectorId);

  return {
    id: post.id,
    post_id: post.id,
    product_id: product.id,
    item_type: "product",
    title: product.title,
    description: post.caption || product.description,
    image_url: render.image_url || product.image_url,
    price_eth: product.price_eth,
    product_type: render.product_type,
    render_mode: render.render_mode,
    delivery_mode: render.delivery_mode,
    fulfillment_label: resolveFulfillmentLabel(render.delivery_mode),
    in_app_action: inAppAction.in_app_action,
    in_app_action_label: inAppAction.in_app_action_label,
    is_gated: isGated,
    onchain: product?.onchain || null,
    creator_id: creator.id,
    creator_wallet: creator.wallet || creator.handle,
    creator_name: creator.name,
    creator_avatar_url: creator.profile_image,
    can_purchase: true,
    can_bid: false,
    like_count: likeCount,
    comment_count: commentCount,
    liked,
    created_at: post.created_at,
  };
}

function grantCollection(db, collectorId, orderId, items) {
  for (const item of items) {
    const existing = db.collections.find(
      (entry) =>
        entry.collector_id === collectorId &&
        entry.order_id === orderId &&
        entry.product_id === item.product_id,
    );
    if (existing) continue;
    db.collections.push({
      id: `collection-${randomUUID().slice(0, 10)}`,
      collector_id: collectorId,
      order_id: orderId,
      product_id: item.product_id,
      quantity: Math.max(1, Number(item.quantity) || 1),
      delivery_mode: item.delivery_mode || null,
      is_gated: String(item.delivery_mode || "").trim().toLowerCase() === "collect_onchain",
      acquired_at: nowIso(),
    });
  }
}

function buildProfile(db, collectorId) {
  const collection = db.collections
    .filter((entry) => entry.collector_id === collectorId)
    .map((entry) => {
      const product = firstById(db.products, entry.product_id);
      const creator = product ? firstById(db.creators, product.creator_id) : null;
      const render = product ? resolveProductRender(product) : null;
      const inAppAction = product ? resolveInAppAction(product, render) : null;
      const isGated = entry.is_gated ?? (product ? isOnchainGated(product, render) : false);
      return {
        id: entry.id,
        product_id: entry.product_id,
        title: product?.title || "Untitled Product",
        image_url: render?.image_url || product?.image_url || "",
        product_type: render?.product_type || "file",
        render_mode: render?.render_mode || "download",
        delivery_mode: entry.delivery_mode || render?.delivery_mode || "download_mobile",
        fulfillment_label: resolveFulfillmentLabel(entry.delivery_mode || render?.delivery_mode),
        in_app_action: inAppAction?.in_app_action || "collect_in_app",
        in_app_action_label: inAppAction?.in_app_action_label || "Collect in app",
        readable_url: render?.readable_url || null,
        download_url: render?.download_url || null,
        is_gated: isGated,
        owned: true,
        onchain_tx_hash: entry.onchain_tx_hash || null,
        creator_name: creator?.name || "Creator",
        acquired_at: entry.acquired_at,
      };
    });

  const orders = db.orders
    .filter((entry) => entry.collector_id === collectorId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((entry) => ({
      id: entry.id,
      status: entry.status,
      payment_method: entry.payment_method,
      total_eth: entry.total_eth,
      fulfillment: entry.fulfillment || null,
      created_at: entry.created_at,
      items: entry.items,
      gift_token: entry.gift_token || null,
    }));

  const pendingGifts = db.gifts
    .filter((gift) => gift.status === "pending" && gift.sender_collector_id === collectorId)
    .map((gift) => ({
      token: gift.token,
      sender_collector_id: gift.sender_collector_id,
      recipient_label: gift.recipient_label,
      created_at: gift.created_at,
      items: gift.items,
      claim_url: gift.claim_url,
    }));

  return {
    collector_id: collectorId,
    collection,
    poaps: db.poaps.filter((entry) => entry.collector_id === collectorId),
    subscriptions: db.subscriptions.filter((entry) => entry.collector_id === collectorId),
    cart: summarizeCart(db, collectorId),
    orders,
    pending_gifts: pendingGifts,
    creator_dashboard_path: "/creator/analytics",
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildProductResponse(db, product, collectorId = "") {
  const creator = firstById(db.creators, product.creator_id);
  const render = resolveProductRender(product);
  const inAppAction = resolveInAppAction(product, render);
  const isGated = isOnchainGated(product, render);
  const isOwned =
    collectorId &&
    db.collections.some(
      (entry) => entry.collector_id === collectorId && entry.product_id === product.id,
    );
  return {
    id: product.id,
    creator_id: product.creator_id,
    title: product.title,
    description: product.description,
    image_url: render.image_url || product.image_url || "",
    price_eth: Number(product.price_eth) || 0,
    product_type: render.product_type,
    render_mode: render.render_mode,
    delivery_mode: render.delivery_mode,
    fulfillment_label: resolveFulfillmentLabel(render.delivery_mode),
    in_app_action: inAppAction.in_app_action,
    in_app_action_label: inAppAction.in_app_action_label,
    readable_url: render.readable_url,
    download_url: render.download_url,
    is_gated: isGated,
    owned: Boolean(isOwned),
    creator_name: creator?.name || "Creator",
    creator_handle: creator?.handle || "",
    creator_avatar_url: creator?.profile_image || null,
    onchain: product?.onchain || null,
  };
}

function buildCreatorProfile(db, creator) {
  const products = db.products
    .filter((entry) => entry.creator_id === creator.id)
    .map((entry) => buildProductResponse(db, entry));
  const featured = Array.isArray(creator.featured_portfolio) ? creator.featured_portfolio : [];
  return {
    id: creator.id,
    name: creator.name,
    handle: creator.handle,
    bio: creator.bio || "",
    wallet: creator.wallet || "",
    profile_image: creator.profile_image || "",
    banner_image: creator.banner_image || "",
    featured_portfolio: featured,
    products,
    stats: {
      total_products: products.length,
      total_sales: db.orders.filter((order) => order.items?.some((item) => item.creator_id === creator.id)).length,
      total_revenue_eth: Number(
        db.orders
          .filter((order) => order.items?.some((item) => item.creator_id === creator.id))
          .reduce((sum, order) => sum + Number(order.total_eth || 0), 0)
          .toFixed(6),
      ),
    },
  };
}

function buildIpfsUrls(cid) {
  const safeCid = String(cid || "").trim();
  return {
    cid: safeCid,
    ipfs_url: safeCid ? `ipfs://${safeCid}` : "",
    gateway_url: safeCid ? `${PINATA_GATEWAY}/${safeCid}` : "",
  };
}

async function pinataPinJson({ name, data }) {
  if (!PINATA_JWT) {
    const mockCid = `bafy${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    return { ...buildIpfsUrls(mockCid), is_mock: true };
  }

  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataMetadata: { name: name || "popup-asset" },
      pinataContent: data,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Pinata upload failed");
  }
  const cid = payload?.IpfsHash || payload?.Hash || payload?.cid || "";
  return { ...buildIpfsUrls(cid), is_mock: false };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "popup-fresh-api" });
});

app.get("/fresh/bootstrap", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const db = readDb();
  const profile = buildProfile(db, collectorId);
  res.json({
    collector_id: collectorId,
    user_type: "guest_collector",
    profile_summary: {
      collection_count: profile.collection.length,
      poap_count: profile.poaps.length,
      subscription_count: profile.subscriptions.length,
      cart_items: profile.cart.items.length,
      order_count: profile.orders.length,
    },
  });
});

app.post("/fresh/pinata/metadata", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "popup-asset").trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
    const db = readDb();
    const pin = await pinataPinJson({ name, data: metadata });
    const entry = {
      id: `pin-${randomUUID().slice(0, 10)}`,
      name,
      metadata,
      ...pin,
      created_at: nowIso(),
    };
    db.pins.push(entry);
    writeDb(db);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

app.get("/fresh/creator/:creatorId", (req, res) => {
  const creatorId = String(req.params.creatorId || "").trim();
  const db = readDb();
  const creator = firstById(db.creators, creatorId);
  if (!creator) return res.status(404).json({ error: "Creator not found" });
  return res.json(buildCreatorProfile(db, creator));
});

app.get("/fresh/creator/:creatorId/portfolio", (req, res) => {
  const creatorId = String(req.params.creatorId || "").trim();
  const db = readDb();
  const creator = firstById(db.creators, creatorId);
  if (!creator) return res.status(404).json({ error: "Creator not found" });
  const portfolio = Array.isArray(creator.featured_portfolio) ? creator.featured_portfolio : [];
  return res.json({ creator_id: creatorId, portfolio });
});

app.post("/fresh/creator/:creatorId/portfolio", async (req, res, next) => {
  try {
    const creatorId = String(req.params.creatorId || "").trim();
    const db = readDb();
    const creator = firstById(db.creators, creatorId);
    if (!creator) return res.status(404).json({ error: "Creator not found" });

    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });

    const assetUrl = String(req.body?.asset_url || "").trim();
    const assetType = String(req.body?.asset_type || "image").trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
    const pinToIpfs = Boolean(req.body?.pin_to_ipfs);

    let ipfs = null;
    if (pinToIpfs) {
      ipfs = await pinataPinJson({
        name: `${creatorId}-${title}`,
        data: {
          title,
          asset_url: assetUrl,
          asset_type: assetType,
          ...metadata,
        },
      });
    }

    const portfolioItem = {
      id: `portfolio-${randomUUID().slice(0, 10)}`,
      title,
      asset_url: assetUrl || ipfs?.gateway_url || "",
      asset_type: assetType,
      ipfs,
      created_at: nowIso(),
    };

    creator.featured_portfolio = Array.isArray(creator.featured_portfolio)
      ? creator.featured_portfolio
      : [];
    creator.featured_portfolio.unshift(portfolioItem);
    writeDb(db);

    res.status(201).json(portfolioItem);
  } catch (error) {
    next(error);
  }
});

app.get("/fresh/admin/overview", (req, res) => {
  const db = readDb();
  res.json({
    creators: db.creators.length,
    products: db.products.length,
    orders: db.orders.length,
    gifts: db.gifts.length,
    pending_gifts: db.gifts.filter((gift) => gift.status === "pending").length,
    applications_review: db.creator_applications.filter((app) => app.status === "review").length,
  });
});

app.get("/fresh/admin/creators", (req, res) => {
  const db = readDb();
  const creators = db.creators.map((creator) => buildCreatorProfile(db, creator));
  res.json({ creators });
});

app.get("/fresh/admin/orders", (req, res) => {
  const db = readDb();
  const orders = db.orders
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ orders });
});

app.get("/fresh/admin/gifts", (req, res) => {
  const db = readDb();
  const gifts = db.gifts
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ gifts });
});

app.get("/fresh/home", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const db = readDb();
  const featured = db.posts
    .filter((post) => Boolean(post.featured))
    .map((post) => buildFeedItem(db, collectorId, post))
    .filter(Boolean);
  res.json({ collector_id: collectorId, featured });
});

app.get("/fresh/discover", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const db = readDb();
  const feed = db.posts
    .map((post) => buildFeedItem(db, collectorId, post))
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ collector_id: collectorId, feed });
});

app.post("/fresh/discover/:postId/like", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const postId = String(req.params.postId || "").trim();
  if (!postId) {
    return res.status(400).json({ error: "postId is required" });
  }

  const db = readDb();
  const post = firstById(db.posts, postId);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const existing = db.likes.findIndex(
    (entry) => entry.post_id === postId && entry.collector_id === collectorId,
  );
  if (existing >= 0) {
    db.likes.splice(existing, 1);
  } else {
    db.likes.push({
      id: `like-${randomUUID().slice(0, 10)}`,
      post_id: postId,
      collector_id: collectorId,
      created_at: nowIso(),
    });
  }

  writeDb(db);
  const liked = db.likes.some((entry) => entry.post_id === postId && entry.collector_id === collectorId);
  const likeCount = db.likes.filter((entry) => entry.post_id === postId).length;
  return res.json({ post_id: postId, liked, like_count: likeCount });
});

app.get("/fresh/discover/:postId/comments", (req, res) => {
  const postId = String(req.params.postId || "").trim();
  const db = readDb();
  const comments = db.comments
    .filter((entry) => entry.post_id === postId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  res.json({ post_id: postId, comments });
});

app.post("/fresh/discover/:postId/comments", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const postId = String(req.params.postId || "").trim();
  const body = String(req.body?.body || "").trim();

  if (!postId) return res.status(400).json({ error: "postId is required" });
  if (!body) return res.status(400).json({ error: "Comment body is required" });

  const db = readDb();
  const post = firstById(db.posts, postId);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comment = {
    id: `comment-${randomUUID().slice(0, 10)}`,
    post_id: postId,
    collector_id: collectorId,
    body,
    created_at: nowIso(),
  };
  db.comments.push(comment);
  writeDb(db);
  return res.status(201).json({ comment });
});

app.get("/fresh/products/:id", (req, res) => {
  const db = readDb();
  const product = firstById(db.products, String(req.params.id || "").trim());
  if (!product) return res.status(404).json({ error: "Product not found" });
  const collectorId = normalizeCollectorId(req.query?.collector_id || req.get("x-collector-id") || "");
  return res.json(buildProductResponse(db, product, collectorId));
});


app.get("/fresh/cart/:collectorId", (req, res) => {
  const collectorId = normalizeCollectorId(req.params.collectorId);
  if (!collectorId) return res.status(400).json({ error: "collectorId is required" });
  const db = readDb();
  return res.json(summarizeCart(db, collectorId));
});

app.post("/fresh/cart/add", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const productId = String(req.body?.product_id || "").trim();
  const quantity = Math.max(1, Number(req.body?.quantity) || 1);
  if (!productId) return res.status(400).json({ error: "product_id is required" });

  const db = readDb();
  const product = firstById(db.products, productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const inAppAction = resolveInAppAction(product, resolveProductRender(product));
  if (inAppAction.in_app_action === "view_in_app") {
    return res.status(409).json({
      error: "This product is view-only in app and cannot be added to checkout.",
      in_app_action: inAppAction.in_app_action,
    });
  }

  const existing = Array.isArray(db.carts[collectorId]) ? db.carts[collectorId] : [];
  const item = existing.find((entry) => entry.product_id === productId);
  if (item) {
    item.quantity = Math.max(1, Number(item.quantity || 0) + quantity);
  } else {
    existing.push({ product_id: productId, quantity });
  }
  db.carts[collectorId] = existing;
  writeDb(db);
  return res.json(summarizeCart(db, collectorId));
});

app.patch("/fresh/cart/:collectorId/items/:productId", (req, res) => {
  const collectorId = normalizeCollectorId(req.params.collectorId);
  const productId = String(req.params.productId || "").trim();
  const quantity = Math.max(1, Number(req.body?.quantity) || 1);
  if (!collectorId || !productId) {
    return res.status(400).json({ error: "collectorId and productId are required" });
  }

  const db = readDb();
  const items = Array.isArray(db.carts[collectorId]) ? db.carts[collectorId] : [];
  const target = items.find((entry) => entry.product_id === productId);
  if (!target) return res.status(404).json({ error: "Cart item not found" });
  target.quantity = quantity;
  db.carts[collectorId] = items;
  writeDb(db);
  return res.json(summarizeCart(db, collectorId));
});

app.delete("/fresh/cart/:collectorId/items/:productId", (req, res) => {
  const collectorId = normalizeCollectorId(req.params.collectorId);
  const productId = String(req.params.productId || "").trim();
  if (!collectorId || !productId) {
    return res.status(400).json({ error: "collectorId and productId are required" });
  }

  const db = readDb();
  const items = Array.isArray(db.carts[collectorId]) ? db.carts[collectorId] : [];
  db.carts[collectorId] = items.filter((entry) => entry.product_id !== productId);
  writeDb(db);
  return res.json(summarizeCart(db, collectorId));
});

app.post("/fresh/checkout", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const paymentMethodCandidate = String(req.body?.payment_method || "offramp_partner")
    .trim()
    .toLowerCase();
  const paymentMethod =
    paymentMethodCandidate === "onchain" ? "onchain" : "offramp_partner";
  const directItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const db = readDb();

  const cartItems = summarizeCart(db, collectorId).items;
  const itemsToCheckout = directItems.length > 0
    ? directItems
        .map((entry) => ({
          product_id: String(entry?.product_id || "").trim(),
          quantity: Math.max(1, Number(entry?.quantity) || 1),
        }))
        .filter((entry) => entry.product_id)
    : cartItems.map((entry) => ({
        product_id: entry.product_id,
        quantity: entry.quantity,
      }));

  if (itemsToCheckout.length === 0) {
    return res.status(400).json({ error: "No checkout items found" });
  }

  const hydratedItems = itemsToCheckout.map((entry) => {
    const product = firstById(db.products, entry.product_id);
    if (!product) return null;
    const render = resolveProductRender(product);
    const inAppAction = resolveInAppAction(product, render);
    const isGated = isOnchainGated(product, render);
    if (inAppAction.in_app_action === "view_in_app") {
      return {
        blocked: true,
        product_id: product.id,
        title: product.title,
      };
    }
    const deliveryMode = render.delivery_mode;
    return {
      product_id: product.id,
      creator_id: product.creator_id,
      quantity: entry.quantity,
      unit_price_eth: Number(product.price_eth) || 0,
      line_total_eth: Number(((Number(product.price_eth) || 0) * entry.quantity).toFixed(6)),
      title: product.title,
      image_url: render.image_url || product.image_url,
      product_type: render.product_type,
      render_mode: render.render_mode,
      delivery_mode: deliveryMode,
      fulfillment_label: resolveFulfillmentLabel(deliveryMode),
      in_app_action: inAppAction.in_app_action,
      in_app_action_label: inAppAction.in_app_action_label,
      readable_url: render.readable_url,
      download_url: render.download_url,
      is_gated: isGated,
    };
  });

  if (hydratedItems.some((entry) => !entry)) {
    return res.status(404).json({ error: "One or more products are unavailable" });
  }

  const blockedItem = hydratedItems.find((entry) => entry?.blocked);
  if (blockedItem) {
    return res.status(409).json({
      error: `${blockedItem.title || "This product"} is view-only in app and cannot be collected through checkout.`,
      product_id: blockedItem.product_id,
      in_app_action: "view_in_app",
    });
  }

  const finalizedItems = hydratedItems.filter(Boolean);
  const totalEth = Number(
    finalizedItems.reduce((sum, entry) => sum + Number(entry.line_total_eth || 0), 0).toFixed(6),
  );

  const order = {
    id: `order-${randomUUID().slice(0, 10)}`,
    collector_id: collectorId,
    status: "paid",
    payment_method: paymentMethod,
    total_eth: totalEth,
    items: finalizedItems,
    fulfillment: {
      status: paymentMethod === "onchain" ? "awaiting_mint" : "processing",
      delivery_modes: Array.from(new Set(finalizedItems.map((item) => item.delivery_mode || ""))).filter(Boolean),
    },
    created_at: nowIso(),
    gift_token: null,
  };

  if (paymentMethod === "onchain") {
    order.onchain = {
      chain: "base-sepolia",
      tx_hash: `0x${randomUUID().replace(/-/g, "")}`,
      status: "submitted",
    };
  } else {
    order.offchain = {
      provider: "offramp_partner",
      status: "confirmed",
    };
  }

  const giftRequested = Boolean(req.body?.gift && typeof req.body.gift === "object");
  let giftPayload = null;

  if (giftRequested) {
    const recipientLabel = String(req.body?.gift?.recipient_label || req.body?.gift?.recipient || "friend").trim();
    const giftToken = randomUUID().replace(/-/g, "");
    const claimUrl = `${req.protocol}://${req.get("host")}/gift/${giftToken}`;

    giftPayload = {
      id: `gift-${randomUUID().slice(0, 10)}`,
      token: giftToken,
      order_id: order.id,
      sender_collector_id: collectorId,
      recipient_label: recipientLabel || "friend",
      status: "pending",
      created_at: nowIso(),
      responded_at: null,
      recipient_collector_id: null,
      items: finalizedItems,
      claim_url: claimUrl,
    };
    order.gift_token = giftToken;
    db.gifts.push(giftPayload);
  } else {
    grantCollection(db, collectorId, order.id, finalizedItems);
  }

  db.orders.push(order);
  db.carts[collectorId] = [];
  writeDb(db);

  return res.status(201).json({
    order,
    gift: giftPayload
      ? {
          token: giftPayload.token,
          claim_url: giftPayload.claim_url,
          recipient_label: giftPayload.recipient_label,
          status: giftPayload.status,
        }
      : null,
  });
});

app.get("/fresh/gifts/:token", (req, res) => {
  const token = String(req.params.token || "").trim();
  const db = readDb();
  const gift = db.gifts.find((entry) => entry.token === token);
  if (!gift) return res.status(404).json({ error: "Gift not found" });

  const senderOrder = firstById(db.orders, gift.order_id);
  return res.json({
    token: gift.token,
    status: gift.status,
    recipient_label: gift.recipient_label,
    sender_collector_id: gift.sender_collector_id,
    created_at: gift.created_at,
    responded_at: gift.responded_at,
    items: gift.items,
    order_total_eth: senderOrder?.total_eth || 0,
  });
});

app.post("/fresh/gifts/:token/accept", (req, res) => {
  const collectorId = resolveCollectorId(req);
  const token = String(req.params.token || "").trim();
  const db = readDb();
  const gift = db.gifts.find((entry) => entry.token === token);
  if (!gift) return res.status(404).json({ error: "Gift not found" });
  if (gift.status !== "pending") {
    return res.status(409).json({ error: "Gift has already been processed" });
  }

  gift.status = "accepted";
  gift.responded_at = nowIso();
  gift.recipient_collector_id = collectorId;
  grantCollection(db, collectorId, gift.order_id, gift.items || []);
  writeDb(db);

  return res.json({ success: true, token: gift.token, status: gift.status });
});

app.post("/fresh/gifts/:token/reject", (_req, res) => {
  const token = String(_req.params.token || "").trim();
  const db = readDb();
  const gift = db.gifts.find((entry) => entry.token === token);
  if (!gift) return res.status(404).json({ error: "Gift not found" });
  if (gift.status !== "pending") {
    return res.status(409).json({ error: "Gift has already been processed" });
  }
  gift.status = "rejected";
  gift.responded_at = nowIso();
  writeDb(db);
  return res.json({ success: true, token: gift.token, status: gift.status });
});

app.get("/fresh/profile/:collectorId", (req, res) => {
  const collectorId = normalizeCollectorId(req.params.collectorId);
  if (!collectorId) return res.status(400).json({ error: "collectorId is required" });
  const db = readDb();
  return res.json(buildProfile(db, collectorId));
});

app.post("/fresh/share", (req, res) => {
  const postId = String(req.body?.post_id || "").trim();
  if (!postId) return res.status(400).json({ error: "post_id is required" });
  const shareUrl = `${req.protocol}://${req.get("host")}/share/${encodeURIComponent(postId)}`;
  return res.json({
    share_url: shareUrl,
    share_message: "Check this creator post on POPUP.",
    platform_urls: {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Check this creator post ${shareUrl}`)}`,
    },
  });
});

app.get("/share/:postId", (req, res) => {
  const postId = String(req.params.postId || "").trim();
  if (!postId) {
    return res.status(400).send("Invalid share link.");
  }

  const db = readDb();
  const post = firstById(db.posts, postId);
  if (!post) {
    return res.status(404).send("Share item not found.");
  }

  const collectorId = resolveCollectorId(req);
  const feedItem = buildFeedItem(db, collectorId, post);
  if (!feedItem) {
    return res.status(404).send("Share item unavailable.");
  }

  const host = req.get("host");
  const baseUrl = `${req.protocol}://${host}`;
  const shareUrl = `${baseUrl}/share/${encodeURIComponent(postId)}`;
  const redirectUrl = `${baseUrl}/discover?post=${encodeURIComponent(postId)}`;
  const title = escapeHtml(feedItem.title || "POPUP creator post");
  const description = escapeHtml(feedItem.description || "Discover this digital product on POPUP.");
  const image = escapeHtml(feedItem.image_url || `${baseUrl}/logo.png`);

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
  </head>
  <body>
    <p>Redirecting to POPUP discovery...</p>
    <a href="${escapeHtml(redirectUrl)}">Continue</a>
  </body>
</html>`);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found", path: _req.path, method: _req.method });
});

app.use((err, _req, res, _next) => {
  console.error("Fresh API error:", err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

export default app;
