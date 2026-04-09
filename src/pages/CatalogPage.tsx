import React, { useState, useEffect } from 'react';
import { Search, Filter, SortAsc } from 'lucide-react';
import { supabase } from '@/lib/db';
import CatalogGrid from '@/components/CatalogGrid';
import ItemDetailModal from '@/components/ItemDetailModal';
import { CatalogItem } from '@/utils/catalogUtils';

interface CatalogPageProps {
  defaultType?: 'drop' | 'product' | 'release' | 'all';
}

export function CatalogPage({ defaultType = 'all' }: CatalogPageProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
  const [filterTypes, setFilterTypes] = useState<('drop' | 'product' | 'release')[]>(
    defaultType === 'all' ? ['drop', 'product', 'release'] : [defaultType as any]
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch catalog items
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const limit = 50;
        const offset = (page - 1) * limit;

        let query = supabase
          .from('catalog_with_engagement')
          .select('*', { count: 'exact' });

        // Apply type filter
        if (filterTypes.length > 0 && filterTypes.length < 3) {
          query = query.in('item_type', filterTypes);
        }

        // Apply search
        if (searchQuery) {
          query = query.or(
            `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
          );
        }

        // Apply sort
        switch (sortBy) {
          case 'popular':
            query = query.order('comment_count', { ascending: false });
            break;
          case 'trending':
            query = query.order('updated_at', { ascending: false });
            break;
          case 'recent':
          default:
            query = query.order('created_at', { ascending: false });
        }

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        setItems(data || []);
        setTotalPages(Math.ceil((count || 0) / limit));
      } catch (error) {
        console.error('Failed to fetch catalog items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [page, searchQuery, sortBy, filterTypes]);

  const handleTypeToggle = (type: 'drop' | 'product' | 'release') => {
    setFilterTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  };

  const handleItemClick = (item: CatalogItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const handlePurchase = async (item: CatalogItem) => {
    try {
      // Determine purchase route based on item type
      const routes: Record<string, string> = {
        drop: `/drop/${item.id}`,
        product: `/product/${item.id}`,
        release: `/release/${item.id}`
      };

      window.location.href = routes[item.item_type] || '/';
    } catch (error) {
      console.error('Purchase error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Catalog</h1>
          <p className="text-gray-600">
            Discover NFTs, products, and creative projects
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex gap-4 flex-wrap">
            {/* Type Filters */}
            <div className="flex gap-2">
              {(['drop', 'product', 'release'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    filterTypes.includes(type)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'drop' && '🎨 NFT Drops'}
                  {type === 'product' && '📦 Products'}
                  {type === 'release' && '🎬 Releases'}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <SortAsc className="w-5 h-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="trending">Trending</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <p className="text-sm text-gray-600">
            Showing {items.length} items
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Catalog Grid */}
        <CatalogGrid
          items={items}
          loading={loading}
          onItemClick={handleItemClick}
          sortBy={sortBy}
          filterTypes={filterTypes}
          searchQuery={searchQuery}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && page > 3) {
                  pageNum = page - 2 + i;
                }
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-2 rounded-lg font-medium ${
                      page === pageNum
                        ? 'bg-primary text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      <ItemDetailModal
        isOpen={showModal}
        itemType={selectedItem?.item_type}
        itemId={selectedItem?.id}
        onClose={() => {
          setShowModal(false);
          setSelectedItem(null);
        }}
        onPurchase={handlePurchase}
      />
    </div>
  );
}

export default CatalogPage;
