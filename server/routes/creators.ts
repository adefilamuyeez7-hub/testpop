import express, { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

const router = Router();

// Fallback mock creators data - used only when database is unavailable
const fallbackCreators = [
  {
    id: '1',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Luna Artist',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    bio: 'Digital artist creating surreal abstract worlds',
    collectionAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    collectionName: 'Luna Collection',
    price: '0.75',
    cardTokenId: '1',
    sales24h: 12,
    volume24h: '9.0 ETH',
    verified: true,
    followerCount: 5400,
  },
  {
    id: '2',
    address: '0x2234567890abcdef1234567890abcdef12345678',
    name: 'Neon Dreams',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: 'Creating vibrant cyberpunk-inspired art',
    collectionAddress: '0xbcdef1234567890abcdef1234567890abcdef123',
    collectionName: 'Neon Collection',
    price: '1.2',
    cardTokenId: '2',
    sales24h: 8,
    volume24h: '9.6 ETH',
    verified: true,
    followerCount: 3200,
  },
  {
    id: '3',
    address: '0x3234567890abcdef1234567890abcdef12345678',
    name: 'Horizon',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    bio: 'Landscape photographer and digital artist',
    collectionAddress: '0xcdef1234567890abcdef1234567890abcdef1234',
    collectionName: 'Horizon Collection',
    price: '0.5',
    cardTokenId: '3',
    sales24h: 15,
    volume24h: '7.5 ETH',
    verified: false,
    followerCount: 1800,
  },
  {
    id: '4',
    address: '0x4234567890abcdef1234567890abcdef12345678',
    name: 'Pixel Master',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: 'Retro and pixel art aficionado',
    collectionAddress: '0xdef1234567890abcdef1234567890abcdef12345',
    collectionName: 'Pixel Collection',
    price: '0.35',
    cardTokenId: '4',
    sales24h: 22,
    volume24h: '7.7 ETH',
    verified: true,
    followerCount: 4100,
  },
  {
    id: '5',
    address: '0x5234567890abcdef1234567890abcdef12345678',
    name: 'Abstract Mind',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    bio: 'Exploring abstract concepts through digital art',
    collectionAddress: '0xef1234567890abcdef1234567890abcdef123456',
    collectionName: 'Abstract Collection',
    price: '0.9',
    cardTokenId: '5',
    sales24h: 10,
    volume24h: '9.0 ETH',
    verified: true,
    followerCount: 2900,
  },
  {
    id: '6',
    address: '0x6234567890abcdef1234567890abcdef12345678',
    name: 'Color Wave',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    bio: 'Generative art using color algorithms',
    collectionAddress: '0xf1234567890abcdef1234567890abcdef1234567',
    collectionName: 'Color Collection',
    price: '0.6',
    cardTokenId: '6',
    sales24h: 18,
    volume24h: '10.8 ETH',
    verified: false,
    followerCount: 2100,
  },
  {
    id: '7',
    address: '0x7234567890abcdef1234567890abcdef12345678',
    name: 'Metaverse Builder',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: '3D assets and metaverse content creator',
    collectionAddress: '0x01234567890abcdef1234567890abcdef123456',
    collectionName: 'Metaverse Collection',
    price: '1.5',
    cardTokenId: '7',
    sales24h: 5,
    volume24h: '7.5 ETH',
    verified: true,
    followerCount: 3600,
  },
  {
    id: '8',
    address: '0x8234567890abcdef1234567890abcdef12345678',
    name: 'Minimal Mind',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    bio: 'Minimalist design and clean aesthetics',
    collectionAddress: '0x11234567890abcdef1234567890abcdef123456',
    collectionName: 'Minimal Collection',
    price: '0.45',
    cardTokenId: '8',
    sales24h: 20,
    volume24h: '9.0 ETH',
    verified: false,
    followerCount: 1500,
  },
];

/**
 * GET /api/creators
 * Fetch all creators with optional filtering and search
 * Uses database first, falls back to mock data if DB unavailable
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, sort } = req.query;

    // Try to fetch from database first
    let query = supabase
      .from('artists')
      .select('*');

    // Filter by verified status
    if (category === 'verified') {
      query = query.eq('verified', true);
    } else if (category === 'trending') {
      // trending = creators with high sales in 24h
      query = query.gt('sales24h', 10);
    } else if (category === 'affordable') {
      // affordable = price < 10
      query = query.lt('price', 10);
    }

    // Search by name or bio
    if (search && typeof search === 'string') {
      query = query.or(
        `name.ilike.%${search}%,bio.ilike.%${search}%`
      );
    }

    // Sorting
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'price-low') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price-high') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('follower_count', { ascending: false });
    }

    const { data: creators, error } = await query;

    if (error) {
      console.warn('Database error, using fallback mock data:', error.message);
      // Fallback to mock data if database fails
      let fallbackdata = [...fallbackCreators];

      if (category === 'verified') {
        fallbackdata = fallbackdata.filter(c => c.verified);
      } else if (category === 'trending') {
        fallbackdata = fallbackdata.filter(c => (c.sales24h || 0) > 10);
      } else if (category === 'affordable') {
        fallbackdata = fallbackdata.filter(c => parseFloat(c.price || '0') < 10);
      }

      if (search && typeof search === 'string') {
        const query = search.toLowerCase();
        fallbackdata = fallbackdata.filter(
          c =>
            c.name.toLowerCase().includes(query) ||
            c.bio.toLowerCase().includes(query)
        );
      }

      if (sort === 'newest') {
        fallbackdata = fallbackdata.reverse();
      } else if (sort === 'price-low') {
        fallbackdata.sort((a, b) => parseFloat(a.price || '0') - parseFloat(b.price || '0'));
      } else if (sort === 'price-high') {
        fallbackdata.sort((a, b) => parseFloat(b.price || '0') - parseFloat(a.price || '0'));
      }

      return res.json(fallbackdata);
    }

    return res.json(creators || []);
  } catch (error) {
    console.error('Error fetching creators:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch creators',
    });
  }
});


/**
 * GET /api/creators/:id
 * Fetch a specific creator from database
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try database first
    const { data: creator, error } = await supabase
      .from('artists')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, try fallback
      throw error;
    }

    if (creator) {
      return res.json(creator);
    }

    // Fallback to mock data
    const fallbackCreator = fallbackCreators.find(c => c.id === id);
    if (!fallbackCreator) {
      return res.status(404).json({ message: 'Creator not found' });
    }

    return res.json(fallbackCreator);
  } catch (error) {
    console.error('Error fetching creator:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch creator',
    });
  }
});


/**
 * GET /api/creators/trending/list
 * Get trending creators sorted by sales in last 24h
 */
router.get('/trending/list', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10'), 50);

    const { data: trending, error } = await supabase
      .from('artists')
      .select('*')
      .gt('sales24h', 0)
      .order('sales24h', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Using fallback trending creators');
      const fallbacktrending = fallbackCreators
        .sort((a, b) => (b.sales24h || 0) - (a.sales24h || 0))
        .slice(0, limit);
      return res.json(fallbacktrending);
    }

    return res.json(trending || []);
  } catch (error) {
    console.error('Error fetching trending creators:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch trending creators',
    });
  }
});


/**
 * GET /api/creators/featured/list
 * Get featured (verified) creators
 */
router.get('/featured/list', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10'), 50);

    const { data: featured, error } = await supabase
      .from('artists')
      .select('*')
      .eq('verified', true)
      .order('follower_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Using fallback featured creators');
      const fallbackfeatured = fallbackCreators
        .filter(c => c.verified)
        .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
        .slice(0, limit);
      return res.json(fallbackfeatured);
    }

    return res.json(featured || []);
  } catch (error) {
    console.error('Error fetching featured creators:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch featured creators',
    });
  }
});


/**
 * POST /api/creators/batch
 * Get multiple creators by address from database
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { addresses } = req.body;

    if (!Array.isArray(addresses)) {
      return res.status(400).json({ message: 'addresses must be an array' });
    }

    // Normalize addresses to lowercase
    const normalizedAddresses = addresses.map(a => a.toLowerCase());

    const { data: creators, error } = await supabase
      .from('artists')
      .select('*')
      .in('address', normalizedAddresses);

    if (error) {
      console.warn('Using fallback batch creators');
      const fallbackCreators_batch = fallbackCreators.filter(c =>
        normalizedAddresses.some(
          addr => addr === c.address.toLowerCase()
        )
      );
      return res.json(fallbackCreators_batch);
    }

    return res.json(creators || []);
  } catch (error) {
    console.error('Error fetching creators in batch:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch creators',
    });
  }
});


export default router;
