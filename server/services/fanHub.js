import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ACTIVE_ORDER_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);
const RELATIONSHIP_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_FEEDBACK_ITEM_TYPES = new Set(["drop", "product", "release"]);

function normalizeWallet(wallet = "") {
  const normalized = String(wallet || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
}

function slugifyChannelName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "channel";
}

function firstRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function toIsoFromUnixSeconds(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric * 1000).toISOString();
}

function toNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getLatestTimestamp(...values) {
  const parsed = values
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);

  if (parsed.length === 0) {
    return null;
  }

  return new Date(Math.max(...parsed)).toISOString();
}

function buildRelationshipScore(relationship) {
  const base =
    (relationship.active_subscription ? 50 : relationship.is_subscriber ? 30 : 0) +
    (relationship.is_collector ? 20 : 0) +
    (relationship.is_backer ? 25 : 0);

  const activity =
    Math.min(20, relationship.orders_count * 4) +
    Math.min(20, relationship.backed_campaigns_count * 6) +
    Math.min(15, Math.floor(relationship.total_spent_eth * 2)) +
    Math.min(15, Math.floor(relationship.total_invested_eth * 2));

  return Math.min(100, base + activity);
}

async function getArtistsByIds(artistIds) {
  if (!artistIds.length) return [];

  const { data, error } = await supabase
    .from("artists")
    .select("id, wallet, name, handle, tag, avatar_url, banner_url")
    .in("id", artistIds);

  if (error) {
    throw new Error(error.message || "Failed to load artists");
  }

  return data || [];
}

async function getStoredRelationships(wallet) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) return [];

  const { data, error } = await supabase
    .from("creator_fans")
    .select("*")
    .eq("fan_wallet", normalizedWallet)
    .order("relationship_score", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load creator fan relationships");
  }

  return data || [];
}

function areRelationshipsFresh(relationships) {
  if (!relationships.length) return false;

  return relationships.every((relationship) => {
    const updatedAt = new Date(relationship.updated_at || relationship.created_at || 0).getTime();
    return Number.isFinite(updatedAt) && Date.now() - updatedAt < RELATIONSHIP_CACHE_TTL_MS;
  });
}

async function getArtistsByWallets(wallets) {
  if (!wallets.length) return [];

  const normalizedWallets = wallets.map(normalizeWallet).filter(Boolean);
  if (!normalizedWallets.length) return [];

  const { data, error } = await supabase
    .from("artists")
    .select("id, wallet, name, handle, tag, avatar_url, banner_url")
    .in("wallet", normalizedWallets);

  if (error) {
    throw new Error(error.message || "Failed to load artists by wallet");
  }

  return data || [];
}

async function getProductsByIds(productIds) {
  if (!productIds.length) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, artist_id, creator_wallet, name, image_url, image_ipfs_uri, preview_uri, status")
    .in("id", productIds);

  if (error) {
    throw new Error(error.message || "Failed to load products");
  }

  return data || [];
}

async function getOwnedCreators(wallet) {
  const normalizedWallet = normalizeWallet(wallet);
  const { data, error } = await supabase
    .from("artists")
    .select("id, wallet, name, handle, tag, avatar_url, banner_url")
    .eq("wallet", normalizedWallet)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load owned creators");
  }

  return data || [];
}

async function ensureDefaultChannelsForArtists(artists) {
  if (!artists.length) return;

  const rows = artists.flatMap((artist) => [
    {
      artist_id: artist.id,
      slug: "updates",
      name: "Updates",
      description: "Public drops, releases, and creator updates.",
      access_level: "public",
      created_by_wallet: normalizeWallet(artist.wallet),
      is_default: true,
    },
    {
      artist_id: artist.id,
      slug: "backstage",
      name: "Backstage",
      description: "Subscriber-only notes, previews, and behind-the-scenes drops.",
      access_level: "subscriber",
      created_by_wallet: normalizeWallet(artist.wallet),
      is_default: true,
    },
  ]);

  const { error } = await supabase
    .from("creator_channels")
    .upsert(rows, {
      onConflict: "artist_id,slug",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(error.message || "Failed to ensure default channels");
  }
}

function initializeRelationship(artist) {
  return {
    artist_id: artist.id,
    artist_wallet: normalizeWallet(artist.wallet),
    artist_name: artist.name || "Untitled Creator",
    artist_handle: artist.handle || null,
    artist_tag: artist.tag || null,
    avatar_url: artist.avatar_url || null,
    banner_url: artist.banner_url || null,
    is_subscriber: false,
    active_subscription: false,
    is_collector: false,
    is_backer: false,
    subscription_expires_at: null,
    collected_releases_count: 0,
    orders_count: 0,
    total_spent_eth: 0,
    backed_campaigns_count: 0,
    total_invested_eth: 0,
    relationship_score: 0,
    last_interacted_at: null,
    source_snapshot: {
      subscriptions: [],
      orders: [],
      investments: [],
    },
  };
}

async function buildRelationshipMap(wallet) {
  const normalizedWallet = normalizeWallet(wallet);

  const [{ data: subscriptions, error: subscriptionsError }, { data: orders, error: ordersError }, { data: investments, error: investmentsError }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("artist_id, amount, expiry_time, updated_at, created_at")
        .eq("subscriber_wallet", normalizedWallet),
      supabase
        .from("orders")
        .select(`
          id,
          buyer_wallet,
          status,
          total_price_eth,
          created_at,
          paid_at,
          product_id,
          products(
            id,
            artist_id,
            creator_wallet,
            name
          ),
          order_items(
            id,
            product_id,
            quantity,
            line_total_eth,
            products(
              id,
              artist_id,
              creator_wallet,
              name
            )
          )
        `)
        .eq("buyer_wallet", normalizedWallet),
      supabase
        .from("ip_investments")
        .select("id, campaign_id, amount_eth, invested_at, created_at")
        .eq("investor_wallet", normalizedWallet),
    ]);

  if (subscriptionsError) throw new Error(subscriptionsError.message || "Failed to load subscriptions");
  if (ordersError) throw new Error(ordersError.message || "Failed to load orders");
  if (investmentsError) throw new Error(investmentsError.message || "Failed to load investments");

  const campaignIds = Array.from(new Set((investments || []).map((entry) => entry.campaign_id).filter(Boolean)));
  const { data: campaigns, error: campaignsError } = campaignIds.length
    ? await supabase
        .from("ip_campaigns")
        .select("id, artist_id, title")
        .in("id", campaignIds)
    : { data: [], error: null };

  if (campaignsError) throw new Error(campaignsError.message || "Failed to load campaigns");

  const artistIds = new Set();
  const creatorWallets = new Set();

  for (const subscription of subscriptions || []) {
    if (subscription.artist_id) artistIds.add(subscription.artist_id);
  }

  for (const order of orders || []) {
    if (!ACTIVE_ORDER_STATUSES.has(String(order.status || "").toLowerCase())) continue;

    const directProduct = firstRelationRecord(order.products);
    if (directProduct?.artist_id) artistIds.add(directProduct.artist_id);
    if (directProduct?.creator_wallet) creatorWallets.add(normalizeWallet(directProduct.creator_wallet));

    for (const item of order.order_items || []) {
      const itemProduct = firstRelationRecord(item.products);
      if (itemProduct?.artist_id) artistIds.add(itemProduct.artist_id);
      if (itemProduct?.creator_wallet) creatorWallets.add(normalizeWallet(itemProduct.creator_wallet));
    }
  }

  for (const campaign of campaigns || []) {
    if (campaign.artist_id) artistIds.add(campaign.artist_id);
  }

  const [artistsByIdRows, artistsByWalletRows] = await Promise.all([
    getArtistsByIds(Array.from(artistIds)),
    getArtistsByWallets(Array.from(creatorWallets)),
  ]);

  const artistsById = new Map(artistsByIdRows.map((artist) => [artist.id, artist]));
  const artistsByWallet = new Map(
    artistsByWalletRows.map((artist) => [normalizeWallet(artist.wallet), artist]),
  );

  const relationships = new Map();

  const ensureArtistRelationship = (artistId, creatorWallet = "") => {
    const artist =
      artistsById.get(artistId) ||
      artistsByWallet.get(normalizeWallet(creatorWallet || "")) ||
      null;

    if (!artist) return null;
    if (!relationships.has(artist.id)) {
      relationships.set(artist.id, initializeRelationship(artist));
    }

    return relationships.get(artist.id);
  };

  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const subscription of subscriptions || []) {
    const relationship = ensureArtistRelationship(subscription.artist_id);
    if (!relationship) continue;

    relationship.is_subscriber = true;
    relationship.active_subscription = Number(subscription.expiry_time || 0) > nowSeconds;
    relationship.subscription_expires_at = toIsoFromUnixSeconds(subscription.expiry_time);
    relationship.last_interacted_at = getLatestTimestamp(
      relationship.last_interacted_at,
      toIsoFromUnixSeconds(subscription.expiry_time),
      subscription.updated_at,
      subscription.created_at,
    );
    relationship.source_snapshot.subscriptions.push({
      amount: toNumber(subscription.amount),
      expiry_time: subscription.expiry_time,
    });
  }

  for (const order of orders || []) {
    if (!ACTIVE_ORDER_STATUSES.has(String(order.status || "").toLowerCase())) continue;

    const orderTimestamp = order.paid_at || order.created_at || new Date().toISOString();
    const directProduct = firstRelationRecord(order.products);
    const normalizedItems =
      Array.isArray(order.order_items) && order.order_items.length > 0
        ? order.order_items
        : directProduct
          ? [{ id: `${order.id}:${directProduct.id || order.product_id || "direct"}`, line_total_eth: order.total_price_eth, products: directProduct }]
          : [];

    const uniqueProducts = new Set();

    for (const item of normalizedItems) {
      const itemProduct = firstRelationRecord(item.products);
      const resolvedArtistId =
        itemProduct?.artist_id ||
        artistsByWallet.get(normalizeWallet(itemProduct?.creator_wallet || ""))?.id ||
        null;

      const relationship = ensureArtistRelationship(resolvedArtistId, itemProduct?.creator_wallet || "");
      if (!relationship) continue;

      relationship.is_collector = true;
      relationship.orders_count += 1;
      relationship.total_spent_eth += toNumber(item.line_total_eth || order.total_price_eth);
      relationship.last_interacted_at = getLatestTimestamp(
        relationship.last_interacted_at,
        orderTimestamp,
      );
      if (itemProduct?.id) {
        uniqueProducts.add(itemProduct.id);
      }
      relationship.source_snapshot.orders.push({
        order_id: order.id,
        product_id: itemProduct?.id || null,
        amount_eth: toNumber(item.line_total_eth || order.total_price_eth),
      });
    }

    for (const relationship of relationships.values()) {
      if (relationship.source_snapshot.orders.some((entry) => entry.order_id === order.id)) {
        relationship.collected_releases_count += uniqueProducts.size || 1;
      }
    }
  }

  for (const investment of investments || []) {
    const campaign = (campaigns || []).find((entry) => entry.id === investment.campaign_id);
    if (!campaign?.artist_id) continue;

    const relationship = ensureArtistRelationship(campaign.artist_id);
    if (!relationship) continue;

    relationship.is_backer = true;
    relationship.backed_campaigns_count += 1;
    relationship.total_invested_eth += toNumber(investment.amount_eth);
    relationship.last_interacted_at = getLatestTimestamp(
      relationship.last_interacted_at,
      investment.invested_at,
      investment.created_at,
    );
    relationship.source_snapshot.investments.push({
      campaign_id: investment.campaign_id,
      amount_eth: toNumber(investment.amount_eth),
      title: campaign.title || null,
    });
  }

  const records = Array.from(relationships.values())
    .map((relationship) => ({
      ...relationship,
      relationship_score: buildRelationshipScore(relationship),
    }))
    .sort((left, right) => right.relationship_score - left.relationship_score);

  if (records.length > 0) {
    const upsertRows = records.map((relationship) => ({
      artist_id: relationship.artist_id,
      fan_wallet: normalizedWallet,
      is_subscriber: relationship.is_subscriber,
      active_subscription: relationship.active_subscription,
      is_collector: relationship.is_collector,
      is_backer: relationship.is_backer,
      subscription_expires_at: relationship.subscription_expires_at,
      collected_releases_count: relationship.collected_releases_count,
      orders_count: relationship.orders_count,
      total_spent_eth: relationship.total_spent_eth,
      backed_campaigns_count: relationship.backed_campaigns_count,
      total_invested_eth: relationship.total_invested_eth,
      relationship_score: relationship.relationship_score,
      last_interacted_at: relationship.last_interacted_at,
      source_snapshot: relationship.source_snapshot,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("creator_fans")
      .upsert(upsertRows, { onConflict: "artist_id,fan_wallet" });

    if (upsertError) {
      throw new Error(upsertError.message || "Failed to sync creator fan relationships");
    }
  }

  return records;
}

function canAccessChannel(channel, relationship) {
  if (!channel) return false;
  if (channel.access_level === "public") return true;
  if (!relationship) return false;
  if (channel.access_level === "fan") return true;
  if (channel.access_level === "subscriber") return relationship.active_subscription;
  if (channel.access_level === "collector") return relationship.is_collector;
  if (channel.access_level === "backer") return relationship.is_backer;
  return false;
}

async function getChannelsForOverview(wallet, ownedCreators, relationships) {
  const ownedArtistIds = new Set(ownedCreators.map((artist) => artist.id));
  const relationshipsByArtistId = new Map(relationships.map((entry) => [entry.artist_id, entry]));
  const relationshipArtistIds = relationships.map((entry) => entry.artist_id);

  const publicQuery = supabase
    .from("creator_channels")
    .select("*")
    .eq("access_level", "public")
    .order("created_at", { ascending: true });

  const creatorQuery = relationshipArtistIds.length || ownedArtistIds.size
    ? supabase
        .from("creator_channels")
        .select("*")
        .in("artist_id", Array.from(new Set([...relationshipArtistIds, ...ownedArtistIds])))
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const [{ data: publicChannels, error: publicError }, { data: relatedChannels, error: relatedError }] =
    await Promise.all([publicQuery, creatorQuery]);

  if (publicError) throw new Error(publicError.message || "Failed to load public channels");
  if (relatedError) throw new Error(relatedError.message || "Failed to load related channels");

  const merged = new Map();
  for (const channel of [...(publicChannels || []), ...(relatedChannels || [])]) {
    merged.set(channel.id, channel);
  }

  return Array.from(merged.values()).filter((channel) => {
    if (ownedArtistIds.has(channel.artist_id)) return true;
    return canAccessChannel(channel, relationshipsByArtistId.get(channel.artist_id));
  });
}

async function getRecentPosts(channels, artistsById) {
  const channelIds = channels.map((channel) => channel.id);
  if (!channelIds.length) return [];

  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .in("channel_id", channelIds)
    .order("published_at", { ascending: false })
    .limit(24);

  if (error) {
    throw new Error(error.message || "Failed to load creator posts");
  }

  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));

  return (data || []).map((post) => ({
    ...post,
    channel: channelsById.get(post.channel_id) || null,
    artist: artistsById.get(post.artist_id) || null,
  }));
}

async function getThreadsForWallet(wallet, artistsById) {
  const normalizedWallet = normalizeWallet(wallet);
  const { data: threads, error } = await supabase
    .from("creator_threads")
    .select("*")
    .or(`creator_wallet.eq.${normalizedWallet},fan_wallet.eq.${normalizedWallet}`)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load threads");
  }

  const threadIds = (threads || []).map((thread) => thread.id);
  const { data: messages, error: messagesError } = threadIds.length
    ? await supabase
        .from("creator_thread_messages")
        .select("id, thread_id, sender_wallet, sender_role, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (messagesError) {
    throw new Error(messagesError.message || "Failed to load latest messages");
  }

  const latestMessageByThreadId = new Map();
  for (const message of messages || []) {
    if (!latestMessageByThreadId.has(message.thread_id)) {
      latestMessageByThreadId.set(message.thread_id, message);
    }
  }

  return (threads || []).map((thread) => ({
    ...thread,
    artist: artistsById.get(thread.artist_id) || null,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  }));
}

async function getRelationshipSnapshot(wallet, artistId) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet || !artistId) return null;

  const { data, error } = await supabase
    .from("creator_fans")
    .select("*")
    .eq("artist_id", artistId)
    .eq("fan_wallet", normalizedWallet)
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  const records = await buildRelationshipMap(normalizedWallet);
  return records.find((entry) => entry.artist_id === artistId) || null;
}

async function getCollectedOrderItemForWalletProduct(wallet, productId) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet || !productId) return null;

  const { data, error } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      product_id,
      quantity,
      line_total_eth,
      created_at,
      orders!inner(
        id,
        buyer_wallet,
        status,
        paid_at,
        created_at
      )
    `)
    .eq("product_id", productId)
    .eq("orders.buyer_wallet", normalizedWallet)
    .in("orders.status", Array.from(ACTIVE_ORDER_STATUSES))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify product ownership");
  }

  return data || null;
}

async function getProductFeedbackThreadsForWallet(wallet, artistsById) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) return [];

  const { data: threads, error } = await supabase
    .from("product_feedback_threads")
    .select("*")
    .or(`creator_wallet.eq.${normalizedWallet},buyer_wallet.eq.${normalizedWallet}`)
    .order("subscriber_priority", { ascending: false })
    .order("featured", { ascending: false })
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load feedback threads");
  }

  const threadIds = (threads || []).map((thread) => thread.id);
  const productIds = Array.from(new Set((threads || []).map((thread) => thread.product_id).filter(Boolean)));
  const itemReferences = (threads || []).map((thread) => ({
    item_id: thread.item_id || thread.product_id,
    item_type: thread.item_type || "product",
  }));

  const [{ data: messages, error: messagesError }, products, catalogItemsByKey] = await Promise.all([
    threadIds.length
      ? supabase
          .from("product_feedback_messages")
          .select("id, thread_id, sender_wallet, sender_role, body, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    getProductsByIds(productIds),
    getCatalogItemsByReferences(itemReferences),
  ]);

  if (messagesError) {
    throw new Error(messagesError.message || "Failed to load feedback messages");
  }

  const latestMessageByThreadId = new Map();
  for (const message of messages || []) {
    if (!latestMessageByThreadId.has(message.thread_id)) {
      latestMessageByThreadId.set(message.thread_id, message);
    }
  }

  const productsById = new Map(products.map((product) => [product.id, product]));

  return (threads || []).map((thread) => ({
    ...thread,
    artist: artistsById.get(thread.artist_id) || null,
    product: productsById.get(thread.product_id) || null,
    catalog_item:
      catalogItemsByKey.get(`${thread.item_type || "product"}:${thread.item_id || thread.product_id}`) || null,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  }));
}

export async function getFanHubOverview(wallet) {
  const ownedCreators = await getOwnedCreators(wallet);
  await ensureDefaultChannelsForArtists(ownedCreators);

  const storedRelationships = await getStoredRelationships(wallet);
  const relationships = areRelationshipsFresh(storedRelationships)
    ? storedRelationships
    : await buildRelationshipMap(wallet);
  const artistIds = Array.from(new Set([
    ...ownedCreators.map((artist) => artist.id),
    ...relationships.map((relationship) => relationship.artist_id),
  ]));
  const artists = await getArtistsByIds(artistIds);
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
  const channels = await getChannelsForOverview(wallet, ownedCreators, relationships);
  const recentPosts = await getRecentPosts(channels, artistsById);
  const threads = await getThreadsForWallet(wallet, artistsById);
  const feedbackThreads = await getProductFeedbackThreadsForWallet(wallet, artistsById);

  return {
    wallet: normalizeWallet(wallet),
    owned_creators: ownedCreators,
    relationships,
    channels,
    recent_posts: recentPosts,
    threads,
    feedback_threads: feedbackThreads,
    unread_counts: {
      posts: recentPosts.length,
      threads: threads.filter((thread) => thread.status === "open").length,
      feedback: feedbackThreads.filter((thread) => thread.status === "open").length,
    },
  };
}

export async function createChannel({ wallet, artistId, name, description, accessLevel }) {
  const ownedCreators = await getOwnedCreators(wallet);
  const ownedCreator = ownedCreators.find((artist) => artist.id === artistId);
  if (!ownedCreator) {
    throw new Error("Only the creator can create channels for this artist.");
  }

  const normalizedWallet = normalizeWallet(wallet);
  const slugBase = slugifyChannelName(name);
  const { data: existingChannels } = await supabase
    .from("creator_channels")
    .select("slug")
    .eq("artist_id", artistId)
    .ilike("slug", `${slugBase}%`);

  const taken = new Set((existingChannels || []).map((channel) => channel.slug));
  let slug = slugBase;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabase
    .from("creator_channels")
    .insert({
      artist_id: artistId,
      slug,
      name: String(name || "").trim(),
      description: String(description || "").trim() || null,
      access_level: accessLevel,
      created_by_wallet: normalizedWallet,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create creator channel");
  }

  return data;
}

export async function createPost({ wallet, artistId, channelId, title, body, postKind }) {
  const ownedCreators = await getOwnedCreators(wallet);
  const ownedCreator = ownedCreators.find((artist) => artist.id === artistId);
  if (!ownedCreator) {
    throw new Error("Only the creator can publish posts for this artist.");
  }

  const { data: channel, error: channelError } = await supabase
    .from("creator_channels")
    .select("*")
    .eq("id", channelId)
    .eq("artist_id", artistId)
    .single();

  if (channelError || !channel) {
    throw new Error(channelError?.message || "Channel not found");
  }

  const { data, error } = await supabase
    .from("creator_posts")
    .insert({
      channel_id: channelId,
      artist_id: artistId,
      author_wallet: normalizeWallet(wallet),
      title: String(title || "").trim() || null,
      body: String(body || "").trim(),
      post_kind: postKind,
      published_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create creator post");
  }

  return data;
}

async function getArtistById(artistId) {
  const { data, error } = await supabase
    .from("artists")
    .select("id, wallet, name, handle, tag, avatar_url, banner_url")
    .eq("id", artistId)
    .single();

  if (error) {
    throw new Error(error.message || "Artist not found");
  }

  return data;
}

async function getProductById(productId) {
  const { data, error } = await supabase
    .from("products")
    .select("id, artist_id, creator_wallet, name, image_url, image_ipfs_uri, preview_uri, status")
    .eq("id", productId)
    .single();

  if (error) {
    throw new Error(error.message || "Product not found");
  }

  if (data.artist_id) {
    return data;
  }

  const artists = await getArtistsByWallets([data.creator_wallet]);
  return {
    ...data,
    artist_id: artists[0]?.id || null,
  };
}

function normalizeFeedbackItemType(itemType) {
  return String(itemType || "").trim().toLowerCase();
}

function buildCatalogItemSummary(item) {
  if (!item) return null;

  return {
    id: item.id,
    item_type: item.item_type,
    title: item.title,
    description: item.description || null,
    image_url: item.image_url || null,
    price_eth: toNumber(item.price_eth),
    supply_or_stock: item.supply_or_stock ?? null,
    creator_id: item.creator_id || null,
    creator_wallet: normalizeWallet(item.creator_wallet),
    status: item.status || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
  };
}

async function getCatalogItemByType(itemType, itemId) {
  const normalizedItemType = normalizeFeedbackItemType(itemType);
  if (!SUPPORTED_FEEDBACK_ITEM_TYPES.has(normalizedItemType)) {
    throw new Error("Unsupported feedback item type.");
  }

  const { data, error } = await supabase
    .from("catalog_with_engagement")
    .select("*")
    .eq("item_type", normalizedItemType)
    .eq("id", itemId)
    .single();

  if (error) {
    throw new Error(error.message || "Catalog item not found");
  }

  return data;
}

async function getCatalogItemsByReferences(references) {
  const referencesByType = references.reduce((accumulator, reference) => {
    const normalizedType = normalizeFeedbackItemType(reference?.item_type);
    const itemId = reference?.item_id;
    if (!SUPPORTED_FEEDBACK_ITEM_TYPES.has(normalizedType) || !itemId) {
      return accumulator;
    }

    if (!accumulator[normalizedType]) {
      accumulator[normalizedType] = new Set();
    }

    accumulator[normalizedType].add(itemId);
    return accumulator;
  }, {});

  const entries = Object.entries(referencesByType);
  if (!entries.length) {
    return new Map();
  }

  const groupedResults = await Promise.all(
    entries.map(async ([itemType, itemIds]) => {
      const { data, error } = await supabase
        .from("catalog_with_engagement")
        .select("*")
        .eq("item_type", itemType)
        .in("id", Array.from(itemIds));

      if (error) {
        throw new Error(error.message || `Failed to load ${itemType} feedback items`);
      }

      return data || [];
    }),
  );

  const itemsByKey = new Map();
  for (const items of groupedResults) {
    for (const item of items) {
      itemsByKey.set(`${item.item_type}:${item.id}`, item);
    }
  }

  return itemsByKey;
}

async function getThreadById(threadId) {
  const { data, error } = await supabase
    .from("creator_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (error) {
    throw new Error(error.message || "Thread not found");
  }

  return data;
}

function canAccessThread(wallet, thread) {
  const normalizedWallet = normalizeWallet(wallet);
  return (
    normalizeWallet(thread.creator_wallet) === normalizedWallet ||
    normalizeWallet(thread.fan_wallet) === normalizedWallet
  );
}

export async function createOrOpenThread({ wallet, artistId, fanWallet, subject, body }) {
  const normalizedWallet = normalizeWallet(wallet);
  const artist = await getArtistById(artistId);
  const isCreator = normalizeWallet(artist.wallet) === normalizedWallet;
  const targetFanWallet = normalizeWallet(isCreator ? fanWallet : normalizedWallet);

  if (!targetFanWallet) {
    throw new Error("A valid fan wallet is required.");
  }

  if (targetFanWallet === normalizeWallet(artist.wallet)) {
    throw new Error("Creator and fan wallets must be different.");
  }

  let { data: thread } = await supabase
    .from("creator_threads")
    .select("*")
    .eq("artist_id", artistId)
    .eq("fan_wallet", targetFanWallet)
    .maybeSingle();

  if (!thread) {
    const insertResult = await supabase
      .from("creator_threads")
      .insert({
        artist_id: artistId,
        creator_wallet: normalizeWallet(artist.wallet),
        fan_wallet: targetFanWallet,
        subject: String(subject || "").trim() || null,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Failed to create thread");
    }

    thread = insertResult.data;
  }

  if (String(body || "").trim()) {
    await createThreadMessage({
      wallet,
      threadId: thread.id,
      body,
    });
  }

  return thread;
}

export async function broadcastCreatorThreads({ wallet, artistId, audience, subject, body }) {
  const ownedCreators = await getOwnedCreators(wallet);
  const ownedCreator = ownedCreators.find((artist) => artist.id === artistId);
  if (!ownedCreator) {
    throw new Error("Only the creator can broadcast threads for this artist.");
  }

  const normalizedAudience = String(audience || "subscribers").trim().toLowerCase();
  const messageText = String(body || "").trim();
  const subjectText = String(subject || "").trim() || null;

  if (!messageText) {
    throw new Error("Write the message you want to send.");
  }

  if (!["collectors", "subscribers", "all_fans"].includes(normalizedAudience)) {
    throw new Error("Choose collectors, subscribers, or all fans.");
  }

  let fanQuery = supabase
    .from("creator_fans")
    .select("*")
    .eq("artist_id", artistId)
    .order("relationship_score", { ascending: false });

  if (normalizedAudience === "collectors") {
    fanQuery = fanQuery.eq("is_collector", true);
  } else if (normalizedAudience === "subscribers") {
    fanQuery = fanQuery.eq("active_subscription", true);
  }

  const { data: fans, error } = await fanQuery;
  if (error) {
    throw new Error(error.message || "Failed to load eligible fans");
  }

  const recipients = (fans || [])
    .map((fan) => normalizeWallet(fan.fan_wallet))
    .filter(Boolean)
    .filter((fanWallet, index, list) => list.indexOf(fanWallet) === index);

  if (!recipients.length) {
    throw new Error("No matching fans found for this audience yet.");
  }

  const normalizedCreatorWallet = normalizeWallet(wallet);
  const threadIds = [];

  for (const fanWallet of recipients) {
    let { data: thread, error: threadError } = await supabase
      .from("creator_threads")
      .select("*")
      .eq("artist_id", artistId)
      .eq("fan_wallet", fanWallet)
      .maybeSingle();

    if (threadError) {
      throw new Error(threadError.message || "Failed to load broadcast thread");
    }

    if (!thread) {
      const insertResult = await supabase
        .from("creator_threads")
        .insert({
          artist_id: artistId,
          creator_wallet: normalizedCreatorWallet,
          fan_wallet: fanWallet,
          subject: subjectText,
          status: "open",
          metadata: {
            broadcast_audience: normalizedAudience,
            broadcast_created_at: new Date().toISOString(),
          },
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertResult.error) {
        throw new Error(insertResult.error.message || "Failed to create broadcast thread");
      }

      thread = insertResult.data;
    }

    const { data: createdMessage, error: messageError } = await supabase
      .from("creator_thread_messages")
      .insert({
        thread_id: thread.id,
        sender_wallet: normalizedCreatorWallet,
        sender_role: "creator",
        body: messageText,
        metadata: {
          broadcast: true,
          audience: normalizedAudience,
        },
      })
      .select("*")
      .single();

    if (messageError) {
      throw new Error(messageError.message || "Failed to send broadcast message");
    }

    const { error: updateError } = await supabase
      .from("creator_threads")
      .update({
        subject: subjectText || thread.subject,
        last_message_at: createdMessage.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "open",
        metadata: {
          ...(thread.metadata || {}),
          broadcast_audience: normalizedAudience,
          last_broadcast_at: createdMessage.created_at || new Date().toISOString(),
        },
      })
      .eq("id", thread.id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update broadcast thread");
    }

    threadIds.push(thread.id);
  }

  return {
    audience: normalizedAudience,
    recipient_count: recipients.length,
    thread_ids: threadIds,
  };
}

export async function getThreadMessages({ wallet, threadId }) {
  const thread = await getThreadById(threadId);
  if (!canAccessThread(wallet, thread)) {
    throw new Error("You do not have access to this thread.");
  }

  const { data, error } = await supabase
    .from("creator_thread_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load thread messages");
  }

  return {
    thread,
    messages: data || [],
  };
}

export async function createThreadMessage({ wallet, threadId, body }) {
  const normalizedWallet = normalizeWallet(wallet);
  const thread = await getThreadById(threadId);
  if (!canAccessThread(normalizedWallet, thread)) {
    throw new Error("You do not have access to this thread.");
  }

  const senderRole =
    normalizeWallet(thread.creator_wallet) === normalizedWallet
      ? "creator"
      : normalizeWallet(thread.fan_wallet) === normalizedWallet
        ? "fan"
        : "admin";

  const messageText = String(body || "").trim();
  if (!messageText) {
    throw new Error("Message body is required.");
  }

  const { data, error } = await supabase
    .from("creator_thread_messages")
    .insert({
      thread_id: threadId,
      sender_wallet: normalizedWallet,
      sender_role: senderRole,
      body: messageText,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to send message");
  }

  const { error: threadUpdateError } = await supabase
    .from("creator_threads")
    .update({
      last_message_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "open",
    })
    .eq("id", threadId);

  if (threadUpdateError) {
    throw new Error(threadUpdateError.message || "Failed to update thread metadata");
  }

  return data;
}

export async function getProductFeedback(productId, wallet = "") {
  const product = await getProductById(productId);
  if (!product?.artist_id) {
    throw new Error("This product is not linked to a creator yet.");
  }

  const normalizedWallet = normalizeWallet(wallet);
  const isCreatorViewer = Boolean(
    normalizedWallet && normalizeWallet(product.creator_wallet) === normalizedWallet
  );
  const relationship = normalizedWallet
    ? await getRelationshipSnapshot(normalizedWallet, product.artist_id)
    : null;
  const collectedOrderItem = normalizedWallet
    ? await getCollectedOrderItemForWalletProduct(normalizedWallet, productId)
    : null;
  const canPublishPublicReview = Boolean(collectedOrderItem);
  const canLeaveFeedback = Boolean(collectedOrderItem || relationship?.active_subscription);

  const { data: publicThreads, error } = await supabase
    .from("product_feedback_threads")
    .select("*")
    .eq("product_id", productId)
    .eq("visibility", "public")
    .neq("status", "archived")
    .order("featured", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(24);

  if (error) {
    throw new Error(error.message || "Failed to load product feedback");
  }

  const viewerThreadsResult = normalizedWallet
    ? await supabase
        .from("product_feedback_threads")
        .select("*")
        .eq("product_id", productId)
        .eq("buyer_wallet", normalizedWallet)
        .order("last_message_at", { ascending: false })
        .limit(8)
    : { data: [], error: null };

  if (viewerThreadsResult.error) {
    throw new Error(viewerThreadsResult.error.message || "Failed to load viewer feedback");
  }

  const creatorThreadsResult = isCreatorViewer
    ? await supabase
        .from("product_feedback_threads")
        .select("*")
        .eq("product_id", productId)
        .order("subscriber_priority", { ascending: false })
        .order("featured", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(24)
    : { data: [], error: null };

  if (creatorThreadsResult.error) {
    throw new Error(creatorThreadsResult.error.message || "Failed to load creator feedback inbox");
  }

  const allThreads = [
    ...(publicThreads || []),
    ...(viewerThreadsResult.data || []),
    ...(creatorThreadsResult.data || []),
  ];
  const uniqueThreads = new Map(allThreads.map((thread) => [thread.id, thread]));
  const threadIds = Array.from(uniqueThreads.keys());
  const { data: messages, error: messagesError } = threadIds.length
    ? await supabase
        .from("product_feedback_messages")
        .select("id, thread_id, sender_wallet, sender_role, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (messagesError) {
    throw new Error(messagesError.message || "Failed to load feedback messages");
  }

  const latestMessageByThreadId = new Map();
  for (const message of messages || []) {
    if (!latestMessageByThreadId.has(message.thread_id)) {
      latestMessageByThreadId.set(message.thread_id, message);
    }
  }

  const publicThreadList = (publicThreads || []).map((thread) => ({
    ...thread,
    product,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  }));
  const viewerThreadList = (viewerThreadsResult.data || []).map((thread) => ({
    ...thread,
    product,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  }));
  const creatorThreadList = (creatorThreadsResult.data || []).map((thread) => ({
    ...thread,
    product,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  }));

  return {
    product,
    can_leave_feedback: canLeaveFeedback,
    can_publish_public_review: canPublishPublicReview,
    feedback_gate: canPublishPublicReview
      ? "collector"
      : relationship?.active_subscription
        ? "subscriber"
        : "locked",
    is_creator_viewer: isCreatorViewer,
    viewer_relationship: relationship
      ? {
          is_subscriber: Boolean(relationship.is_subscriber),
          active_subscription: Boolean(relationship.active_subscription),
          is_collector: Boolean(relationship.is_collector),
        }
      : {
          is_subscriber: false,
          active_subscription: false,
          is_collector: Boolean(collectedOrderItem),
        },
    public_threads: publicThreadList,
    viewer_threads: viewerThreadList,
    creator_threads: creatorThreadList,
  };
}

export async function getItemFeedback(itemType, itemId, wallet = "") {
  const normalizedItemType = normalizeFeedbackItemType(itemType);
  if (normalizedItemType === "product") {
    return getProductFeedback(itemId, wallet);
  }

  const item = await getCatalogItemByType(normalizedItemType, itemId);
  if (!item?.creator_id) {
    throw new Error("This item is not linked to a creator yet.");
  }

  const normalizedWallet = normalizeWallet(wallet);
  const isCreatorViewer = Boolean(
    normalizedWallet && normalizeWallet(item.creator_wallet) === normalizedWallet,
  );
  const relationship = normalizedWallet
    ? await getRelationshipSnapshot(normalizedWallet, item.creator_id)
    : null;

  const { data: publicThreads, error } = await supabase
    .from("product_feedback_threads")
    .select("*")
    .eq("item_id", itemId)
    .eq("item_type", normalizedItemType)
    .eq("visibility", "public")
    .neq("status", "archived")
    .order("featured", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(24);

  if (error) {
    throw new Error(error.message || "Failed to load item feedback");
  }

  const viewerThreadsResult = normalizedWallet
    ? await supabase
        .from("product_feedback_threads")
        .select("*")
        .eq("item_id", itemId)
        .eq("item_type", normalizedItemType)
        .eq("buyer_wallet", normalizedWallet)
        .order("last_message_at", { ascending: false })
        .limit(8)
    : { data: [], error: null };

  if (viewerThreadsResult.error) {
    throw new Error(viewerThreadsResult.error.message || "Failed to load viewer feedback");
  }

  const creatorThreadsResult = isCreatorViewer
    ? await supabase
        .from("product_feedback_threads")
        .select("*")
        .eq("item_id", itemId)
        .eq("item_type", normalizedItemType)
        .order("subscriber_priority", { ascending: false })
        .order("featured", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(24)
    : { data: [], error: null };

  if (creatorThreadsResult.error) {
    throw new Error(creatorThreadsResult.error.message || "Failed to load creator feedback inbox");
  }

  const allThreads = [
    ...(publicThreads || []),
    ...(viewerThreadsResult.data || []),
    ...(creatorThreadsResult.data || []),
  ];
  const uniqueThreads = new Map(allThreads.map((thread) => [thread.id, thread]));
  const threadIds = Array.from(uniqueThreads.keys());
  const { data: messages, error: messagesError } = threadIds.length
    ? await supabase
        .from("product_feedback_messages")
        .select("id, thread_id, sender_wallet, sender_role, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (messagesError) {
    throw new Error(messagesError.message || "Failed to load feedback messages");
  }

  const latestMessageByThreadId = new Map();
  for (const message of messages || []) {
    if (!latestMessageByThreadId.has(message.thread_id)) {
      latestMessageByThreadId.set(message.thread_id, message);
    }
  }

  const decorateThread = (thread) => ({
    ...thread,
    product: null,
    catalog_item: item,
    latest_message: latestMessageByThreadId.get(thread.id) || null,
  });

  return {
    item,
    can_leave_feedback: Boolean(normalizedWallet),
    can_publish_public_review: Boolean(normalizedWallet),
    feedback_gate: normalizedWallet ? "collector" : "locked",
    is_creator_viewer: isCreatorViewer,
    viewer_relationship: relationship
      ? {
          is_subscriber: Boolean(relationship.is_subscriber),
          active_subscription: Boolean(relationship.active_subscription),
          is_collector: Boolean(relationship.is_collector),
        }
      : {
          is_subscriber: false,
          active_subscription: false,
          is_collector: Boolean(normalizedWallet),
        },
    public_threads: (publicThreads || []).map(decorateThread),
    viewer_threads: (viewerThreadsResult.data || []).map(decorateThread),
    creator_threads: (creatorThreadsResult.data || []).map(decorateThread),
  };
}

export async function createItemFeedbackThread({
  wallet,
  itemType,
  itemId,
  feedbackType,
  visibility,
  rating,
  title,
  body,
}) {
  const normalizedItemType = normalizeFeedbackItemType(itemType);
  if (normalizedItemType === "product") {
    return createProductFeedbackThread({
      wallet,
      productId: itemId,
      feedbackType,
      visibility,
      rating,
      title,
      body,
    });
  }

  if (!SUPPORTED_FEEDBACK_ITEM_TYPES.has(normalizedItemType)) {
    throw new Error("Unsupported feedback item type.");
  }

  const normalizedWallet = normalizeWallet(wallet);
  const item = await getCatalogItemByType(normalizedItemType, itemId);
  if (!item?.creator_id) {
    throw new Error("This item is not linked to a creator yet.");
  }

  const relationship = await getRelationshipSnapshot(normalizedWallet, item.creator_id);
  const requestedVisibility = String(visibility || "public").trim().toLowerCase();
  const normalizedVisibility =
    requestedVisibility === "private" && relationship?.active_subscription ? "private" : "public";

  if (requestedVisibility === "private" && normalizedVisibility !== "private") {
    throw new Error("Private feedback for drops and releases is subscriber-only. Use direct message instead.");
  }

  const normalizedFeedbackType = ["review", "feedback", "question"].includes(String(feedbackType))
    ? feedbackType
    : normalizedVisibility === "public"
      ? "review"
      : "question";
  const ratingValue = Number(rating);
  const safeRating =
    normalizedVisibility === "public" &&
    Number.isFinite(ratingValue) &&
    ratingValue >= 1 &&
    ratingValue <= 5
      ? Math.round(ratingValue)
      : null;
  const subject = String(title || "").trim() || null;
  const openingMessageText = String(body || "").trim();

  if (!openingMessageText) {
    throw new Error("Write the feedback you want to post.");
  }

  const existingResult = await supabase
    .from("product_feedback_threads")
    .select("*")
    .eq("item_id", itemId)
    .eq("item_type", normalizedItemType)
    .eq("buyer_wallet", normalizedWallet)
    .eq("feedback_type", normalizedFeedbackType)
    .eq("visibility", normalizedVisibility)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message || "Failed to load existing feedback thread");
  }

  let thread = existingResult.data || null;

  if (!thread) {
    const insertResult = await supabase
      .from("product_feedback_threads")
      .insert({
        product_id: null,
        item_id: itemId,
        item_type: normalizedItemType,
        artist_id: item.creator_id,
        order_id: null,
        order_item_id: null,
        buyer_wallet: normalizedWallet,
        creator_wallet: normalizeWallet(item.creator_wallet),
        feedback_type: normalizedFeedbackType,
        visibility: normalizedVisibility,
        rating: safeRating,
        title: subject,
        subscriber_priority: Boolean(relationship?.active_subscription),
        last_message_at: new Date().toISOString(),
        metadata: {
          item_title: item.title,
          item_description: item.description || null,
          item_image_url: item.image_url || null,
          item_type: normalizedItemType,
          source: "discover_feed",
          thread_gate: normalizedVisibility === "public" ? "public" : "subscriber",
          subscriber_perks: relationship?.active_subscription
            ? ["priority-feedback", "creator-priority-inbox"]
            : [],
        },
      })
      .select("*")
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Failed to create feedback thread");
    }

    thread = insertResult.data;
  } else {
    const updateResult = await supabase
      .from("product_feedback_threads")
      .update({
        title: subject || thread.title,
        rating: safeRating ?? thread.rating,
        subscriber_priority: Boolean(relationship?.active_subscription || thread.subscriber_priority),
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id)
      .select("*")
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message || "Failed to update feedback thread");
    }

    thread = updateResult.data;
  }

  const createdMessage = await createProductFeedbackMessage({
    wallet: normalizedWallet,
    threadId: thread.id,
    body: openingMessageText,
  });

  return {
    ...thread,
    catalog_item: item,
    latest_message: createdMessage,
  };
}

export async function createProductFeedbackThread({
  wallet,
  productId,
  feedbackType,
  visibility,
  rating,
  title,
  body,
}) {
  const normalizedWallet = normalizeWallet(wallet);
  const product = await getProductById(productId);

  if (!product?.artist_id) {
    throw new Error("This product is not linked to a creator yet.");
  }

  const collectedOrderItem = await getCollectedOrderItemForWalletProduct(normalizedWallet, productId);
  const relationship = await getRelationshipSnapshot(normalizedWallet, product.artist_id);
  const canPublishPublicReview = Boolean(collectedOrderItem);
  const canOpenSubscriberThread = Boolean(relationship?.active_subscription);

  if (!canPublishPublicReview && !canOpenSubscriberThread) {
    throw new Error("Only collectors or active subscribers can open release threads.");
  }

  const normalizedVisibility = canPublishPublicReview && visibility === "public" ? "public" : "private";
  const normalizedFeedbackType = ["review", "feedback", "question"].includes(String(feedbackType))
    ? feedbackType
    : normalizedVisibility === "public"
      ? "review"
      : canPublishPublicReview
        ? "feedback"
        : "question";
  const ratingValue = Number(rating);
  const safeRating =
    canPublishPublicReview &&
    normalizedVisibility === "public" &&
    Number.isFinite(ratingValue) &&
    ratingValue >= 1 &&
    ratingValue <= 5
      ? Math.round(ratingValue)
      : null;
  const subject = String(title || "").trim() || null;
  const openingMessageText = String(body || "").trim();

  if (!openingMessageText) {
    throw new Error("Write the feedback you want the creator to receive.");
  }

  const existingResult = await supabase
    .from("product_feedback_threads")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_wallet", normalizedWallet)
    .eq("feedback_type", normalizedFeedbackType)
    .eq("visibility", normalizedVisibility)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message || "Failed to load existing feedback thread");
  }

  let thread = existingResult.data || null;

  if (!thread) {
    const insertResult = await supabase
      .from("product_feedback_threads")
      .insert({
        product_id: productId,
        item_id: productId,
        item_type: "product",
        artist_id: product.artist_id,
        order_id: collectedOrderItem?.order_id || null,
        order_item_id: collectedOrderItem?.id || null,
        buyer_wallet: normalizedWallet,
        creator_wallet: normalizeWallet(product.creator_wallet),
        feedback_type: normalizedFeedbackType,
        visibility: normalizedVisibility,
        rating: safeRating,
        title: subject,
        subscriber_priority: Boolean(relationship?.active_subscription),
        last_message_at: new Date().toISOString(),
        metadata: {
          product_name: product.name,
          product_image_url: product.preview_uri || product.image_url || product.image_ipfs_uri || null,
          quantity: Number(collectedOrderItem?.quantity || 1),
          line_total_eth: toNumber(collectedOrderItem?.line_total_eth),
          source: collectedOrderItem ? "my_collection" : "subscriber_release_thread",
          thread_gate: canPublishPublicReview ? "collector" : "subscriber",
          subscriber_perks: relationship?.active_subscription
            ? ["priority-feedback", "subscriber-badge", "creator-priority-inbox"]
            : [],
        },
      })
      .select("*")
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Failed to create feedback thread");
    }

    thread = insertResult.data;
  } else {
    const updateResult = await supabase
      .from("product_feedback_threads")
      .update({
        item_id: thread.item_id || productId,
        item_type: thread.item_type || "product",
        rating: safeRating ?? thread.rating,
        title: subject || thread.title,
        subscriber_priority: Boolean(relationship?.active_subscription || thread.subscriber_priority),
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id)
      .select("*")
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message || "Failed to update feedback thread");
    }

    thread = updateResult.data;
  }

  const createdMessage = await createProductFeedbackMessage({
    wallet: normalizedWallet,
    threadId: thread.id,
    body: openingMessageText,
  });

  return {
    ...thread,
    latest_message: createdMessage,
  };
}

async function getProductFeedbackThreadById(threadId) {
  const { data, error } = await supabase
    .from("product_feedback_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (error) {
    throw new Error(error.message || "Feedback thread not found");
  }

  return data;
}

function canAccessProductFeedbackThread(wallet, thread) {
  const normalizedWallet = normalizeWallet(wallet);
  if (thread.visibility === "public" && thread.status !== "archived") {
    return true;
  }

  if (!normalizedWallet) {
    return false;
  }

  return (
    normalizeWallet(thread.creator_wallet) === normalizedWallet ||
    normalizeWallet(thread.buyer_wallet) === normalizedWallet
  );
}

export async function getProductFeedbackThreadMessages({ wallet, threadId }) {
  const thread = await getProductFeedbackThreadById(threadId);
  if (!canAccessProductFeedbackThread(wallet, thread)) {
    throw new Error("You do not have access to this feedback thread.");
  }

  const { data, error } = await supabase
    .from("product_feedback_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load feedback messages");
  }

  const [product, catalogItem] = await Promise.all([
    thread.product_id ? getProductById(thread.product_id) : Promise.resolve(null),
    getCatalogItemByType(thread.item_type || "product", thread.item_id || thread.product_id),
  ]);

  return {
    thread: {
      ...thread,
      product,
      catalog_item: catalogItem,
    },
    messages: data || [],
  };
}

export async function createProductFeedbackMessage({ wallet, threadId, body }) {
  const normalizedWallet = normalizeWallet(wallet);
  const thread = await getProductFeedbackThreadById(threadId);
  if (!canAccessProductFeedbackThread(normalizedWallet, thread)) {
    throw new Error("You do not have access to this feedback thread.");
  }

  const messageText = String(body || "").trim();
  if (!messageText) {
    throw new Error("Feedback message is required.");
  }

  const senderRole =
    normalizeWallet(thread.creator_wallet) === normalizedWallet
      ? "creator"
      : normalizeWallet(thread.buyer_wallet) === normalizedWallet
        ? "collector"
        : "admin";

  const { data, error } = await supabase
    .from("product_feedback_messages")
    .insert({
      thread_id: threadId,
      sender_wallet: normalizedWallet,
      sender_role: senderRole,
      body: messageText,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to send feedback message");
  }

  const { error: threadUpdateError } = await supabase
    .from("product_feedback_threads")
    .update({
      last_message_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "open",
    })
    .eq("id", threadId);

  if (threadUpdateError) {
    throw new Error(threadUpdateError.message || "Failed to update feedback thread");
  }

  return data;
}

export async function curateProductFeedbackThread({
  wallet,
  threadId,
  featured,
  creatorCurated,
  status,
  visibility,
  title,
}) {
  const normalizedWallet = normalizeWallet(wallet);
  const thread = await getProductFeedbackThreadById(threadId);
  const artist = await getArtistById(thread.artist_id);

  if (normalizeWallet(artist.wallet) !== normalizedWallet) {
    throw new Error("Only the creator can curate this feedback thread.");
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (typeof featured === "boolean") {
    updates.featured = featured;
  }
  if (typeof creatorCurated === "boolean") {
    updates.creator_curated = creatorCurated;
  }
  if (["open", "closed", "archived"].includes(String(status))) {
    updates.status = status;
  }
  if (["public", "private"].includes(String(visibility))) {
    updates.visibility = visibility;
  }
  if (typeof title === "string") {
    updates.title = title.trim() || null;
  }

  const { data, error } = await supabase
    .from("product_feedback_threads")
    .update(updates)
    .eq("id", threadId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to curate feedback thread");
  }

  return data;
}
