import { resolveMediaUrl } from "@/lib/pinata";

export type BuyerOrderProductRecord = {
  id?: string | null;
  name?: string | null;
  image_url?: string | null;
  image_ipfs_uri?: string | null;
  creator_wallet?: string | null;
};

export type BuyerOrderItemRecord = {
  id?: string;
  product_id?: string | null;
  quantity?: number | null;
  unit_price_eth?: number | string | null;
  line_total_eth?: number | string | null;
  fulfillment_type?: string | null;
  delivery_status?: string | null;
  products?: BuyerOrderProductRecord | BuyerOrderProductRecord[] | null;
};

export type BuyerOrderRecord = {
  id: string;
  product_id?: string | null;
  quantity?: number | null;
  total_price_eth?: number | string | null;
  status?: string | null;
  tracking_code?: string | null;
  shipping_address?: string | null;
  shipping_address_jsonb?: Record<string, unknown> | null;
  currency?: string | null;
  created_at?: string | null;
  order_items?: BuyerOrderItemRecord[] | null;
};

export type OrderDisplayItem = {
  id: string;
  name: string;
  image: string;
  quantity: number;
  lineTotalEth: number;
};

function firstRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapOrderStatus(status?: string | null): "processing" | "shipped" | "out_for_delivery" | "delivered" {
  if (status === "shipped") return "shipped";
  if (status === "delivered") return "delivered";
  if (status === "out_for_delivery") return "out_for_delivery";
  return "processing";
}

export function formatShippingAddress(
  shippingAddressJsonb?: Record<string, unknown> | null,
  legacyShippingAddress?: string | null
): string {
  if (!shippingAddressJsonb || typeof shippingAddressJsonb !== "object") {
    return legacyShippingAddress || "";
  }

  const fullAddress = typeof shippingAddressJsonb.full_address === "string"
    ? shippingAddressJsonb.full_address.trim()
    : "";

  if (fullAddress) return fullAddress;

  const parts = [
    shippingAddressJsonb.street,
    shippingAddressJsonb.city,
    shippingAddressJsonb.state,
    shippingAddressJsonb.postal_code,
    shippingAddressJsonb.country,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const phone = typeof shippingAddressJsonb.phone === "string" ? shippingAddressJsonb.phone.trim() : "";
  if (phone) parts.push(`Phone: ${phone}`);

  return parts.join(", ") || legacyShippingAddress || "";
}

export function mapBuyerOrderToDisplay(order: BuyerOrderRecord): {
  id: string;
  items: OrderDisplayItem[];
  totalEth: number;
  status: "processing" | "shipped" | "out_for_delivery" | "delivered";
  trackingCode: string;
  address: string;
  date: string;
  currency?: string;
} {
  const fallbackItems: BuyerOrderItemRecord[] = order.product_id
    ? [{
        product_id: order.product_id,
        quantity: order.quantity ?? 1,
        line_total_eth: order.total_price_eth ?? 0,
      }]
    : [];

  const sourceItems = order.order_items?.length ? order.order_items : fallbackItems;

  const items = sourceItems.map((item, index) => {
    const product = firstRecord(item.products);
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const unitPrice = toNumber(item.unit_price_eth, 0);
    const lineTotal = toNumber(item.line_total_eth, unitPrice * quantity);
    const name = product?.name?.trim() || `Item ${index + 1}`;

    return {
      id: item.product_id || product?.id || `${order.id}-${index}`,
      name,
      image: resolveMediaUrl(product?.image_url, product?.image_ipfs_uri),
      quantity,
      lineTotalEth: lineTotal,
    };
  });

  return {
    id: order.id,
    items,
    totalEth: toNumber(order.total_price_eth, items.reduce((sum, item) => sum + item.lineTotalEth, 0)),
    status: mapOrderStatus(order.status),
    trackingCode: order.tracking_code || "Pending",
    address: formatShippingAddress(order.shipping_address_jsonb, order.shipping_address),
    date: new Date(order.created_at || Date.now()).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    currency: order.currency || "ETH",
  };
}
