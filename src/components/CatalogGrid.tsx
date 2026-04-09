import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  CatalogItem,
  formatPrice,
  formatSupply,
  getItemTypeIcon,
  sortCatalogItems,
  filterCatalogItems
} from '@/utils/catalogUtils';

interface CatalogGridProps {
  items: CatalogItem[];
  loading?: boolean;
  onItemClick?: (item: CatalogItem) => void;
  sortBy?: 'recent' | 'popular' | 'trending';
  filterTypes?: ('drop' | 'product' | 'release')[];
  searchQuery?: string;
}

export function CatalogGrid({
  items,
  loading = false,
  onItemClick,
  sortBy = 'recent',
  filterTypes = [],
  searchQuery = ''
}: CatalogGridProps) {
  const navigate = useNavigate();
  const [displayItems, setDisplayItems] = useState<CatalogItem[]>(items);

  useEffect(() => {
    let filtered = [...items];

    // Apply filters
    filtered = filterCatalogItems(filtered, {
      types: filterTypes.length > 0 ? filterTypes : undefined,
      searchQuery: searchQuery || undefined
    });

    // Apply sorting
    filtered = sortCatalogItems(filtered, sortBy);

    setDisplayItems(filtered);
  }, [items, sortBy, filterTypes, searchQuery]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">No items found</p>
        <p className="text-sm text-gray-400">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {displayItems.map((item) => (
        <CatalogCard
          key={`${item.item_type}-${item.id}`}
          item={item}
          onClick={() => {
            onItemClick?.(item);
            navigate(`/catalog/${item.item_type}/${item.id}`);
          }}
        />
      ))}
    </div>
  );
}

interface CatalogCardProps {
  item: CatalogItem;
  onClick?: () => void;
}

export function CatalogCard({ item, onClick }: CatalogCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {getItemTypeIcon(item.item_type)}
          </div>
        )}

        {/* Item Type Badge */}
        <div className="absolute top-2 right-2 bg-black/75 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <span>{getItemTypeIcon(item.item_type)}</span>
          <span className="capitalize">{item.item_type}</span>
        </div>

        {/* Availability Status */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
          <p className="text-white text-xs font-medium">
            {formatSupply(item.supply_or_stock)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-lg truncate mb-1 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Engagement Stats */}
        {(item.comment_count || item.avg_rating) && (
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
            {item.avg_rating > 0 && (
              <span className="flex items-center gap-1">
                ⭐ {item.avg_rating.toFixed(1)}
              </span>
            )}
            {item.comment_count > 0 && (
              <span>💬 {item.comment_count}</span>
            )}
          </div>
        )}

        {/* Price and Action */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="font-semibold text-primary">
            {formatPrice(item.price_eth)}
          </span>
          <button
            className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
              item.can_purchase
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!item.can_purchase}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            {item.can_purchase ? 'Get Now' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CatalogGrid;
