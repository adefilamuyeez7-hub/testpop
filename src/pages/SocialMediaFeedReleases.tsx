import React, { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import { CatalogItem, formatPrice } from "@/utils/catalogUtils";
import { SocialShareButton, SubscribeButton } from "@/components/PersonalizationComponents";
import { useCartStore } from "@/stores/cartStore";
import { useWallet } from "@/hooks/useContracts";
import { addProductToCart, resolveDiscoverPrimaryAction } from "@/lib/discoveryActions";

interface SocialFeedPost extends CatalogItem {
  creator_name?: string;
  is_verified?: boolean;
}

export function SocialMediaFeedReleases() {
  const [posts, setPosts] = useState<SocialFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<SocialFeedPost | null>(null);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPosts = async () => {
      if (!hasMore || loading) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("catalog_with_engagement")
          .select("*")
          .in("item_type", ["release", "product"])
          .order("created_at", { ascending: false })
          .range((page - 1) * 10, page * 10 - 1);

        if (error) throw error;
        if (!active) return;

        const nextPosts = (data || []) as SocialFeedPost[];
        setPosts((prev) => {
          const merged = page === 1 ? nextPosts : [...prev, ...nextPosts];
          const deduped = new Map(merged.map((item) => [`${item.item_type}:${item.id}`, item]));
          return Array.from(deduped.values());
        });
        setHasMore(nextPosts.length >= 10);
      } catch (error) {
        console.error("Failed to load posts:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPosts();
    return () => {
      active = false;
    };
  }, [page, hasMore, loading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((current) => current + 1);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  return (
    <div className="h-screen snap-y snap-mandatory overflow-y-scroll bg-black text-white scrollbar-hide">
      <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/80 p-4 backdrop-blur-lg">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-bold">Creative Releases</h1>
          <p className="text-sm text-gray-400">Discover digital products and experiences</p>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        {posts.map((post) => (
          <SocialFeedCard
            key={`${post.item_type}:${post.id}`}
            post={post}
            onComment={() => {
              setSelectedPost(post);
              setShowComments(true);
            }}
          />
        ))}
      </div>

      <div ref={observerTarget} className="p-4 text-center">
        {loading ? <p className="text-gray-400">Loading more...</p> : null}
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
}

function SocialFeedCard({ post, onComment }: SocialFeedCardProps) {
  const navigate = useNavigate();
  const { address, isConnected, connectWallet } = useWallet();
  const addItem = useCartStore((state) => state.addItem);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!address) {
      setIsFavorited(false);
      return;
    }

    let active = true;
    supabase
      .from("user_favorites")
      .select("id")
      .eq("user_wallet", address.toLowerCase())
      .eq("item_id", post.id)
      .eq("item_type", post.item_type)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setIsFavorited(Boolean(data));
        }
      })
      .catch(() => {
        if (active) {
          setIsFavorited(false);
        }
      });

    return () => {
      active = false;
    };
  }, [address, post.id, post.item_type]);

  async function toggleFavorite() {
    if (!isConnected || !address) {
      await connectWallet();
      return;
    }

    try {
      setFavoriteBusy(true);
      if (isFavorited) {
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("user_wallet", address.toLowerCase())
          .eq("item_id", post.id)
          .eq("item_type", post.item_type);
        if (error) throw error;
        setIsFavorited(false);
      } else {
        const { error } = await supabase.from("user_favorites").insert({
          user_wallet: address.toLowerCase(),
          item_id: post.id,
          item_type: post.item_type,
        });
        if (error) throw error;
        setIsFavorited(true);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Unable to update favorite right now.");
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleDoubleTapLike() {
    if (!isFavorited) {
      await toggleFavorite();
    }
    setShowLikeBurst(true);
    window.setTimeout(() => setShowLikeBurst(false), 420);
  }

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastTapRef.current <= 320) {
      void handleDoubleTapLike();
    }
    lastTapRef.current = now;
  }

  async function handleGetNow() {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    try {
      setCtaBusy(true);
      const action = await resolveDiscoverPrimaryAction({
        id: post.id,
        item_type: post.item_type,
        can_bid: post.can_bid,
        can_purchase: post.can_purchase,
        contract_kind: post.contract_kind,
        price_eth: post.price_eth,
      });

      if (action.kind !== "cart") {
        toast.error("This item is not checkout-ready yet.");
        return;
      }

      addProductToCart(addItem, action.product, post.title, post.image_url);
      toast.success("Added to cart.");
      navigate("/checkout");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setCtaBusy(false);
    }
  }

  return (
    <div className="relative flex h-screen snap-start flex-col justify-end bg-black pb-20">
      <div
        className="absolute inset-0"
        onDoubleClick={() => void handleDoubleTapLike()}
        onTouchEnd={handleMediaTap}
      >
        {post.image_url ? (
          <img src={post.image_url} alt={post.title} className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
        {showLikeBurst ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.8)] animate-pulse" />
          </div>
        ) : null}
      </div>

      <div className="absolute right-4 top-4 z-10">
        <button className="rounded-full bg-white/10 p-2 backdrop-blur-sm transition hover:bg-white/20">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-4">
        <button
          onClick={() => void toggleFavorite()}
          disabled={favoriteBusy}
          className="flex flex-col items-center gap-1 rounded-full p-3 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          <Heart className={`h-6 w-6 ${isFavorited ? "fill-red-500 text-red-500" : "text-white"}`} />
          <span className="text-xs font-medium">{isFavorited ? "Liked" : "Like"}</span>
        </button>

        <button
          onClick={onComment}
          className="flex flex-col items-center gap-1 rounded-full p-3 transition-colors hover:bg-white/10"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs font-medium">{post.comment_count || 0}</span>
        </button>

        <SocialShareButton item={post} />
      </div>

      <div className="relative z-20 space-y-3">
        <div className="flex items-center gap-3 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
            <span className="text-sm font-bold text-white">{post.creator_wallet?.slice(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold">{post.creator_wallet?.slice(0, 12)}...</p>
            <p className="text-xs text-gray-300">Creator</p>
          </div>
          <SubscribeButton creator_id={post.creator_wallet} creator_wallet={post.creator_wallet} className="ml-auto" />
        </div>

        <div className="space-y-2 px-4">
          <h2 className="text-lg font-bold leading-tight">{post.title}</h2>
          {post.description ? <p className="line-clamp-2 text-sm text-gray-200">{post.description}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {post.item_type === "release" ? (
              <span className="rounded-full bg-purple-600/50 px-2 py-1 text-xs font-medium">#CreativeRelease</span>
            ) : null}
            {post.item_type === "product" ? (
              <span className="rounded-full bg-blue-600/50 px-2 py-1 text-xs font-medium">#DigitalProduct</span>
            ) : null}
            {post.avg_rating && post.avg_rating > 4 ? (
              <span className="rounded-full bg-green-600/50 px-2 py-1 text-xs font-medium">Trending</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4">
          <div>
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-xl font-bold">{formatPrice(post.price_eth)}</p>
          </div>
          <button
            onClick={() => void handleGetNow()}
            disabled={ctaBusy}
            className="mx-4 flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {ctaBusy ? "Preparing..." : "Get Now"}
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
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadComments = async () => {
      try {
        const { data, error } = await supabase
          .from("product_feedback_threads")
          .select(`
            id,
            title,
            rating,
            created_at,
            buyer_wallet,
            product_feedback_messages(id, body, sender_role, created_at)
          `)
          .eq("item_id", post.id)
          .eq("item_type", post.item_type)
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (active) setComments(data || []);
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadComments();
    return () => {
      active = false;
    };
  }, [post.id, post.item_type]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full flex-col rounded-t-2xl border-t border-gray-800 bg-black">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-800 p-4">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 transition-colors hover:text-white">
            x
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-400">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{comment.buyer_wallet?.slice(0, 8)}...</p>
                    {comment.rating ? <p className="text-xs text-yellow-400">{`${comment.rating}/5`}</p> : null}
                    <p className="mt-1 text-sm text-gray-300">{comment.product_feedback_messages?.[0]?.body}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default SocialMediaFeedReleases;
