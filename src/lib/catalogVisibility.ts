const normalizeCatalogStatus = (status?: string | null) => status?.trim().toLowerCase() || "";

export const PUBLIC_PRODUCT_STATUSES = ["published", "active"] as const;
export const LIVE_DROP_STATUSES = ["live", "active", "published"] as const;

export function isPublicProductStatus(status?: string | null) {
  const normalizedStatus = normalizeCatalogStatus(status);
  return PUBLIC_PRODUCT_STATUSES.includes(
    normalizedStatus as (typeof PUBLIC_PRODUCT_STATUSES)[number]
  );
}

export function normalizePublicDropStatus(status?: string | null) {
  const normalizedStatus = normalizeCatalogStatus(status);

  if (
    LIVE_DROP_STATUSES.includes(
      normalizedStatus as (typeof LIVE_DROP_STATUSES)[number]
    )
  ) {
    return "live";
  }

  if (
    normalizedStatus === "draft" ||
    normalizedStatus === "upcoming" ||
    normalizedStatus === "pending"
  ) {
    return "draft";
  }

  return "ended";
}

export function toAdminProductStatus(
  status?: string | null
): "active" | "draft" | "out_of_stock" {
  if (isPublicProductStatus(status)) {
    return "active";
  }

  return status === "out_of_stock" ? "out_of_stock" : "draft";
}
