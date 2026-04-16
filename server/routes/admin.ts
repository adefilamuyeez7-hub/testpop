import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

const router = Router();

/**
 * GET /api/admin/dashboard/stats
 * Fetch real-time dashboard statistics from database
 */
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    // Fetch user counts
    const { data: usersData, count: totalUsersCount } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { data: activeUsersData } = await supabase
      .from('users')
      .select('id')
      .gte('last_active_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Fetch creator counts
    const { data: creatorsData, count: totalCreatorsCount } = await supabase
      .from('artists')
      .select('id', { count: 'exact' });

    const { data: activeCreatorsData } = await supabase
      .from('artists')
      .select('id')
      .gte('last_active_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Fetch product counts
    const { count: totalProductsCount } = await supabase
      .from('products')
      .select('id', { count: 'exact' });

    // Fetch active auctions
    const { count: activeAuctionsCount } = await supabase
      .from('auctions')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    // Fetch gift counts
    const { count: totalGiftsCount } = await supabase
      .from('gifts')
      .select('id', { count: 'exact' });

    // Fetch volume data
    const { data: volumeData } = await supabase
      .from('transactions')
      .select('amount, type, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Calculate summary statistics
    const totalVolume = volumeData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const platformFees = totalVolume * 0.025; // Assuming 2.5% fee
    const creatorPayouts = totalVolume - platformFees;

    // Fetch today's transactions
    const { count: ordersToday } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('type', 'product_purchase')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    const { count: auctionsToday } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('type', 'auction_bid')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    const { count: giftsToday } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('type', 'gift_send')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    return res.json({
      totalUsers: totalUsersCount || 0,
      activeUsers: activeUsersData?.length || 0,
      totalCreators: totalCreatorsCount || 0,
      activeCreators: activeCreatorsData?.length || 0,
      totalProducts: totalProductsCount || 0,
      activeAuctions: activeAuctionsCount || 0,
      totalGifts: totalGiftsCount || 0,
      totalVolume: parseFloat((totalVolume / 1e18).toFixed(2)), // Convert from Wei assuming ETH
      platformFees: parseFloat((platformFees / 1e18).toFixed(2)),
      creatorPayouts: parseFloat((creatorPayouts / 1e18).toFixed(2)),
      ordersToday: ordersToday || 0,
      auctionsToday: auctionsToday || 0,
      giftsToday: giftsToday || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return fallback stats if database fails
    return res.status(500).json({
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
      // Returning fallback data structure
      totalUsers: 0,
      activeUsers: 0,
      totalCreators: 0,
      activeCreators: 0,
      totalProducts: 0,
      activeAuctions: 0,
      totalGifts: 0,
      totalVolume: 0,
      platformFees: 0,
      creatorPayouts: 0,
      ordersToday: 0,
      auctionsToday: 0,
      giftsToday: 0,
    });
  }
});

/**
 * GET /api/admin/dashboard/volume
 * Fetch 7-day transaction volume breakdown
 */
router.get('/dashboard/volume', async (req: Request, res: Response) => {
  try {
    const last7Days = [];
    const today = new Date();

    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

      const { data: dayData } = await supabase
        .from('transactions')
        .select('type')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const products = dayData?.filter(t => t.type === 'product_purchase').length || 0;
      const auctions = dayData?.filter(t => t.type === 'auction_bid').length || 0;
      const gifts = dayData?.filter(t => t.type === 'gift_send').length || 0;

      last7Days.push({
        date: dayName,
        products,
        auctions,
        gifts,
      });
    }

    return res.json(last7Days);
  } catch (error) {
    console.error('Error fetching volume data:', error);
    // Return fallback data
    return res.status(500).json({
      error: 'Failed to fetch volume data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/dashboard/revenue
 * Fetch 4-week revenue and fees data
 */
router.get('/dashboard/revenue', async (req: Request, res: Response) => {
  try {
    const last4Weeks = [];
    const today = new Date();

    // Generate last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { data: weekData, count } = await supabase
        .from('transactions')
        .select('amount', { count: 'exact' })
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      const revenue = weekData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const fees = revenue * 0.025; // 2.5% platform fee

      last4Weeks.push({
        date: `Week ${4 - i}`,
        revenue: Math.round(revenue / 1e18), // Convert from Wei
        fees: Math.round(fees / 1e18),
      });
    }

    return res.json(last4Weeks);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return res.status(500).json({
      error: 'Failed to fetch revenue data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
