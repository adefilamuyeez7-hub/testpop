import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createItemFeedbackThread,
  type ProductFeedbackMessage,
  type ProductFeedbackThread,
  supabase,
} from "@/lib/db";
import { establishSecureSession } from "@/lib/secureAuth";
import { useWallet } from "@/hooks/useContracts";
import { CatalogItem, formatPrice } from "@/utils/catalogUtils";
import {
  FavoritesButton,
  SocialShareButton,
  SubscribeButton,
} from "@/components/PersonalizationComponents";
import { toast } from "sonner";

interface SocialFeedPost extends CatalogItem {
  creator_name?: string;
  is_liked?: boolean;
  like_count?: number;
  is_verified?: boolean;
}

type FeedComment = Pick<
  ProductFeedbackThread,
  "id" | "title" | "rating" | "created_at" | "buyer_wallet"
> & {
  product_feedback_messages?: Array<
    Pick<ProductFeedbackMessage, "id" | "body" | "sender_role" | "created_at">
  >;
};

const FEED_PAGE_SIZE = 10;

function toFeedComment(thread: ProductFeedbackThread): FeedComment {
  return {
    id: thread.id,
    title: thread.title || null,
    rating: thread.rating ?? null,
    created_at: thread.created_at,
    buyer_wallet: thread.buyer_wallet,
    product_feedback_messages: thread.latest_message ? [thread.latest_message] : [],
  };
}

export function SocialMediaFeedReleases() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const fetchInFlightRef = useRef(false);
  const [selectedPost, setSelectedPost] = useState<SocialFeedPost | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!hasMore || fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("catalog_with_engagement")
        .select("*")
        .in("item_type", ["release", "product"])
        .order("created_at", { ascending: false })
        .range((page - 1) * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE - 1);

      if (error) throw error;

      const incoming = (data || []) as SocialFeedPost[];
      setPosts((prev) => {
        if (page === 1) return incoming;

        const seen = new Set(prev.map((post) => `${post.item_type}:${post.id}`));
        const deduped = incoming.filter((post) => !seen.has(`${post.item_type}:${post.id}`));
        return [...prev, ...deduped];
      });

      setHasMore(incoming.length === FEED_PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load posts:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load feed");
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !fetchInFlightRef.current) {
          setPage((currentPage) => currentPage + 1);
        }
      },
      { threshold: 0.2, rootMargin: "200px 0px" }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="h-screen bg-black text-white overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold">Creative Releases</h1>
          <p className="text-sm text-gray-400">Discover digital products and experiences</p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {posts.map((post) => (
          <SocialFeedCard
            key={`${post.item_type}:${post.id}`}
            post={post}
            onComment={() => {
              setSelectedPost(post);
              setShowComments(true);
            }}
            onOpenDetails={() => navigate(`/catalog/${post.item_type}/${post.id}`)}
          />
        ))}

        {!loading && posts.length === 0 && !loadError ? (
          <div className="px-4 py-10 text-sm text-gray-400">No products found yet.</div>
        ) : null}

        {loadError ? <div className="px-4 py-4 text-sm text-red-400">{loadError}</div> : null}
      </div>

      <div ref={observerTarget} className="p-4 text-center">
        {loading ? <p className="text-gray-400 text-sm">Loading more...</p> : null}
        {!hasMore && posts.length > 0 ? (
          <p className="text-gray-500 text-xs">You reached the end.</p>
        ) : null}
      </div>

      {showComments && selectedPost ? (
        <CommentsSheet post={selectedPost} onClose={() => setShowComments(false)} />
      ) : null}
    </div>
  );
}

interface SocialFeedCardProps {
  post: SocialFeedPost;
  onComment: () => void;
  onOpenDetails: () => void;
}

function SocialFeedCard({ post, onComment, onOpenDetails }: SocialFeedCardProps) {
  return (
    <div className="h-screen bg-black snap-start relative flex flex-col justify-end pb-20">
      <div className="absolute inset-0">
        {post.image_url ? (
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute right-4 bottom-24 z-10 flex flex-col gap-4">
        <FavoritesButton item={post} />

        <button
          onClick={onComment}
          className="flex flex-col items-center gap-1 p-3 rounded-full hover:bg-white/10 transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs font-medium">{post.comment_count || 0}</span>
        </button>

        <SocialShareButton item={post} />
      </div>

      <div className="relative z-20 space-y-3">
        <div className="flex items-center gap-3 px-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {post.creator_wallet?.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-sm">{post.creator_wallet?.slice(0, 12)}...</p>
            <p className="text-xs text-gray-300">Creator</p>
          </div>
          <SubscribeButton
            creator_id={post.creator_wallet}
            creator_wallet={post.creator_wallet}
            className="ml-auto"
          />
        </div>

        <div className="px-4 space-y-2">
          <h2 className="text-lg font-bold leading-tight">{post.title}</h2>
          {post.description ? (
            <p className="text-sm text-gray-200 line-clamp-2">{post.description}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {post.item_type === "release" ? (
              <span className="px-2 py-1 bg-purple-600/50 rounded-full text-xs font-medium">
                #CreativeRelease
              </span>
            ) : null}
            {post.item_type === "product" ? (
              <span className="px-2 py-1 bg-blue-600/50 rounded-full text-xs font-medium">
                #DigitalProduct
              </span>
            ) : null}
            {post.avg_rating && post.avg_rating > 4 ? (
              <span className="px-2 py-1 bg-green-600/50 rounded-full text-xs font-medium">
                Trending
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-4 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-xl font-bold">{formatPrice(post.price_eth)}</p>
          </div>
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex-1 mx-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Get Now
          </button>
        </div>
      </div>
    </div>
  );
}

interface CommentsSheetProps {
  post: SocialFeedPost;
  onClose: () => void;
}

function CommentsSheet({ post, onClose }: CommentsSheetProps) {
  const { address, isConnected, connectWallet } = useWallet();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_feedback_threads")
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
        .eq("item_id", post.id)
        .eq("item_type", post.item_type)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setComments((data || []) as FeedComment[]);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  }, [post.id, post.item_type]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handlePostComment() {
    const body = newComment.trim();
    if (!body) return;

    if (!isConnected || !address) {
      await connectWallet();
      toast.info("Connect your wallet, then post your comment.");
      return;
    }

    try {
      setPosting(true);
      await establishSecureSession(address);
      const thread = await createItemFeedbackThread({
        itemType: post.item_type,
        itemId: post.id,
        feedbackType: "feedback",
        visibility: "public",
        body,
      });

      const nextComment = toFeedComment(thread);
      setComments((current) => [nextComment, ...current.filter((comment) => comment.id !== nextComment.id)]);
      setNewComment("");
      toast.success("Comment posted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
      <div className="w-full bg-black rounded-t-2xl max-h-[90vh] flex flex-col border-t border-gray-800">
        <div className="sticky top-0 p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-gray-400 text-sm">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{comment.buyer_wallet?.slice(0, 8)}...</p>
                    {comment.rating ? (
                      <p className="text-xs text-yellow-400">{comment.rating}/5</p>
                    ) : null}
                    <p className="text-sm text-gray-300 mt-1">
                      {comment.product_feedback_messages?.[0]?.body || comment.title || "Feedback"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : "Recently"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sticky bottom-0 p-4 border-t border-gray-800 bg-black space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handlePostComment();
                }
              }}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-full px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={() => void handlePostComment()}
              disabled={posting || !newComment.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-full font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SocialMediaFeedReleases;
