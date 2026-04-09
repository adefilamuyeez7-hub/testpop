import { Router } from 'express';

export default function catalogRoutes(supabase) {
  const router = Router();
  const CHECKOUT_PRODUCT_SELECT = [
    'id',
    'creative_release_id',
    'name',
    'price_eth',
    'stock',
    'sold',
    'status',
    'product_type',
    'asset_type',
    'preview_uri',
    'delivery_uri',
    'image_url',
    'image_ipfs_uri',
    'is_gated',
    'creator_wallet',
    'metadata',
    'contract_kind',
    'contract_listing_id',
    'contract_product_id',
  ].join(', ');

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

  function normalizeCheckoutProduct(product) {
    if (!product || typeof product !== 'object') {
      return product;
    }

    return {
      ...product,
      preview_uri: normalizeIpfsUrl(product.preview_uri),
      image_url: normalizeIpfsUrl(product.image_url),
      image_ipfs_uri: normalizeIpfsUrl(product.image_ipfs_uri),
    };
  }

  async function loadCheckoutProduct(type, id) {
    if (type === 'product') {
      const { data, error } = await supabase
        .from('products')
        .select(CHECKOUT_PRODUCT_SELECT)
        .eq('id', id)
        .in('status', ['published', 'active'])
        .maybeSingle();

      if (error) throw error;
      return normalizeCheckoutProduct(data);
    }

    if (type === 'release') {
      const { data, error } = await supabase
        .from('products')
        .select(CHECKOUT_PRODUCT_SELECT)
        .eq('creative_release_id', id)
        .in('status', ['published', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return normalizeCheckoutProduct(data?.[0] || null);
    }

    if (type === 'drop') {
      const { data: drop, error: dropError } = await supabase
        .from('drops')
        .select('id, creative_release_id, metadata')
        .eq('id', id)
        .maybeSingle();

      if (dropError) throw dropError;
      if (!drop) return null;

      const metadata =
        drop.metadata && typeof drop.metadata === 'object' && !Array.isArray(drop.metadata)
          ? drop.metadata
          : {};
      const sourceProductId =
        typeof metadata.source_product_id === 'string' && metadata.source_product_id.trim()
          ? metadata.source_product_id.trim()
          : '';

      if (sourceProductId) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select(CHECKOUT_PRODUCT_SELECT)
          .eq('id', sourceProductId)
          .in('status', ['published', 'active'])
          .maybeSingle();

        if (productError) throw productError;
        return normalizeCheckoutProduct(product);
      }

      if (drop.creative_release_id) {
        const { data, error } = await supabase
          .from('products')
          .select(CHECKOUT_PRODUCT_SELECT)
          .eq('creative_release_id', drop.creative_release_id)
          .in('status', ['published', 'active'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        return normalizeCheckoutProduct(data?.[0] || null);
      }
    }

    return null;
  }

  /**
   * GET /api/catalog
   * Unified endpoint for Drops, Products, and Releases
   * Replaces:
   *   - GET /api/drops
   *   - GET /api/products
   *   - GET /api/releases
   */
  router.get('/catalog', async (req, res) => {
    try {
      const {
        page = '1',
        limit = '50',
        type = 'all',
        creator_id,
        sort = 'recent',
        search
      } = req.query;

      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const offset = (pageNumber - 1) * pageSize;
      let query = supabase
        .from('catalog_with_engagement')
        .select('*', { count: 'exact' });

      if (type !== 'all') {
        query = query.eq('item_type', type);
      }

      if (creator_id) {
        query = query.eq('creator_id', creator_id);
      }

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      switch (sort) {
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

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      res.json({
        data: (data || []).map(normalizeCatalogItem),
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: count,
          pages: Math.ceil((count || 0) / pageSize)
        }
      });
    } catch (error) {
      console.error('[GET /api/catalog] Error:', error);
      res.status(500).json({
        error: 'Failed to fetch catalog',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/catalog/:type/:id
   * Get unified catalog item with comments and engagement metrics
   */
  router.get('/catalog/:type/:id', async (req, res) => {
    try {
      const { type, id } = req.params;

      if (!['drop', 'product', 'release'].includes(type)) {
        return res.status(400).json({ error: 'Invalid item type' });
      }

      const { data: item, error: itemError } = await supabase
        .from('catalog_with_engagement')
        .select('*')
        .eq('item_type', type)
        .eq('id', id)
        .maybeSingle();

      if (itemError) throw itemError;
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const checkoutProduct = await loadCheckoutProduct(type, id);

      const { data: comments, error: commentsError } = await supabase
        .from('product_feedback_threads')
        .select(`
          id,
          title,
          rating,
          feedback_type,
          visibility,
          featured,
          creator_curated,
          created_at,
          buyer_wallet,
          product_feedback_messages(id, body, sender_role, created_at)
        `)
        .eq('item_id', id)
        .eq('item_type', type)
        .eq('visibility', 'public')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (commentsError) throw commentsError;

      res.json({
        item: normalizeCatalogItem(item),
        comments: comments || [],
        checkout_product: checkoutProduct,
      });
    } catch (error) {
      console.error('[GET /api/catalog/:type/:id] Error:', error);
      res.status(500).json({
        error: 'Failed to fetch catalog item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/catalog/stats/overview
   * Get aggregated catalog statistics
   */
  router.get('/catalog/stats/overview', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .rpc('count_catalog_by_type', { filter_type: null });

      if (error) throw error;

      const stats = {
        drops: data?.find((d) => d.item_type === 'drop')?.count || 0,
        products: data?.find((d) => d.item_type === 'product')?.count || 0,
        releases: data?.find((d) => d.item_type === 'release')?.count || 0
      };

      res.json(stats);
    } catch (error) {
      console.error('[GET /api/catalog/stats/overview] Error:', error);
      res.status(500).json({
        error: 'Failed to fetch catalog stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/catalog/:creator_id/creator
   * Get all items created by a specific creator
   */
  router.get('/catalog/:creator_id/creator', async (req, res) => {
    try {
      const { creator_id } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const offset = (pageNumber - 1) * pageSize;

      const { data, error, count } = await supabase
        .from('catalog_with_engagement')
        .select('*', { count: 'exact' })
        .eq('creator_id', creator_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      res.json({
        data: (data || []).map(normalizeCatalogItem),
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: count,
          pages: Math.ceil((count || 0) / pageSize)
        }
      });
    } catch (error) {
      console.error('[GET /api/catalog/:creator_id/creator] Error:', error);
      res.status(500).json({
        error: 'Failed to fetch creator catalog',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
