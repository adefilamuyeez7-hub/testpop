export type RebootCatalogItemType = "drop" | "product" | "release";

export type RebootUserType = "guest_collector" | "creator" | "admin" | "external_guest";
export type RebootCreatorContentType = "digital_product" | "physical_product";
export type RebootCampaignMode = "drop" | "auction" | "bid_campaign";

export const REBOOT_USER_FLOW = [
  {
    id: "guest_collector",
    title: "Guest Collector",
    summary: "Buy without forced KYC using wallet connect or social connect.",
    route: "/discover",
    capabilities: [
      "Collect digital products onchain",
      "Checkout physical products via partner flow",
      "Gift and share products externally",
    ],
  },
  {
    id: "creator",
    title: "Creator",
    summary: "Admin-whitelisted creator path for digital and physical launches.",
    route: "/studio",
    capabilities: [
      "Publish digital products and physical products",
      "Launch drop, auction, and bid campaign forms",
      "Upload portfolio and mint tokenized creator card",
    ],
  },
  {
    id: "admin",
    title: "Admin",
    summary: "Control creator approvals, role guardrails, and platform controls.",
    route: "/admin",
    capabilities: [
      "Creator whitelist and moderation",
      "Campaign safety and feature control",
      "Platform health and operations tooling",
    ],
  },
  {
    id: "external_guest",
    title: "External Guest",
    summary: "Collect from embeddable cards outside POPUP.",
    route: "/share/drop/sample",
    capabilities: [
      "Open product cards from external channels",
      "Run checkout from share-compatible cards",
      "Complete digital purchase from outside the app",
    ],
  },
] as const satisfies ReadonlyArray<{
  id: RebootUserType;
  title: string;
  summary: string;
  route: string;
  capabilities: readonly string[];
}>;

export const REBOOT_CREATOR_CONTENT_TYPES = [
  {
    id: "digital_product",
    title: "Digital Product",
    description: "Art, ebooks, and downloadable files.",
  },
  {
    id: "physical_product",
    title: "Physical Product",
    description: "Merch and shipped deliverables linked to creator campaigns.",
  },
] as const satisfies ReadonlyArray<{
  id: RebootCreatorContentType;
  title: string;
  description: string;
}>;

export const REBOOT_CAMPAIGN_MODES = [
  {
    id: "drop",
    title: "Drop",
    description: "Instant buy via onchain collect or partner checkout.",
  },
  {
    id: "auction",
    title: "Auction",
    description: "Onchain bidding with timed winner settlement.",
  },
  {
    id: "bid_campaign",
    title: "Bid Campaign",
    description: "Collectors bid using ETH or content submission.",
  },
] as const satisfies ReadonlyArray<{
  id: RebootCampaignMode;
  title: string;
  description: string;
}>;

export type RebootCatalogItem = {
  id: string;
  item_type: RebootCatalogItemType;
  title: string;
  description?: string | null;
  image_url?: string | null;
  price_eth?: number | string | null;
  supply_or_stock?: number | null;
  creator_id?: string | null;
  creator_wallet?: string | null;
  can_purchase?: boolean;
  can_bid?: boolean;
  contract_kind?: string | null;
  product_type?: string | null;
  source_kind?: string | null;
  comment_count?: number;
  created_at?: string;
};

type CatalogResponse = {
  data?: RebootCatalogItem[];
};

type CatalogDetailResponse = {
  item?: RebootCatalogItem | null;
  checkout_product?: {
    id?: string | null;
    product_type?: string | null;
    contract_kind?: string | null;
  } | null;
};

type ShareCreateResponse = {
  share_url?: string;
  share_message?: string;
  platform_urls?: Record<string, string>;
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function fetchRebootCatalog(limit = 18): Promise<RebootCatalogItem[]> {
  const response = await fetch(`/api/catalog?limit=${Math.max(1, limit)}&sort=recent`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to load catalog");
  }

  const payload = (await response.json()) as CatalogResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

export type RebootBuyIntent = "collect" | "checkout" | "details";

export async function resolveRebootBuyIntent(item: RebootCatalogItem): Promise<RebootBuyIntent> {
  if (!item?.id || !item?.item_type) return "details";

  if (!item.can_purchase) {
    return "details";
  }

  if (item.item_type === "product" || item.item_type === "release") {
    return "checkout";
  }

  if (item.can_bid) {
    return "details";
  }

  const contractKind = normalize(item.contract_kind);
  const sourceKind = normalize(item.source_kind);
  const productType = normalize(item.product_type);

  if (
    contractKind === "creativereleaseescrow" ||
    contractKind === "productstore" ||
    sourceKind === "release_product" ||
    sourceKind === "catalog_product" ||
    productType === "physical" ||
    productType === "hybrid"
  ) {
    return "checkout";
  }

  try {
    const response = await fetch(`/api/catalog/${item.item_type}/${item.id}`);
    if (response.ok) {
      const payload = (await response.json()) as CatalogDetailResponse;
      const checkoutProduct = payload.checkout_product;
      const checkoutType = normalize(checkoutProduct?.product_type);
      const checkoutContractKind = normalize(checkoutProduct?.contract_kind);

      if (
        checkoutProduct?.id &&
        (
          checkoutType === "physical" ||
          checkoutType === "hybrid" ||
          checkoutContractKind === "productstore" ||
          checkoutContractKind === "creativereleaseescrow"
        )
      ) {
        return "checkout";
      }
    }
  } catch {
    // Keep optimistic default if detail enrichment call fails.
  }

  return "collect";
}

export async function createRebootShare(item: RebootCatalogItem, sharePlatform = "copy"): Promise<ShareCreateResponse> {
  const response = await fetch("/api/personalization/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: item.id,
      item_type: item.item_type,
      share_platform: sharePlatform,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to create share link");
  }

  return (await response.json()) as ShareCreateResponse;
}

export function buildRebootShareUrl(item: Pick<RebootCatalogItem, "id" | "item_type">, intent: RebootBuyIntent = "details") {
  const params = new URLSearchParams();
  if (intent === "checkout" || intent === "collect") {
    params.set("intent", intent);
    params.set("auto", "1");
    params.set("from", "discover");
  }

  const suffix = params.toString();
  return `/share/${item.item_type}/${item.id}${suffix ? `?${suffix}` : ""}`;
}
