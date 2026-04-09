import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  ShoppingCart,
  Gavel,
  User,
  MoreHorizontal,
  Filter,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/db';
import { CatalogItem, formatPrice } from '@/utils/catalogUtils';
import {
  SocialShareButton,
  FavoritesButton,
  SubscribeButton
} from '@/components/PersonalizationComponents';

interface DiscoverPost extends CatalogItem {
  item_type: 'drop' | 'product' | 'release';
  creator_wallet?: string;
  creator_name?: string;
  is_liked?: boolean;
  like_count?: number;
  is_verified?: boolean;
}

export function UnifiedDiscoverFeed() {
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'drop' | 'product' | 'release'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<DiscoverPost | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Load posts from all sources unified
  useEffect(() => {
    const loadPosts = async () => {
      if (!hasMore || loading) return;

      setLoading(true);
      try {
        let query = supabase
          .from('catalog_with_engagement')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });

        // Apply filters
        if (filterType !== 'all') {
          query = query.eq('item_type', filterType);
        }

        if (searchQuery.trim()) {
          query = query.or(
            `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,tags.cs.{"${searchQuery}"}`
          );
        }

        const { data, error, count } = await query.range(
          (page - 1) * 10,
          page * 10 - 1
        );

        if (error) throw error;

        setPosts((prev) => [...prev, ...(data || [])]);
        setHasMore((data?.length || 0) >= 10);
      } catch (error) {
        console.error('Failed to load posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [page, filterType, searchQuery]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  // Reset pagination when filters change
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
  }, [filterType, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header with Search & Filter */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Discover</h1>
            <p className="text-gray-600 text-sm mt-1">
              Explore drops, products, and creative releases
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, artist, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: 'all' as const, label: 'All Items', icon: '✨' },
              { value: 'drop' as const, label: 'Limited Drops', icon: '🎨' },
              { value: 'product' as const, label: 'Products', icon: '📦' },
              { value: 'release' as const, label: 'Releases', icon: '🎬' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                  filterType === filter.value
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.icon} {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {posts.map((post, idx) => (
            <DiscoverCard
              key={`${post.id}-${idx}`}
              post={post}
              onComment={() => {
                setSelectedPost(post);
                setShowComments(true);
              }}
              onDetails={() => {
                setSelectedPost(post);
                setShowDetails(true);
              }}
            />
          ))}
        </div>

        {/* Loading indicator */}
        <div ref={observerTarget} className="p-4 text-center">
          {loading && <p className="text-gray-400">Loading more items...</p>}
          {!hasMore && posts.length > 0 && (
            <p className="text-gray-400">No more items to load</p>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedPost && (
        <DetailsModal
          post={selectedPost}
          onClose={() => setShowDetails(false)}
        />
      )}

      {/* Comments Sheet */}
      {showComments && selectedPost && (
        <CommentsSheet
          post={selectedPost}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

interface DiscoverCardProps {
  post: DiscoverPost;
  onComment: () => void;
  onDetails: () => void;
}

function DiscoverCard({ post, onComment, onDetails }: DiscoverCardProps) {
  const getTypeColor = () => {
    switch (post.item_type) {
      case 'drop':
        return 'bg-purple-100 text-purple-700';
      case 'product':
        return 'bg-blue-100 text-blue-700';
      case 'release':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = () => {
    switch (post.item_type) {
      case 'drop':
        return '🎨';
      case 'product':
        return '📦';
      case 'release':
        return '🎬';
      default:
        return '✨';
    }
  };

  const getTypeLabel = () => {
    switch (post.item_type) {
      case 'drop':
        return 'Limited Drop';
      case 'product':
        return 'Product';
      case 'release':
        return 'Release';
      default:
        return 'Item';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image Section */}
      <div className="relative bg-gray-900 aspect-video overflow-hidden cursor-pointer group" onClick={onDetails}>
        {post.image_url && (
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
          <div className="p-4 w-full text-white">
            <p className="font-semibold">Tap to view details</p>
          </div>
        </div>

        {/* Type Badge */}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor()}`}>
          {getTypeIcon()} {getTypeLabel()}
        </div>

        {/* Creator Avatar */}
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white">
          <span className="text-white text-sm font-bold">
            {post.creator_wallet?.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Title & Meta */}
        <div>
          <h3 className="text-lg font-bold line-clamp-2 mb-2">{post.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{post.description}</p>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {post.creator_wallet?.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{post.creator_wallet?.slice(0, 10)}...</p>
          </div>
          <SubscribeButton
            creator_id={post.creator_wallet}
            creator_wallet={post.creator_wallet}
            className="text-xs py-1 px-3"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>👁️ {post.view_count || 0} views</span>
          <span>❤️ {post.comment_count || 0} likes</span>
          <span>💬 {post.comment_count || 0} comments</span>
        </div>

        {/* Price & Rating */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Price</p>
            <p className="text-xl font-bold">{formatPrice(post.price_eth)}</p>
          </div>
          {post.avg_rating && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Rating</p>
              <p className="text-xl font-bold">
                {post.avg_rating.toFixed(1)} <span className="text-base">⭐</span>
              </p>
            </div>
          )}
        </div>

        {/* Call-to-Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {post.item_type === 'drop' ? (
            <>
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
                <Gavel className="w-4 h-4" />
                Place Bid
              </button>
              <FavoritesButton item={post} />
            </>
          ) : (
            <>
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
              <FavoritesButton item={post} />
            </>
          )}
        </div>

        {/* Engagement Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onComment}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Comment
          </button>
          <SocialShareButton item={post} />
        </div>
      </div>
    </div>
  );
}

interface DetailsModalProps {
  post: DiscoverPost;
  onClose: () => void;
}

function DetailsModal({ post, onClose }: DetailsModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{post.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          {/* Type & Creator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                {post.item_type === 'drop' ? '🎨' : post.item_type === 'product' ? '📦' : '🎬'}{' '}
                {post.item_type.charAt(0).toUpperCase() + post.item_type.slice(1)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Creator</p>
              <p className="font-semibold">{post.creator_wallet?.slice(0, 12)}...</p>
            </div>
          </div>

          {/* Description */}
          {post.description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-gray-700 leading-relaxed">{post.description}</p>
            </div>
          )}

          {/* Pricing & Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-gray-600">Price</p>
              <p className="text-lg font-bold">{formatPrice(post.price_eth)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Views</p>
              <p className="text-lg font-bold">{post.view_count || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Rating</p>
              <p className="text-lg font-bold">
                {post.avg_rating?.toFixed(1) || 'N/A'} ⭐
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {post.item_type === 'drop' ? (
              <>
                <button className="py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
                  Place Bid
                </button>
                <button className="py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                  Watch
                </button>
              </>
            ) : (
              <>
                <button className="py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
                  Add to Cart
                </button>
                <FavoritesButton item={post} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommentsSheetProps {
  post: DiscoverPost;
  onClose: () => void;
}

function CommentsSheet({ post, onClose }: CommentsSheetProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadComments = async () => {
      try {
        const { data, error } = await supabase
          .from('product_feedback_threads')
          .select(
            `
            id,
            title,
            rating,
            created_at,
            buyer_wallet,
            product_feedback_messages(id, body, sender_role, created_at)
          `
          )
          .eq('item_id', post.id)
          .eq('item_type', post.item_type)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setComments(data || []);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [post.id, post.item_type]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
      <div className="w-full bg-white rounded-t-2xl max-h-[90vh] flex flex-col border-t border-gray-200">
        {/* Header */}
        <div className="sticky top-0 p-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No comments yet. Be first!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2 pb-4 border-b border-gray-100 last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{comment.buyer_wallet?.slice(0, 8)}...</p>
                    {comment.rating && (
                      <p className="text-xs text-yellow-500">{'⭐'.repeat(comment.rating)}</p>
                    )}
                    <p className="text-sm text-gray-700 mt-1">
                      {comment.product_feedback_messages?.[0]?.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="sticky bottom-0 p-4 border-t border-gray-200 bg-white space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 bg-gray-100 border border-gray-300 rounded-full px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button className="px-4 py-2 bg-purple-600 text-white rounded-full font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedDiscoverFeed;
