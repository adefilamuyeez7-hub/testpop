import { SECURE_API_BASE } from "@/lib/apiBase";

const API_BASE = SECURE_API_BASE || "/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `${response.status} ${response.statusText}`);
  }
  return payload as T;
}

export type FreshInAppAction = "collect_in_app" | "view_in_app" | string;

export type FreshFeedItem = {
  id: string;
  post_id: string;
  product_id: string;
  item_type: "product";
  title: string;
  description: string;
  image_url: string;
  price_eth: number;
  product_type: "digital_art" | "ebook" | "file" | "art" | "video" | "pdf" | "downloadable" | string;
  render_mode: "image" | "ebook" | "download" | "delivery" | "collect" | "video" | "pdf" | string;
  delivery_mode?: "render_online" | "download_mobile" | "collect_onchain" | "deliver_physical" | string;
  fulfillment_label?: string;
  in_app_action?: FreshInAppAction;
  in_app_action_label?: string;
  is_gated?: boolean;
  creator_id: string;
  creator_name: string;
  creator_wallet: string;
  creator_avatar_url?: string | null;
  like_count: number;
  comment_count: number;
  liked: boolean;
  created_at: string;
};

export type FreshComment = {
  id: string;
  post_id: string;
  collector_id: string;
  body: string;
  created_at: string;
};

export type FreshCartItem = {
  product_id: string;
  creator_id?: string;
  quantity: number;
  unit_price_eth: number;
  line_total_eth: number;
  title: string;
  image_url: string;
  product_type: "digital_art" | "ebook" | "file" | "art" | "video" | "pdf" | "downloadable" | string;
  render_mode: "image" | "ebook" | "download" | "delivery" | "collect" | "video" | "pdf" | string;
  delivery_mode?: "render_online" | "download_mobile" | "collect_onchain" | "deliver_physical" | string;
  fulfillment_label?: string;
  in_app_action?: FreshInAppAction;
  in_app_action_label?: string;
  readable_url: string | null;
  download_url: string | null;
  is_gated?: boolean;
  creator_name: string;
  creator_handle: string;
};

export type FreshCart = {
  collector_id: string;
  items: FreshCartItem[];
  total_eth: number;
};

export type FreshOrder = {
  id: string;
  status: string;
  payment_method: "onchain" | "offramp_partner";
  total_eth: number;
  created_at: string;
  items: Array<{
    product_id: string;
    creator_id?: string;
    quantity: number;
    unit_price_eth: number;
    line_total_eth: number;
    title: string;
    image_url: string;
    product_type: "digital_art" | "ebook" | "file" | "art" | "video" | "pdf" | "downloadable" | string;
    render_mode: "image" | "ebook" | "download" | "delivery" | "collect" | "video" | "pdf" | string;
    delivery_mode?: "render_online" | "download_mobile" | "collect_onchain" | "deliver_physical" | string;
    fulfillment_label?: string;
    in_app_action?: FreshInAppAction;
    in_app_action_label?: string;
    readable_url: string | null;
    download_url: string | null;
    is_gated?: boolean;
  }>;
  gift_token?: string | null;
  fulfillment?: {
    status: string;
    delivery_modes: string[];
  } | null;
  onchain?: {
    chain: string;
    tx_hash: string;
    status: string;
  } | null;
  offchain?: {
    provider: string;
    status: string;
  } | null;
};

export type FreshProduct = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  image_url: string;
  price_eth: number;
  product_type: "digital_art" | "ebook" | "file" | "art" | "video" | "pdf" | "downloadable" | string;
  render_mode: "image" | "ebook" | "download" | "delivery" | "collect" | "video" | "pdf" | string;
  delivery_mode?: "render_online" | "download_mobile" | "collect_onchain" | "deliver_physical" | string;
  fulfillment_label?: string;
  in_app_action?: FreshInAppAction;
  in_app_action_label?: string;
  readable_url: string | null;
  download_url: string | null;
  is_gated?: boolean;
  owned?: boolean;
  creator_name: string;
  creator_handle: string;
  creator_avatar_url?: string | null;
  onchain?: {
    chain: string;
    contract_address?: string;
  } | null;
};

export type FreshProfile = {
  collector_id: string;
  collection: Array<{
    id: string;
    product_id: string;
    title: string;
    image_url: string;
    product_type: "digital_art" | "ebook" | "file" | "art" | "video" | "pdf" | "downloadable" | string;
    render_mode: "image" | "ebook" | "download" | "delivery" | "collect" | "video" | "pdf" | string;
    delivery_mode?: "render_online" | "download_mobile" | "collect_onchain" | "deliver_physical" | string;
    fulfillment_label?: string;
    in_app_action?: FreshInAppAction;
    in_app_action_label?: string;
    readable_url: string | null;
    download_url: string | null;
    is_gated?: boolean;
    owned?: boolean;
    creator_name: string;
    acquired_at: string;
  }>;
  poaps: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    created_at: string;
  }>;
  subscriptions: Array<{
    id: string;
    creator_id: string;
    status: string;
    created_at: string;
  }>;
  cart: FreshCart;
  orders: FreshOrder[];
  pending_gifts: Array<{
    token: string;
    sender_collector_id: string;
    recipient_label: string;
    created_at: string;
    items: FreshOrder["items"];
    claim_url: string;
  }>;
  creator_dashboard_path: string;
};

export type FreshCreatorProfile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  wallet: string;
  profile_image: string;
  banner_image: string;
  featured_portfolio: Array<{
    id: string;
    title: string;
    asset_url: string;
    asset_type: string;
    created_at: string;
    ipfs?: {
      cid: string;
      ipfs_url: string;
      gateway_url: string;
      is_mock?: boolean;
    } | null;
  }>;
  products: FreshProduct[];
  stats: {
    total_products: number;
    total_sales: number;
    total_revenue_eth: number;
  };
};

export type FreshPin = {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
  cid: string;
  ipfs_url: string;
  gateway_url: string;
  is_mock?: boolean;
  created_at: string;
};

export type FreshGift = {
  token: string;
  status: "pending" | "accepted" | "rejected";
  recipient_label: string;
  sender_collector_id: string;
  created_at: string;
  responded_at?: string | null;
  items: FreshOrder["items"];
  order_total_eth: number;
};

export async function fetchFreshHome(collectorId: string) {
  return requestJson<{ collector_id: string; featured: FreshFeedItem[] }>(
    `/fresh/home?collector_id=${encodeURIComponent(collectorId)}`,
  );
}

export async function fetchFreshDiscover(collectorId: string) {
  return requestJson<{ collector_id: string; feed: FreshFeedItem[] }>(
    `/fresh/discover?collector_id=${encodeURIComponent(collectorId)}`,
  );
}

export async function toggleFreshLike(postId: string, collectorId: string) {
  return requestJson<{ post_id: string; liked: boolean; like_count: number }>(
    `/fresh/discover/${encodeURIComponent(postId)}/like`,
    {
      method: "POST",
      body: JSON.stringify({ collector_id: collectorId }),
    },
  );
}

export async function fetchFreshComments(postId: string) {
  return requestJson<{ post_id: string; comments: FreshComment[] }>(
    `/fresh/discover/${encodeURIComponent(postId)}/comments`,
  );
}

export async function fetchFreshProduct(productId: string, collectorId?: string) {
  const query = collectorId ? `?collector_id=${encodeURIComponent(collectorId)}` : "";
  return requestJson<FreshProduct>(`/fresh/products/${encodeURIComponent(productId)}${query}`);
}

export async function postFreshComment(postId: string, collectorId: string, body: string) {
  return requestJson<{ comment: FreshComment }>(
    `/fresh/discover/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({
        collector_id: collectorId,
        body,
      }),
    },
  );
}

export async function addFreshCartItem(collectorId: string, productId: string, quantity = 1) {
  return requestJson<FreshCart>("/fresh/cart/add", {
    method: "POST",
    body: JSON.stringify({
      collector_id: collectorId,
      product_id: productId,
      quantity,
    }),
  });
}

export async function fetchFreshCart(collectorId: string) {
  return requestJson<FreshCart>(`/fresh/cart/${encodeURIComponent(collectorId)}`);
}

export async function updateFreshCartItem(collectorId: string, productId: string, quantity: number) {
  return requestJson<FreshCart>(`/fresh/cart/${encodeURIComponent(collectorId)}/items/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export async function removeFreshCartItem(collectorId: string, productId: string) {
  return requestJson<FreshCart>(`/fresh/cart/${encodeURIComponent(collectorId)}/items/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

export async function checkoutFresh(options: {
  collectorId: string;
  paymentMethod: "onchain" | "offramp_partner";
  items?: Array<{ product_id: string; quantity: number }>;
  gift?: { recipient_label: string };
}) {
  return requestJson<{
    order: FreshOrder;
    gift: null | {
      token: string;
      claim_url: string;
      recipient_label: string;
      status: string;
    };
  }>("/fresh/checkout", {
    method: "POST",
    body: JSON.stringify({
      collector_id: options.collectorId,
      payment_method: options.paymentMethod,
      items: options.items,
      gift: options.gift || null,
    }),
  });
}

export async function fetchFreshProfile(collectorId: string) {
  return requestJson<FreshProfile>(`/fresh/profile/${encodeURIComponent(collectorId)}`);
}

export async function fetchFreshGift(token: string) {
  return requestJson<FreshGift>(`/fresh/gifts/${encodeURIComponent(token)}`);
}

export async function acceptFreshGift(token: string, collectorId: string) {
  return requestJson<{ success: boolean; token: string; status: string }>(
    `/fresh/gifts/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
      body: JSON.stringify({ collector_id: collectorId }),
    },
  );
}

export async function rejectFreshGift(token: string) {
  return requestJson<{ success: boolean; token: string; status: string }>(
    `/fresh/gifts/${encodeURIComponent(token)}/reject`,
    {
      method: "POST",
    },
  );
}

export async function createFreshShare(postId: string) {
  return requestJson<{
    share_url: string;
    share_message: string;
    platform_urls: Record<string, string>;
  }>("/fresh/share", {
    method: "POST",
    body: JSON.stringify({ post_id: postId }),
  });
}

export async function fetchFreshCreator(creatorId: string) {
  return requestJson<FreshCreatorProfile>(`/fresh/creator/${encodeURIComponent(creatorId)}`);
}

export async function fetchFreshCreatorPortfolio(creatorId: string) {
  return requestJson<{ creator_id: string; portfolio: FreshCreatorProfile["featured_portfolio"] }>(
    `/fresh/creator/${encodeURIComponent(creatorId)}/portfolio`,
  );
}

export async function addFreshCreatorPortfolioItem(creatorId: string, payload: {
  title: string;
  asset_url?: string;
  asset_type?: string;
  pin_to_ipfs?: boolean;
  metadata?: Record<string, unknown>;
}) {
  return requestJson<FreshCreatorProfile["featured_portfolio"][number]>(
    `/fresh/creator/${encodeURIComponent(creatorId)}/portfolio`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function pinFreshMetadata(name: string, metadata: Record<string, unknown>) {
  return requestJson<FreshPin>("/fresh/pinata/metadata", {
    method: "POST",
    body: JSON.stringify({ name, metadata }),
  });
}

export async function fetchFreshAdminOverview() {
  return requestJson<{
    creators: number;
    products: number;
    orders: number;
    gifts: number;
    pending_gifts: number;
    applications_review: number;
  }>("/fresh/admin/overview");
}

export async function fetchFreshAdminCreators() {
  return requestJson<{ creators: FreshCreatorProfile[] }>("/fresh/admin/creators");
}

export async function fetchFreshAdminOrders() {
  return requestJson<{ orders: FreshOrder[] }>("/fresh/admin/orders");
}

export async function fetchFreshAdminGifts() {
  return requestJson<{ gifts: FreshGift[] }>("/fresh/admin/gifts");
}
