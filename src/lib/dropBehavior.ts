export type DropInteractionMode =
  | "collect"
  | "checkout"
  | "campaign"
  | "auction"
  | "unsupported";

type DropBehaviorInput = {
  type: "drop" | "auction" | "campaign";
  contractKind?: "artDrop" | "poapCampaign" | "poapCampaignV2" | "creativeReleaseEscrow" | "productStore" | null;
  contractDropId?: number | null;
  metadata?: Record<string, unknown> | null;
};

type LinkedProductBehaviorInput = {
  id?: string | null;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | null;
  contract_listing_id?: number | null;
  contract_product_id?: number | null;
};

type LinkedReleaseBehaviorInput = {
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | null;
  contract_listing_id?: number | null;
  contract_drop_id?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolvedDropBehavior = {
  mode: DropInteractionMode;
  isReleaseBacked: boolean;
  isOnchainReady: boolean;
};

function hasPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function readPositiveNumber(value: unknown) {
  if (hasPositiveNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return hasPositiveNumber(parsed) ? parsed : null;
  }

  return null;
}

function readMetadataNumber(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = readPositiveNumber(metadata?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function resolveDropBehavior(params: {
  drop: DropBehaviorInput;
  linkedProduct?: LinkedProductBehaviorInput | null;
  linkedRelease?: LinkedReleaseBehaviorInput | null;
  sourceKind?: string | null;
}): ResolvedDropBehavior {
  const { drop, linkedProduct, linkedRelease, sourceKind } = params;
  const inferredContractKind =
    linkedProduct?.contract_kind || linkedRelease?.contract_kind || drop.contractKind || null;
  const isReleaseBacked =
    sourceKind === "release_product" ||
    sourceKind === "catalog_product" ||
    inferredContractKind === "creativeReleaseEscrow" ||
    inferredContractKind === "productStore" ||
    Boolean(linkedProduct?.id);

  if (drop.type === "campaign") {
    return {
      mode: "campaign",
      isReleaseBacked,
      isOnchainReady: true,
    };
  }

  if (drop.type === "auction" && drop.contractKind === "poapCampaign") {
    return {
      mode: "auction",
      isReleaseBacked: false,
      isOnchainReady: true,
    };
  }

  if (isReleaseBacked) {
    const releaseListingId =
      readPositiveNumber(linkedProduct?.contract_listing_id) ??
      readPositiveNumber(linkedRelease?.contract_listing_id) ??
      readPositiveNumber(drop.contractDropId) ??
      readMetadataNumber(linkedProduct?.["metadata"] as Record<string, unknown> | null | undefined, "contract_listing_id") ??
      readMetadataNumber(linkedRelease?.metadata, "contract_listing_id") ??
      readMetadataNumber(drop.metadata, "contract_listing_id");
    const productListingId =
      readPositiveNumber(linkedProduct?.contract_product_id) ??
      readMetadataNumber(linkedProduct?.["metadata"] as Record<string, unknown> | null | undefined, "contract_product_id") ??
      readMetadataNumber(drop.metadata, "contract_product_id");
    const isOnchainReady =
      inferredContractKind === "creativeReleaseEscrow"
        ? releaseListingId !== null
        : productListingId !== null;

    return {
      mode: "checkout",
      isReleaseBacked: true,
      isOnchainReady,
    };
  }

  if (drop.type === "drop" && drop.contractKind === "artDrop") {
    return {
      mode: "collect",
      isReleaseBacked: false,
      isOnchainReady: true,
    };
  }

  return {
    mode: "unsupported",
    isReleaseBacked,
    isOnchainReady: false,
  };
}
