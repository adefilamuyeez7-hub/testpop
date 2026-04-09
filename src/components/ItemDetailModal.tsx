import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { X, Loader2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/db';
import {
  CatalogItem,
  formatPrice,
  formatSupply,
  getItemTypeIcon,
  getItemTypeName,
  getItemActions
} from '@/utils/catalogUtils';

interface ItemDetailModalProps {
  isOpen: boolean;
  itemType?: 'drop' | 'product' | 'release';
  itemId?: string;
  onClose: () => void;
  onPurchase?: (item: CatalogItem) => void;
}

export function ItemDetailModal({
  isOpen,
  itemType,
  itemId,
  onClose,
  onPurchase
}: ItemDetailModalProps) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');

  useEffect(() => {
    if (!isOpen || !itemType || !itemId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch item details
        const { data: itemData, error: itemError } = await supabase
          .from('catalog_with_engagement')
          .select('*')
          .eq('item_type', itemType)
          .eq('id', itemId)
          .single();

        if (itemError) throw itemError;
        setItem(itemData as CatalogItem);

        // Fetch comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('product_feedback_threads')
          .select(
            `
            id,
            title,
            rating,
            feedback_type,
            featured,
            creator_curated,
            created_at,
            buyer_wallet,
            product_feedback_messages(
              id,
              body,
              sender_role,
              created_at
            )
          `
          )
          .eq('item_id', itemId)
          .eq('item_type', itemType)
          .eq('visibility', 'public')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);

        if (commentsError) throw commentsError;
        setComments(commentsData || []);
      } catch (error) {
        console.error('Failed to fetch item details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, itemType, itemId]);

  if (!isOpen || !item) return null;

  const actions = getItemActions(item);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getItemTypeIcon(item.item_type)}</span>
              <div>
                <DialogTitle>{item.title}</DialogTitle>
                <DialogDescription>{getItemTypeName(item.item_type)}</DialogDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full hover:bg-gray-100 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Image */}
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-64 object-cover rounded-lg"
              />
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'comments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Comments ({comments.length})
              </button>
            </div>

            {activeTab === 'details' ? (
              <div className="space-y-4">
                {/* Description */}
                {item.description && (
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="text-lg font-semibold">{formatPrice(item.price_eth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Available</p>
                    <p className="text-lg font-semibold">{formatSupply(item.supply_or_stock)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rating</p>
                    <p className="text-lg font-semibold">
                      {item.avg_rating ? `${item.avg_rating.toFixed(1)}⭐` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Creator */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Created by</p>
                  <p className="font-medium">{item.creator_wallet}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{comment.title}</p>
                          <p className="text-sm text-gray-500">
                            {comment.buyer_wallet.slice(0, 10)}...
                          </p>
                        </div>
                        {comment.rating && (
                          <p className="text-lg">
                            {'⭐'.repeat(comment.rating)}
                          </p>
                        )}
                      </div>
                      {comment.product_feedback_messages?.[0]?.body && (
                        <p className="text-gray-700 mb-2">
                          {comment.product_feedback_messages[0].body}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              {item.can_purchase && (
                <button
                  onClick={() => {
                    onPurchase?.(item);
                    onClose();
                  }}
                  className="flex-1 bg-primary text-white font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Get Now
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ItemDetailModal;
