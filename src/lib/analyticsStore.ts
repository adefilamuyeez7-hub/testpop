import { supabase } from "@/lib/db";
import { getOrCreateGuestCustomerId, getRuntimeSession } from "@/lib/runtimeSession";

export type PopupAnalyticsSnapshot = {
  dailyVisits: Record<string, number>;
  artistViews: Record<string, number>;
  dropViews: Record<string, number>;
  productViews: Record<string, number>;
};

const EMPTY_ANALYTICS: PopupAnalyticsSnapshot = {
  dailyVisits: {},
  artistViews: {},
  dropViews: {},
  productViews: {},
};

let analyticsSnapshot: PopupAnalyticsSnapshot = {
  dailyVisits: {},
  artistViews: {},
  dropViews: {},
  productViews: {},
};

interface UserEngagement {
  collectionViews: number;
  poapsViews: number;
  subscriptionsViews: number;
  poapsClaimed: number;
  poapsRedeemed: number;
  articlesViewed: Record<string, number>;
  campaignsInteracted: Record<string, number>;
  lastUpdated: number;
}

const engagementByWallet = new Map<string, UserEngagement>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadAnalytics(): PopupAnalyticsSnapshot {
  return analyticsSnapshot;
}

function saveAnalytics(snapshot: PopupAnalyticsSnapshot) {
  analyticsSnapshot = {
    dailyVisits: { ...snapshot.dailyVisits },
    artistViews: { ...snapshot.artistViews },
    dropViews: { ...snapshot.dropViews },
    productViews: { ...snapshot.productViews },
  };
}

function incrementRecord(record: Record<string, number>, key: string) {
  return {
    ...record,
    [key]: (record[key] ?? 0) + 1,
  };
}

function incrementDailyVisit() {
  const snapshot = loadAnalytics();
  snapshot.dailyVisits = incrementRecord(snapshot.dailyVisits, todayKey());
  saveAnalytics(snapshot);
}

type AnalyticsEventPayload = {
  page: string;
  eventType: "page_view" | "artist_view" | "drop_view" | "product_view";
  artistId?: string;
  dropId?: string;
  productId?: string;
};

function getAnalyticsSessionId() {
  const runtimeWallet = getRuntimeSession().wallet;
  return runtimeWallet || getOrCreateGuestCustomerId();
}

async function trackToSupabase(payload: AnalyticsEventPayload) {
  try {
    const { error: modernError } = await supabase
      .from("analytics_events")
      .insert({
        event_type: payload.eventType,
        artist_id: payload.artistId || null,
        drop_id: payload.dropId || null,
        product_id: payload.productId || null,
        session_id: getAnalyticsSessionId(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        metadata: {
          page: payload.page,
        },
        created_at: new Date().toISOString(),
      });

    if (!modernError) {
      return;
    }

    const { error: legacyError } = await supabase
      .from("analytics")
      .insert({
        page: payload.page,
        artist_id: payload.artistId || null,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        timestamp: new Date().toISOString(),
      });

    if (legacyError) {
      console.error("Failed to track analytics to Supabase:", legacyError.message);
    }
  } catch (error) {
    console.error("Error tracking analytics:", error);
  }
}

export function recordPageVisit() {
  incrementDailyVisit();
  void trackToSupabase({
    page: "page_visit",
    eventType: "page_view",
  });
}

export function recordArtistView(artistId: string) {
  const snapshot = loadAnalytics();
  snapshot.dailyVisits = incrementRecord(snapshot.dailyVisits, todayKey());
  snapshot.artistViews = incrementRecord(snapshot.artistViews, artistId);
  saveAnalytics(snapshot);
  void trackToSupabase({
    page: "artist_view",
    eventType: "artist_view",
    artistId,
  });
}

export function recordDropView(dropId: string) {
  const snapshot = loadAnalytics();
  snapshot.dailyVisits = incrementRecord(snapshot.dailyVisits, todayKey());
  snapshot.dropViews = incrementRecord(snapshot.dropViews, dropId);
  saveAnalytics(snapshot);
  void trackToSupabase({
    page: "drop_view",
    eventType: "drop_view",
    dropId,
  });
}

export function recordProductView(productId: string) {
  const snapshot = loadAnalytics();
  snapshot.dailyVisits = incrementRecord(snapshot.dailyVisits, todayKey());
  snapshot.productViews = incrementRecord(snapshot.productViews, productId);
  saveAnalytics(snapshot);
  void trackToSupabase({
    page: "product_view",
    eventType: "product_view",
    productId,
  });
}

export function getAnalyticsSnapshot() {
  return loadAnalytics();
}

export function getRecentVisitSeries(days = 14) {
  const snapshot = loadAnalytics();
  const series: { date: string; visits: number }[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    series.push({
      date: key,
      visits: snapshot.dailyVisits[key] ?? 0,
    });
  }

  return series;
}

function getDefaultEngagement(): UserEngagement {
  return {
    collectionViews: 0,
    poapsViews: 0,
    subscriptionsViews: 0,
    poapsClaimed: 0,
    poapsRedeemed: 0,
    articlesViewed: {},
    campaignsInteracted: {},
    lastUpdated: Date.now(),
  };
}

export function getUserEngagement(walletAddress: string): UserEngagement {
  return engagementByWallet.get(walletAddress.toLowerCase()) ?? getDefaultEngagement();
}

function saveUserEngagement(walletAddress: string, engagement: UserEngagement) {
  engagementByWallet.set(walletAddress.toLowerCase(), {
    ...engagement,
    articlesViewed: { ...engagement.articlesViewed },
    campaignsInteracted: { ...engagement.campaignsInteracted },
  });
}

export function trackCollectionView(walletAddress: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.collectionViews += 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
  recordPageVisit();
}

export function trackPOAPsView(walletAddress: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.poapsViews += 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
  recordPageVisit();
}

export function trackSubscriptionsView(walletAddress: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.subscriptionsViews += 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
  recordPageVisit();
}

export function trackPOAPClaimed(walletAddress: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.poapsClaimed += 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
}

export function trackPOAPRedeemed(walletAddress: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.poapsRedeemed += 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
}

export function trackArticleView(walletAddress: string, articleId: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.articlesViewed[articleId] = (engagement.articlesViewed[articleId] || 0) + 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
}

export function trackCampaignInteraction(walletAddress: string, campaignId: string): void {
  const engagement = getUserEngagement(walletAddress);
  engagement.campaignsInteracted[campaignId] =
    (engagement.campaignsInteracted[campaignId] || 0) + 1;
  engagement.lastUpdated = Date.now();
  saveUserEngagement(walletAddress, engagement);
}

export function resetAnalyticsSnapshot() {
  analyticsSnapshot = {
    ...EMPTY_ANALYTICS,
    dailyVisits: {},
    artistViews: {},
    dropViews: {},
    productViews: {},
  };
}
