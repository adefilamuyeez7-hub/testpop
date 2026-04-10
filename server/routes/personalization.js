import { Router } from 'express';
import { verifyApiBearerToken } from '../requestAuth.js';

/**
 * Personalization API Routes
 * - Favorites/Wishlist
 * - Creator Subscriptions
 * - Analytics Tracking
 * - Recommendations
 * - Social Sharing
 */
export default function createPersonalizationRoutes(supabase) {
  const router = Router();
  const TRACKED_SHARE_PLATFORMS = new Set([
    'twitter',
    'facebook',
    'linkedin',
    'telegram',
    'whatsapp',
    'reddit',
    'copy',
    'native',
  ]);
  const PERSISTED_SHARE_PLATFORMS = new Set([
    'twitter',
    'facebook',
    'linkedin',
    'telegram',
    'whatsapp',
    'reddit',
  ]);

  function resolveOptionalWallet(req) {
    if (req.user?.wallet) return req.user.wallet;

    try {
      if (req.headers.authorization) {
        return verifyApiBearerToken(req.headers.authorization).wallet;
      }
    } catch (_error) {
      return '';
    }

    return '';
  }

  function normalizeBaseUrl(value) {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    return normalized || "";
  }

  function normalizeIpfsUrl(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (normalized.startsWith('ipfs://ipfs/')) {
      return `https://ipfs.io/ipfs/${normalized.slice('ipfs://ipfs/'.length)}`;
    }
    if (normalized.startsWith('ipfs://')) {
      return `https://ipfs.io/ipfs/${normalized.slice('ipfs://'.length)}`;
    }
    return normalized;
  }

  function normalizeCatalogItem(item) {
    if (!item || typeof item !== 'object') {
      return item;
    }

    return {
      ...item,
      image_url: normalizeIpfsUrl(item.image_url),
    };
  }

  function getCatalogPrimaryAction(item) {
    const normalizedContractKind = String(item?.contract_kind || '').trim().toLowerCase();
    const normalizedProductType = String(item?.product_type || '').trim().toLowerCase();
    const normalizedSourceKind = String(item?.source_kind || '').trim().toLowerCase();

    if (item?.item_type === 'drop' && item?.can_bid) {
      return 'bid';
    }

    if (!item?.can_purchase) {
      return 'details';
    }

    if (item?.item_type === 'product' || item?.item_type === 'release') {
      return 'cart';
    }

    if (
      item?.item_type === 'drop' &&
      (
        normalizedContractKind === 'creativereleaseescrow' ||
        normalizedContractKind === 'productstore' ||
        normalizedSourceKind === 'release_product' ||
        normalizedSourceKind === 'catalog_product' ||
        normalizedProductType === 'physical' ||
        normalizedProductType === 'hybrid'
      )
    ) {
      return 'cart';
    }

    return 'collect';
  }

  function getShareIntent(item) {
    const primaryAction = getCatalogPrimaryAction(item);
    if (primaryAction === 'cart') return 'checkout';
    if (primaryAction === 'collect') return 'collect';
    return 'details';
  }

  function getShareActionCopy(intent) {
    switch (intent) {
      case 'checkout':
        return 'Tap to open checkout on Base.';
      case 'collect':
        return 'Tap to connect your wallet and collect on Base.';
      default:
        return 'Tap to open the action page.';
    }
  }

  function resolveShareBaseUrl(req) {
    const configuredBase = normalizeBaseUrl(
      process.env.SHARE_BASE_URL ||
      process.env.VITE_SHARE_BASE_URL ||
      process.env.FRONTEND_PUBLIC_URL
    );

    if (configuredBase) {
      return configuredBase;
    }

    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = forwardedHost || String(req.headers.host || "").trim();
    const protocol = forwardedProto || req.protocol || "https";

    if (host) {
      return `${protocol}://${host}`;
    }

    const frontendOrigin = String(process.env.FRONTEND_ORIGIN || "")
      .split(",")
      .map((origin) => normalizeBaseUrl(origin))
      .find(Boolean);

    return frontendOrigin || "https://testpop-one.vercel.app";
  }

  async function enrichCatalogActionFields(itemType, itemId, existingItem = null) {
    const baseItem = existingItem && typeof existingItem === 'object' ? existingItem : {};

    if (itemType === 'product') {
      const { data, error } = await supabase
        .from('products')
        .select('product_type, contract_kind')
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw error;
      return {
        ...baseItem,
        product_type: data?.product_type || baseItem.product_type || null,
        contract_kind: data?.contract_kind || baseItem.contract_kind || null,
      };
    }

    if (itemType === 'release') {
      const { data, error } = await supabase
        .from('creative_releases')
        .select('contract_kind')
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw error;
      return {
        ...baseItem,
        contract_kind: data?.contract_kind || baseItem.contract_kind || null,
      };
    }

    if (itemType === 'drop') {
      const { data, error } = await supabase
        .from('drops')
        .select('contract_kind, metadata')
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw error;

      const metadata =
        data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
          ? data.metadata
          : null;

      return {
        ...baseItem,
        contract_kind:
          data?.contract_kind ||
          (typeof metadata?.contract_kind === 'string' ? metadata.contract_kind : null) ||
          baseItem.contract_kind ||
          null,
        source_kind:
          (typeof metadata?.source_kind === 'string' ? metadata.source_kind : null) ||
          baseItem.source_kind ||
          null,
        product_type:
          (typeof metadata?.product_type === 'string' ? metadata.product_type : null) ||
          baseItem.product_type ||
          null,
      };
    }

    return baseItem;
  }

  // ============================================
  // FAVORITES ENDPOINTS
  // ============================================

  /**
   * GET /api/personalization/favorites
   * Get user's favorited items
   */
  router.get('/personalization/favorites', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabase
        .rpc('get_user_favorites', {
          wallet_address: userWallet,
          limit_count: 100
        });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error('[GET /api/personalization/favorites] Error:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  /**
   * POST /api/personalization/favorites
   * Add item to favorites
   */
  router.post('/personalization/favorites', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { item_id, item_type } = req.body;
      if (!item_id || !item_type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('user_favorites')
        .insert({
          user_wallet: userWallet,
          item_id,
          item_type
        })
        .select();

      if (error) throw error;
      res.json(data?.[0]);
    } catch (error) {
      console.error('[POST /api/personalization/favorites] Error:', error);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });

  /**
   * DELETE /api/personalization/favorites/:item_id/:item_type
   * Remove item from favorites
   */
  router.delete('/personalization/favorites/:item_id/:item_type', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { item_id, item_type } = req.params;

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .match({
          user_wallet: userWallet,
          item_id,
          item_type
        });

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('[DELETE /api/personalization/favorites] Error:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // ============================================
  // SUBSCRIPTIONS ENDPOINTS
  // ============================================

  /**
   * GET /api/personalization/subscriptions
   * Get user's creator subscriptions
   */
  router.get('/personalization/subscriptions', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { data, error } = await supabase
        .from('creator_subscriptions')
        .select('*, artists(*)')
        .eq('subscriber_wallet', userWallet)
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error('[GET /api/personalization/subscriptions] Error:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });

  /**
   * POST /api/personalization/subscriptions
   * Subscribe to creator
   */
  router.post('/personalization/subscriptions', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { creator_id, creator_wallet, subscription_tier = 'free' } = req.body;
      if (!creator_id || !creator_wallet) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('creator_subscriptions')
        .upsert({
          subscriber_wallet: userWallet,
          creator_id,
          creator_wallet,
          subscription_tier
        })
        .select();

      if (error) throw error;
      res.json(data?.[0]);
    } catch (error) {
      console.error('[POST /api/personalization/subscriptions] Error:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  /**
   * DELETE /api/personalization/subscriptions/:creator_id
   * Unsubscribe from creator
   */
  router.delete('/personalization/subscriptions/:creator_id', async (req, res) => {
    try {
      const userWallet = req.user?.wallet;
      if (!userWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { creator_id } = req.params;

      const { error } = await supabase
        .from('creator_subscriptions')
        .delete()
        .match({
          subscriber_wallet: userWallet,
          creator_id
        });

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('[DELETE /api/personalization/subscriptions] Error:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  /**
   * POST /api/personalization/analytics
   * Track user event (view, like, comment, purchase, share)
   */
  router.post('/personalization/analytics', async (req, res) => {
    try {
      const { item_id, item_type, event_type, data = {} } = req.body;
      const userWallet = req.user?.wallet;

      if (!item_id || !item_type || !event_type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { error } = await supabase
        .from('analytics_events')
        .insert({
          item_id,
          item_type,
          event_type,
          user_wallet: userWallet,
          data
        });

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('[POST /api/personalization/analytics] Error:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  });

  /**
   * GET /api/personalization/analytics/:item_id/:item_type
   * Get item analytics summary
   */
  router.get('/personalization/analytics/:item_id/:item_type', async (req, res) => {
    try {
      const { item_id, item_type } = req.params;

      const { data, error } = await supabase
        .rpc('get_item_analytics', {
          item_id_param: item_id,
          item_type_param: item_type
        });

      if (error) throw error;
      res.json(data?.[0] || {});
    } catch (error) {
      console.error('[GET /api/personalization/analytics] Error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // ============================================
  // RECOMMENDATIONS ENDPOINTS
  // ============================================

  /**
   * GET /api/personalization/recommendations/:item_id/:item_type
   * Get product recommendations (people also bought)
   */
  router.get('/personalization/recommendations/:item_id/:item_type', async (req, res) => {
    try {
      const { item_id, item_type } = req.params;
      const { limit = 5 } = req.query;

      const { data, error } = await supabase
        .rpc('get_item_recommendations', {
          item_id_param: item_id,
          item_type_param: item_type,
          limit_count: parseInt(limit)
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.json([]);
      }

      // Fetch full item details for recommendations
      const recommendedIds = data.map((d) => d.recommended_item_id);
      const { data: items, error: itemsError } = await supabase
        .from('catalog_with_engagement')
        .select('*')
        .in('id', recommendedIds);

      if (itemsError) throw itemsError;
      res.json(items || []);
    } catch (error) {
      console.error('[GET /api/personalization/recommendations] Error:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  });

  // ============================================
  // SOCIAL SHARING ENDPOINTS
  // ============================================

  /**
   * POST /api/personalization/share
   * Log social share
   */
  router.post('/personalization/share', async (req, res) => {
    try {
      const userWallet = resolveOptionalWallet(req);
      const { item_id, item_type, share_platform } = req.body;

      if (!item_id || !item_type || !share_platform) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!TRACKED_SHARE_PLATFORMS.has(share_platform)) {
        return res.status(400).json({ error: 'Unsupported share platform' });
      }

      let shareRecord = null;
      const persistedPlatform = PERSISTED_SHARE_PLATFORMS.has(share_platform) ? share_platform : null;
      if (persistedPlatform) {
        const { data, error } = await supabase
          .from('social_shares')
          .insert({
            item_id,
            item_type,
            share_platform: persistedPlatform,
            shared_by_wallet: userWallet || null,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('[POST /api/personalization/share] Failed to persist share analytics:', error);
        } else {
          shareRecord = data || null;
        }
      }

      const shareId = shareRecord?.id || null;
      const baseUrl = resolveShareBaseUrl(req);
      const params = new URLSearchParams();
      if (shareId) params.set('share', shareId);
      if (userWallet) params.set('ref', userWallet);
      const { data: catalogItem } = await supabase
        .from('catalog_with_engagement')
        .select('item_type, title, price_eth, can_purchase, can_bid, product_type, contract_kind')
        .eq('id', item_id)
        .eq('item_type', item_type)
        .maybeSingle();

      const enrichedCatalogItem = await enrichCatalogActionFields(item_type, item_id, catalogItem || null);
      const shareIntent = getShareIntent({
        item_type,
        can_purchase: Boolean(enrichedCatalogItem?.can_purchase),
        can_bid: Boolean(enrichedCatalogItem?.can_bid),
        product_type: enrichedCatalogItem?.product_type || null,
        contract_kind: enrichedCatalogItem?.contract_kind || null,
      });
      const itemTitle = String(enrichedCatalogItem?.title || 'this collectible').trim();
      const priceValue = Number(enrichedCatalogItem?.price_eth || 0);
      params.set('intent', shareIntent);
      params.set('auto', '1');
      const shareText = priceValue > 0
        ? `${itemTitle} is live on POPUP for ${priceValue} ETH.`
        : `${itemTitle} is live on POPUP.`;
      const shareUrl = `${baseUrl}/share/${item_type}/${item_id}${params.toString() ? `?${params.toString()}` : ''}`;
      const shareMessage = `${shareText} ${getShareActionCopy(shareIntent)} ${shareUrl}`;

      if (shareId) {
        const { error: updateError } = await supabase
          .from('social_shares')
          .update({ share_url: shareUrl })
          .eq('id', shareId);
        if (updateError) {
          console.warn('[POST /api/personalization/share] Failed to save generated share URL:', updateError);
        }
      }

      res.json({
        ...(shareRecord || {}),
        share_platform,
        share_intent: shareIntent,
        tracked: Boolean(shareId),
        share_url: shareUrl,
        share_message: shareMessage,
        platform_urls: {
          twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
          reddit: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}`
        }
      });
    } catch (error) {
      console.error('[POST /api/personalization/share] Error:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  /**
   * GET /api/personalization/share/:share_id/click
   * Track share click (for analytics)
   */
  router.get('/personalization/share/:share_id/click', async (req, res) => {
    try {
      const { share_id } = req.params;

      const { data: shareRow, error: loadError } = await supabase
        .from('social_shares')
        .select('id, click_count')
        .eq('id', share_id)
        .maybeSingle();

      if (loadError) throw loadError;
      if (!shareRow) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      const { error } = await supabase
        .from('social_shares')
        .update({ click_count: Number(shareRow.click_count || 0) + 1 })
        .eq('id', share_id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('[GET /api/personalization/share/:id/click] Error:', error);
      res.status(500).json({ error: 'Failed to track click' });
    }
  });

  // ============================================
  // CREATOR DASHBOARD ENDPOINTS
  // ============================================

  /**
   * GET /api/personalization/creator/analytics
   * Get creator's item analytics
   */
  router.get('/personalization/creator/analytics', async (req, res) => {
    try {
      const creatorWallet = req.user?.wallet;
      if (!creatorWallet) return res.status(401).json({ error: 'Unauthorized' });

      // Get creator's items
      const { data: creatorItems, error: creatorError } = await supabase
        .from('catalog_with_engagement')
        .select('id, item_type, title, comment_count, avg_rating')
        .eq('creator_wallet', creatorWallet);

      if (creatorError) throw creatorError;

      if (!creatorItems || creatorItems.length === 0) {
        return res.json({ items: [], total_stats: {} });
      }

      // Get analytics for each item
      const analyticsPromises = creatorItems.map((item) =>
        supabase.rpc('get_item_analytics', {
          item_id_param: item.id,
          item_type_param: item.item_type
        })
      );

      const analyticsResults = await Promise.all(analyticsPromises);

      const itemsWithAnalytics = creatorItems.map((item, idx) => ({
        ...item,
        analytics: analyticsResults[idx]?.data?.[0] || {}
      }));

      // Calculate totals
      const totalStats = {
        total_views: itemsWithAnalytics.reduce((sum, item) => sum + (item.analytics.views || 0), 0),
        total_likes: itemsWithAnalytics.reduce((sum, item) => sum + (item.analytics.likes || 0), 0),
        total_comments: itemsWithAnalytics.reduce((sum, item) => sum + (item.analytics.comments || 0), 0),
        total_purchases: itemsWithAnalytics.reduce((sum, item) => sum + (item.analytics.purchases || 0), 0),
        total_shares: itemsWithAnalytics.reduce((sum, item) => sum + (item.analytics.shares || 0), 0),
        avg_rating: (
          itemsWithAnalytics.reduce((sum, item) => sum + (item.avg_rating || 0), 0) /
          itemsWithAnalytics.length
        ).toFixed(2)
      };

      res.json({ items: itemsWithAnalytics, total_stats: totalStats });
    } catch (error) {
      console.error('[GET /api/personalization/creator/analytics] Error:', error);
      res.status(500).json({ error: 'Failed to fetch creator analytics' });
    }
  });

  /**
   * GET /api/personalization/creator/subscribers
   * Get creator's subscribers
   */
  router.get('/personalization/creator/subscribers', async (req, res) => {
    try {
      const creatorWallet = req.user?.wallet;
      if (!creatorWallet) return res.status(401).json({ error: 'Unauthorized' });

      const { data, error } = await supabase
        .from('creator_subscriptions')
        .select('*')
        .eq('creator_wallet', creatorWallet)
        .order('subscribed_at', { ascending: false });

      if (error) throw error;

      const stats = {
        total_subscribers: data?.length || 0,
        by_tier: {
          free: data?.filter((d) => d.subscription_tier === 'free').length || 0,
          supporter: data?.filter((d) => d.subscription_tier === 'supporter').length || 0,
          vip: data?.filter((d) => d.subscription_tier === 'vip').length || 0,
          collector: data?.filter((d) => d.subscription_tier === 'collector').length || 0
        }
      };

      res.json({ subscribers: data || [], stats });
    } catch (error) {
      console.error('[GET /api/personalization/creator/subscribers] Error:', error);
      res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
  });

  // ============================================
  // DISCOVER FEED ENDPOINTS
  // ============================================

  /**
   * GET /api/discover/feed
   * Unified discover feed with all items
   */
  router.get('/discover/feed', async (req, res) => {
    try {
      const { page = '0', limit = '10', type = 'all', search = '' } = req.query;
      const pageNumber = Math.max(parseInt(page, 10) || 0, 0);
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      const offset = pageNumber * pageSize;
      let query = supabase
        .from('catalog_with_engagement')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (type && type !== 'all') {
        query = query.eq('item_type', type);
      }

      if (search && search.trim()) {
        const searchTerm = search.trim();
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return res.json({
        data: (data || []).map(normalizeCatalogItem),
        count: count || 0,
        page: pageNumber,
        limit: pageSize
      });
    } catch (error) {
      console.error('[GET /api/discover/feed] Error:', error);
      res.status(500).json({ error: 'Failed to fetch discover feed', details: error.message });
    }
  });

  return router;
}
