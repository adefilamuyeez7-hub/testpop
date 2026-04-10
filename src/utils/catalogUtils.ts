/**
 * Catalog Utilities
 * Centralized asset type detection, formatting, and helpers
 * Replaces scattered implementations across 4 files
 */

export type ItemType = 'drop' | 'product' | 'release';
export type CanPurchaseType = 'drop' | 'product' | 'release' | 'campaign';

export interface CatalogItem {
  id: string;
  item_type: ItemType;
  title: string;
  description?: string;
  image_url?: string;
  price_eth?: number;
  supply_or_stock?: number;
  can_purchase: boolean;
  can_bid: boolean;
  can_participate_campaign: boolean;
  creator_id: string;
  creator_wallet: string;
  product_type?: "digital" | "physical" | "hybrid" | string | null;
  contract_kind?: "artDrop" | "productStore" | "creativeReleaseEscrow" | string | null;
  contract_listing_id?: number | null;
  contract_product_id?: number | null;
  creative_release_id?: string | null;
  comment_count?: number;
  avg_rating?: number;
  created_at: string;
}

export type CatalogPrimaryAction = "bid" | "cart" | "collect" | "details";

export function getCatalogPrimaryAction(
  item: Pick<CatalogItem, "item_type" | "can_bid" | "can_purchase" | "contract_kind" | "product_type">
): CatalogPrimaryAction {
  const normalizedContractKind = String(item.contract_kind || "").trim().toLowerCase();
  const normalizedProductType = String(item.product_type || "").trim().toLowerCase();

  if (item.item_type === "drop" && item.can_bid) {
    return "bid";
  }

  if (!item.can_purchase) {
    return "details";
  }

  if (item.item_type === "product") {
    if (normalizedProductType === "digital" || normalizedContractKind === "artdrop") {
      return "collect";
    }

    return "cart";
  }

  if (item.item_type === "release") {
    if (normalizedContractKind === "artdrop") {
      return "collect";
    }

    return "cart";
  }

  if (
    item.item_type === "drop" &&
    (normalizedContractKind === "creativereleaseescrow" || normalizedContractKind === "productstore")
  ) {
    return "cart";
  }

  return "collect";
}

/**
 * Detect item type from object structure (legacy fallback)
 */
export function detectItemType(item: any): ItemType {
  // If explicitly marked, use that
  if (item.item_type) return item.item_type;

  // Heuristic detection
  if (item.artist_id && item.supply !== undefined && !item.contract_address) {
    return 'product';
  }
  if (item.artist_id && item.contract_address) {
    return 'drop';
  }
  if (item.campaign_id || item.artist_id && item.title && !item.creator_id) {
    return 'release';
  }

  // Default
  return 'product';
}

/**
 * Get readable name for item type
 */
export function getItemTypeName(type: ItemType): string {
  const names: Record<ItemType, string> = {
    drop: 'NFT Drop',
    product: 'Product',
    release: 'Creative Release'
  };
  return names[type] || type;
}

/**
 * Get icon for item type
 */
export function getItemTypeIcon(type: ItemType): string {
  const icons: Record<ItemType, string> = {
    drop: '🎨',
    product: '📦',
    release: '🎬'
  };
  return icons[type];
}

/**
 * Format price with currency handling
 */
export function formatPrice(priceEth?: number): string {
  if (!priceEth) return 'Free';
  return `Ξ${priceEth.toFixed(4)}`;
}

/**
 * Format supply/stock display
 */
export function formatSupply(supply?: number): string {
  if (supply === null || supply === undefined) return 'Unlimited';
  if (supply === 0) return 'Sold Out';
  if (supply === 1) return '1 Available';
  return `${supply} Available`;
}

/**
 * Get purchase button text based on item type and status
 */
export function getPurchaseButtonText(
  item: CatalogItem,
  userOwnsItem: boolean = false
): string {
  if (userOwnsItem) return 'View Ownership';
  if (!item.can_purchase) return 'Unavailable';

  switch (item.item_type) {
    case 'drop':
      return 'Mint Now';
    case 'product':
      return 'Buy Now';
    case 'release':
      if (item.can_bid) return 'Place Bid';
      return 'Fund Now';
    default:
      return 'Purchase';
  }
}

/**
 * Get action buttons for item detail view
 */
export function getItemActions(item: CatalogItem) {
  const actions = [];

  if (item.can_purchase) {
    actions.push({
      type: 'primary',
      action: getPurchaseButtonText(item),
      handler: 'purchase'
    });
  }

  if (item.can_bid) {
    actions.push({
      type: 'secondary',
      action: 'Place Bid',
      handler: 'bid'
    });
  }

  if (item.can_participate_campaign) {
    actions.push({
      type: 'secondary',
      action: 'Participate',
      handler: 'participate'
    });
  }

  actions.push({
    type: 'tertiary',
    action: 'Comment',
    handler: 'comment'
  });

  return actions;
}

/**
 * Convert legacy item to unified CatalogItem format
 */
export function normalizeItem(item: any): CatalogItem {
  const type = detectItemType(item);

  return {
    id: item.id,
    item_type: type,
    title: item.title || item.name || '',
    description: item.description || '',
    image_url: item.image_url || item.metadata?.image_url || '',
    price_eth: item.price_eth || 0,
    supply_or_stock: item.supply_or_stock || item.supply || item.stock || 0,
    can_purchase: item.can_purchase ?? false,
    can_bid: item.can_bid ?? false,
    can_participate_campaign: item.can_participate_campaign ?? false,
    creator_id: item.creator_id || item.artist_id || '',
    creator_wallet: item.creator_wallet || item.artist_wallet || '',
    comment_count: item.comment_count || 0,
    avg_rating: item.avg_rating || 0,
    created_at: item.created_at || new Date().toISOString()
  };
}

/**
 * Sort items by multiple criteria
 */
export function sortCatalogItems(
  items: CatalogItem[],
  sortBy: 'recent' | 'popular' | 'trending' = 'recent'
): CatalogItem[] {
  const sorted = [...items];

  switch (sortBy) {
    case 'popular':
      sorted.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
      break;
    case 'trending':
      // Sort by recent creation + rating
      sorted.sort((a, b) => {
        const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0);
        if (Math.abs(ratingDiff) > 0.5) return ratingDiff;
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });
      break;
    case 'recent':
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }

  return sorted;
}

/**
 * Filter items by type and criteria
 */
export function filterCatalogItems(
  items: CatalogItem[],
  filters: {
    types?: ItemType[];
    creators?: string[];
    minPrice?: number;
    maxPrice?: number;
    hasRemaining?: boolean;
    searchQuery?: string;
  }
): CatalogItem[] {
  return items.filter((item) => {
    // Filter by type
    if (filters.types?.length && !filters.types.includes(item.item_type)) {
      return false;
    }

    // Filter by creator
    if (filters.creators?.length && !filters.creators.includes(item.creator_id)) {
      return false;
    }

    // Filter by price
    if (filters.minPrice && (item.price_eth || 0) < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice && (item.price_eth || 0) > filters.maxPrice) {
      return false;
    }

    // Filter by availability
    if (filters.hasRemaining && !item.can_purchase) {
      return false;
    }

    // Search query (title + description)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matches =
        item.title.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query);
      if (!matches) return false;
    }

    return true;
  });
}

/**
 * Group items by type
 */
export function groupItemsByType(items: CatalogItem[]): Record<ItemType, CatalogItem[]> {
  return {
    drop: items.filter((i) => i.item_type === 'drop'),
    product: items.filter((i) => i.item_type === 'product'),
    release: items.filter((i) => i.item_type === 'release')
  };
}

/**
 * Calculate engagement score for sorting/recommendations
 */
export function calculateEngagementScore(item: CatalogItem): number {
  const ratingScore = (item.avg_rating || 0) * 20; // 0-100
  const commentScore = Math.min((item.comment_count || 0) * 5, 100); // 0-100
  const recencyScore = Math.max(
    50 - Math.floor((Date.now() - new Date(item.created_at).getTime()) / (86400000 * 7)), // Decreases over 7 days
    0
  );

  return (ratingScore + commentScore + recencyScore) / 3;
}
