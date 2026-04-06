/**
 * Notifications Service
 * Handles all notification operations: creation, delivery, preferences
 * Location: server/services/notifications.js
 */

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Create a notification for a creator
 */
async function createNotification({
  creatorId,
  creatorWallet,
  eventType, // 'subscription' | 'purchase'
  eventId, // unique identifier to prevent duplicates (tx hash or order id)
  title,
  message,
  data = {}
}) {
  try {
    // Check for duplicate event
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existing) {
      console.log(`🔔 Notification already exists for event: ${eventId}`);
      return existing;
    }

    // Get creator preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('creator_wallet', creatorWallet)
      .single();

    // Check if creator wants this type of notification
    if (prefs) {
      if (eventType === 'subscription' && !prefs.notify_subscriptions) {
        console.log(`⏭️  Skipping subscription notification (disabled by creator)`);
        return null;
      }
      if (eventType === 'purchase' && !prefs.notify_purchases) {
        console.log(`⏭️  Skipping purchase notification (disabled by creator)`);
        return null;
      }
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        creator_id: creatorId,
        creator_wallet: creatorWallet,
        event_type: eventType,
        event_id: eventId,
        title,
        message,
        interactor_wallet: data.interactorWallet,
        interactor_display_name: data.interactorName,
        product_id: data.productId,
        product_name: data.productName,
        amount_eth: data.amountEth,
        quantity: data.quantity,
        action_url: data.actionUrl,
        metadata: data
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }

    console.log(`✅ Created ${eventType} notification for ${creatorWallet}`);

    // Route to delivery channels
    await deliverNotification(notification, prefs);

    return notification;
  } catch (error) {
    console.error('❌ createNotification error:', error);
    throw error;
  }
}

/**
 * Deliver notification via preferred channels
 */
async function deliverNotification(notification, prefs) {
  try {
    const deliveryTasks = [];

    // In-app notification (always available)
    if (!prefs || prefs.enable_in_app) {
      deliveryTasks.push(
        logDelivery(notification.id, 'in_app', 'sent')
          .catch(err => console.error('Error logging in-app delivery:', err))
      );
    }

    // Web push notification
    if (!prefs || prefs.enable_web_push) {
      deliveryTasks.push(
        deliverWebPush(notification)
          .catch(err => console.error('Error delivering web push:', err))
      );
    }

    // Email notification (skip for now, user doesn't want email)
    // if (prefs?.enable_email && prefs.email_address) {
    //   deliveryTasks.push(
    //     deliverEmail(notification, prefs.email_address)
    //   );
    // }

    await Promise.allSettled(deliveryTasks);
  } catch (error) {
    console.error('❌ Error in deliverNotification:', error);
  }
}

/**
 * Log delivery attempt
 */
async function logDelivery(notificationId, channel, status, error = null) {
  try {
    await supabase.from('notification_delivery_log').insert({
      notification_id: notificationId,
      channel,
      status,
      error_message: error?.message
    });
  } catch (err) {
    console.error('Error logging delivery:', err);
  }
}

/**
 * Send web push notification
 */
async function deliverWebPush(notification) {
  try {
    // Get all push subscriptions for the creator
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('creator_wallet', notification.creator_wallet)
      .eq('active', true);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`⏭️  No push subscriptions for ${notification.creator_wallet}`);
      return;
    }

    const pushPayload = {
      title: notification.title,
      body: notification.message,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `notification-${notification.id}`,
      requireInteraction: true,
      data: {
        notificationId: notification.id,
        eventType: notification.event_type,
        actionUrl: notification.action_url
      }
    };

    const sendTasks = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(pushPayload));
        await logDelivery(notification.id, 'web_push', 'sent');
        console.log(`✅ Web push sent to ${notification.creator_wallet}`);
      } catch (error) {
        if (error.statusCode === 410) {
          // Subscription expired, remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
        await logDelivery(notification.id, 'web_push', 'failed', error);
        console.error(`❌ Web push failed:`, error.message);
      }
    });

    await Promise.allSettled(sendTasks);
  } catch (error) {
    console.error('❌ Error in deliverWebPush:', error);
  }
}

/**
 * Get notifications for a creator
 */
async function getNotifications(creatorWallet, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('creator_wallet', creatorWallet)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId, creatorWallet) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('creator_wallet', creatorWallet);

    if (error) throw error;
    console.log(`✅ Marked notification ${notificationId} as read`);
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(creatorWallet) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('creator_wallet', creatorWallet)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get or create notification preferences
 */
async function getOrCreatePreferences(creatorId, creatorWallet) {
  try {
    let { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('creator_wallet', creatorWallet)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found, create default preferences
      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({
          creator_id: creatorId,
          creator_wallet: creatorWallet,
          notify_subscriptions: true,
          notify_purchases: true,
          enable_in_app: true,
          enable_web_push: true,
          digest_frequency: 'real_time'
        })
        .select()
        .single();

      if (createError) throw createError;
      prefs = newPrefs;
    } else if (error) {
      throw error;
    }

    return prefs;
  } catch (error) {
    console.error('❌ Error getting/creating preferences:', error);
    throw error;
  }
}

/**
 * Update notification preferences
 */
async function updatePreferences(creatorWallet, updates) {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('creator_wallet', creatorWallet)
      .select()
      .single();

    if (error) throw error;
    console.log(`✅ Updated notification preferences for ${creatorWallet}`);
    return data;
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    throw error;
  }
}

/**
 * Register push subscription
 */
async function registerPushSubscription(creatorWallet, subscription) {
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('creator_wallet', creatorWallet)
      .eq('subscription', JSON.stringify(subscription))
      .single();

    if (existing) {
      console.log(`ℹ️  Push subscription already registered`);
      return existing;
    }

    // Insert new subscription
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        creator_wallet: creatorWallet,
        subscription,
        active: true
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`✅ Registered push subscription for ${creatorWallet}`);
    return data;
  } catch (error) {
    console.error('❌ Error registering push subscription:', error);
    throw error;
  }
}

export {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  getUnreadCount,
  getOrCreatePreferences,
  updatePreferences,
  registerPushSubscription,
  deliverWebPush
};
