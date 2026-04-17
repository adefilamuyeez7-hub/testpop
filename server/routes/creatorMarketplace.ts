import express, { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// Types
interface CreatorCardListing {
  id: string;
  tokenId: string;
  creatorAddress: string;
  sellerAddress: string;
  price: string;
  listedAt: Date;
  status: 'active' | 'sold' | 'cancelled';
}

interface MarketplaceTransaction {
  id: string;
  txHash?: string;
  creatorAddress: string;
  buyer: string;
  seller: string;
  price: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  openSeaLink: string;
}

// In-memory storage (use database in production)
const listings: Map<string, CreatorCardListing> = new Map();
const transactions: MarketplaceTransaction[] = [];

/**
 * POST /api/creator-marketplace/buy
 * Buy a creator card
 */
router.post('/buy', async (req: Request, res: Response) => {
  try {
    const { creatorAddress, buyerAddress, price } = req.body;

    // Validate inputs
    if (!ethers.isAddress(creatorAddress) || !ethers.isAddress(buyerAddress)) {
      return res.status(400).json({ message: 'Invalid addresses' });
    }

    if (creatorAddress.toLowerCase() === buyerAddress.toLowerCase()) {
      return res.status(400).json({ message: 'Cannot buy from yourself' });
    }

    // Parse price to verify it's valid
    const priceEth = parseFloat(price);
    if (isNaN(priceEth) || priceEth <= 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }

    const listing = Array.from(listings.values()).find(
      (l) =>
        l.creatorAddress.toLowerCase() === creatorAddress.toLowerCase() &&
        l.status === 'active'
    );

    if (!listing) {
      return res.status(404).json({ message: 'No active listing found for this creator card' });
    }

    if (String(listing.price) !== String(price)) {
      return res.status(409).json({ message: 'Listing price no longer matches the requested price' });
    }

    // Create transaction record
    const transaction: MarketplaceTransaction = {
      id: `tx-${Date.now()}`,
      creatorAddress,
      buyer: buyerAddress,
      seller: listing.sellerAddress,
      price,
      timestamp: new Date(),
      status: 'pending',
      openSeaLink: `https://opensea.io/assets/ethereum/${creatorAddress.toLowerCase()}/${listing.tokenId}`,
    };

    transactions.push(transaction);

    // Update listing status
    listing.status = 'sold';

    // In production, would:
    // 1. Call smart contract for NFT transfer
    // 2. Process payment via Web3
    // 3. Update database

    return res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Error in buy endpoint:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to complete purchase',
    });
  }
});

/**
 * POST /api/creator-marketplace/list
 * List a creator card for sale
 */
router.post('/list', async (req: Request, res: Response) => {
  try {
    const { tokenId, sellerAddress, price } = req.body;

    // Validate inputs
    if (!ethers.isAddress(sellerAddress)) {
      return res.status(400).json({ message: 'Invalid seller address' });
    }

    const priceEth = parseFloat(price);
    if (isNaN(priceEth) || priceEth <= 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }

    // Create listing
    const listing: CreatorCardListing = {
      id: `listing-${Date.now()}`,
      tokenId,
      creatorAddress: sellerAddress,
      sellerAddress,
      price,
      listedAt: new Date(),
      status: 'active',
    };

    listings.set(listing.id, listing);

    // In production, would call smart contract to approve listing

    return res.json({
      success: true,
      listing,
    });
  } catch (error) {
    console.error('Error in list endpoint:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to list card',
    });
  }
});

/**
 * DELETE /api/creator-marketplace/listings/:listingId
 * Cancel a listing
 */
router.delete('/listings/:listingId', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { sellerAddress } = req.body;

    const listing = listings.get(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    if (listing.sellerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    listing.status = 'cancelled';

    return res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to cancel listing',
    });
  }
});

/**
 * GET /api/creator-marketplace/stats
 * Get overall marketplace statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const activeListings = Array.from(listings.values()).filter(
      l => l.status === 'active'
    );

    // Calculate stats
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = transactions.filter(
      t => t.timestamp > last24h && t.status === 'confirmed'
    );

    const volume24h = recentTransactions.reduce(
      (sum, tx) => sum + parseFloat(tx.price),
      0
    );

    const floorPrice =
      activeListings.length > 0
        ? Math.min(...activeListings.map(l => parseFloat(l.price))).toFixed(4)
        : null;

    return res.json({
      totalListings: activeListings.length,
      floorPrice,
      volume24h: volume24h.toFixed(4),
      sales24h: recentTransactions.length,
      owners: Array.from(new Set(transactions.map(t => t.buyer))).length,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch stats',
    });
  }
});

/**
 * GET /api/creator-marketplace/history
 * Get transaction history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
    const history = transactions.slice(-limit).reverse();
    return res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch history',
    });
  }
});

/**
 * GET /api/creator-marketplace/user/:address/cards
 * Fetch user's creator card holdings
 */
router.get('/user/:address/cards', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    // Find all transactions where user is buyer and status is confirmed
    const userCards = transactions
      .filter(
        t =>
          t.buyer.toLowerCase() === address.toLowerCase() &&
          t.status === 'confirmed'
      )
      .map(t => ({
        tokenId: `${t.creatorAddress}-nft`,
        creatorAddress: t.creatorAddress,
        acquiredAt: t.timestamp,
        price: t.price,
      }));

    return res.json(userCards);
  } catch (error) {
    console.error('Error fetching user cards:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch user cards',
    });
  }
});

/**
 * GET /api/creator-marketplace/user/:address/listings
 * Fetch user's active listings
 */
router.get('/user/:address/listings', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    const userListings = Array.from(listings.values()).filter(
      l =>
        l.sellerAddress.toLowerCase() === address.toLowerCase() &&
        l.status === 'active'
    );

    return res.json(userListings);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch listings',
    });
  }
});

/**
 * GET /api/creator-marketplace/info/:creatorAddress
 * Get marketplace info for a specific creator card
 */
router.get('/info/:creatorAddress', async (req: Request, res: Response) => {
  try {
    const { creatorAddress } = req.params;

    if (!ethers.isAddress(creatorAddress)) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    // Find active listing for this creator
    const listing = Array.from(listings.values()).find(
      l =>
        l.creatorAddress.toLowerCase() === creatorAddress.toLowerCase() &&
        l.status === 'active'
    );

    // Get transaction history for this creator
    const creatorTransactions = transactions.filter(
      t =>
        t.creatorAddress.toLowerCase() === creatorAddress.toLowerCase() &&
        t.status === 'confirmed'
    );

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sales24h = creatorTransactions.filter(
      t => t.timestamp > last24h
    ).length;

    const volume24h = creatorTransactions
      .filter(t => t.timestamp > last24h)
      .reduce((sum, tx) => sum + parseFloat(tx.price), 0);

    return res.json({
      creatorAddress,
      tokenId: listing?.tokenId || null,
      floorPrice: listing?.price || null,
      volume24h: volume24h.toFixed(4),
      sales24h,
      totalSales: creatorTransactions.length,
      owners: Array.from(
        new Set(creatorTransactions.map(t => t.buyer))
      ),
      isListed: !!listing && listing.status === 'active',
      openSeaUrl: listing
        ? `https://opensea.io/assets/ethereum/${creatorAddress.toLowerCase()}/${listing.tokenId}`
        : null,
    });
  } catch (error) {
    console.error('Error fetching creator card info:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch card info',
    });
  }
});

/**
 * GET /api/creator-marketplace/collection/stats
 * Get collection-wide statistics
 */
router.get('/collection/stats', async (req: Request, res: Response) => {
  try {
    const activeListings = Array.from(listings.values()).filter(
      l => l.status === 'active'
    );

    const confirmedTransactions = transactions.filter(
      t => t.status === 'confirmed'
    );

    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const volume7d = confirmedTransactions
      .filter(t => t.timestamp > last7d)
      .reduce((sum, tx) => sum + parseFloat(tx.price), 0);

    return res.json({
      totalCreators: activeListings.length,
      totalListings: activeListings.length,
      floorPrice:
        activeListings.length > 0
          ? Math.min(...activeListings.map(l => parseFloat(l.price))).toFixed(4)
          : null,
      volume7d: volume7d.toFixed(4),
      totalVolume: confirmedTransactions
        .reduce((sum, tx) => sum + parseFloat(tx.price), 0)
        .toFixed(4),
      totalSales: confirmedTransactions.length,
      uniqueOwners: Array.from(
        new Set(confirmedTransactions.map(t => t.buyer))
      ).length,
      lastSale:
        confirmedTransactions.length > 0
          ? confirmedTransactions[confirmedTransactions.length - 1].timestamp
          : null,
    });
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch stats',
    });
  }
});

export default router;
