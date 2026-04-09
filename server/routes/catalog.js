import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

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
      page = 1,
      limit = 50,
      type = 'all',
      creator_id,
      sort = 'recent',
      search
    } = req.query;

    const offset = (page - 1) * limit;
    let query = supabase
      .from('catalog_with_engagement')
      .select('*', { count: 'exact' });

    // Filter by type
    if (type !== 'all') {
      query = query.eq('item_type', type);
    }

    // Filter by creator
    if (creator_id) {
      query = query.eq('creator_id', creator_id);
    }

    // Search in title and description
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Sort
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

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil((count || 0) / limit)
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

    // Fetch item from unified view
    const { data: item, error: itemError } = await supabase
      .from('catalog_with_engagement')
      .select('*')
      .eq('item_type', type)
      .eq('id', id)
      .single();

    if (itemError) throw itemError;
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Fetch comments
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
      item,
      comments: comments || []
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
router.get('/catalog/stats/overview', async (req, res) => {
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
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('catalog_with_engagement')
      .select('*', { count: 'exact' })
      .eq('creator_id', creator_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil((count || 0) / limit)
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

export default router;
