/**
 * Notifications API Routes
 * Location: server/api/notifications.js
 */

import express from 'express';
import * as notificationService from '../services/notifications.js';
import { verifyAuthToken } from '../requestAuth.js';

const router = express.Router();

/**
 * POST /api/notifications
 * Create a notification (server-side only, requires service key)
 */
router.post('/', async (req, res) => {
  try {
    const {
      creatorId,
      creatorWallet,
      eventType,
      eventId,
      title,
      message,
      data
    } = req.body;

    // Basic validation
    if (!creatorWallet || !eventType || !eventId || !title) {
      return res.status(400).json({
        error: 'Missing required fields: creatorWallet, eventType, eventId, title'
      });
    }

    const notification = await notificationService.createNotification({
      creatorId,
      creatorWallet,
      eventType,
      eventId,
      title,
      message,
      data
    });

    res.json({ success: true, notification });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications
 * Get notifications for authenticated creator
 */
router.get('/', verifyAuthToken, async (req, res) => {
  try {
    const { wallet } = req.user;
    const { limit = 20, offset = 0, unreadOnly } = req.query;

    const notifications = await notificationService.getNotifications(wallet, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true'
    });

    const unreadCount = await notificationService.getUnreadCount(wallet);

    res.json({
      success: true,
      notifications,
      unreadCount,
      count: notifications.length
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', verifyAuthToken, async (req, res) => {
  try {
    const { wallet } = req.user;
    const count = await notificationService.getUnreadCount(wallet);
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', verifyAuthToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { wallet } = req.user;

    await notificationService.markNotificationAsRead(id, wallet);

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', verifyAuthToken, async (req, res) => {
  try {
    const { wallet, id } = req.user;

    const prefs = await notificationService.getOrCreatePreferences(id, wallet);

    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('❌ Error fetching preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences
 */
router.patch('/preferences', verifyAuthToken, async (req, res) => {
  try {
    const { wallet } = req.user;
    const updates = req.body;

    const prefs = await notificationService.updatePreferences(wallet, updates);

    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/push-subscription
 * Register web push subscription
 */
router.post('/push-subscription', verifyAuthToken, async (req, res) => {
  try {
    const { wallet } = req.user;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({ error: 'Missing subscription object' });
    }

    const result = await notificationService.registerPushSubscription(
      wallet,
      subscription
    );

    res.json({
      success: true,
      message: 'Push subscription registered',
      subscription: result
    });
  } catch (error) {
    console.error('❌ Error registering push subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
