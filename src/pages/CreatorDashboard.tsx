import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Eye,
  Heart,
  LayoutDashboard,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";

interface AnalyticsData {
  items: Array<{
    id: string;
    item_type: string;
    title: string;
    comment_count: number;
    avg_rating: number;
    analytics: {
      views: number;
      likes: number;
      comments: number;
      purchases: number;
      shares: number;
    };
  }>;
  total_stats: {
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_purchases: number;
    total_shares: number;
    avg_rating: number;
  };
}

interface Subscriber {
  id: string;
  subscriber_wallet: string;
  subscription_tier: string;
  subscribed_at: string;
}

interface SubscriberStats {
  total_subscribers: number;
  by_tier: {
    free: number;
    supporter: number;
    vip: number;
    collector: number;
  };
}

export function CreatorDashboard() {
  const { address } = useAccount();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "subscribers">("overview");

  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [analyticsRes, subscribersRes] = await Promise.all([
          fetch("/api/personalization/creator/analytics"),
          fetch("/api/personalization/creator/subscribers"),
        ]);

        const analyticsData = await analyticsRes.json();
        const subscribersData = await subscribersRes.json();

        setAnalytics(analyticsData);
        setSubscribers(subscribersData.subscribers || []);
        setStats(subscribersData.stats || null);
      } catch (error) {
        console.error("Failed to fetch creator data:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [address]);

  if (!address) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Please connect your wallet to view your artist dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading artist dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4">
        <div>
          <h1 className="text-4xl font-bold">Artist Dashboard</h1>
          <p className="mt-2 text-gray-600">Track performance and run your creator operations from one place.</p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            <LayoutDashboard className="h-4 w-4" />
            Studio tools
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("/studio?tab=drops")}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-gray-900 hover:bg-white"
            >
              <p className="text-base font-semibold text-gray-900">Campaign Studio</p>
              <p className="mt-1 text-sm text-gray-600">Create and manage buy, campaign, and release drops.</p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/studio?tab=raises")}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-gray-900 hover:bg-white"
            >
              <p className="text-base font-semibold text-gray-900">Tokenized Creator Card</p>
              <p className="mt-1 text-sm text-gray-600">Launch and manage raise/card style creator offerings.</p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/studio?tab=profile")}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-gray-900 hover:bg-white"
            >
              <p className="text-base font-semibold text-gray-900">Portfolio Showcase</p>
              <p className="mt-1 text-sm text-gray-600">Upload and curate your artist profile and portfolio pieces.</p>
            </button>
          </div>
        </section>

        <div className="flex gap-2 border-b border-gray-200">
          {(["overview", "items", "subscribers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "items" && "Your Items"}
              {tab === "subscribers" && "Subscribers"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                icon={<Eye className="h-6 w-6" />}
                label="Total Views"
                value={analytics?.total_stats.total_views || 0}
                color="blue"
              />
              <MetricCard
                icon={<Heart className="h-6 w-6" />}
                label="Total Likes"
                value={analytics?.total_stats.total_likes || 0}
                color="red"
              />
              <MetricCard
                icon={<MessageCircle className="h-6 w-6" />}
                label="Total Comments"
                value={analytics?.total_stats.total_comments || 0}
                color="purple"
              />
              <MetricCard
                icon={<ShoppingCart className="h-6 w-6" />}
                label="Total Sales"
                value={analytics?.total_stats.total_purchases || 0}
                color="green"
              />
              <MetricCard
                icon={<Users className="h-6 w-6" />}
                label="Subscribers"
                value={stats?.total_subscribers || 0}
                color="yellow"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Engagement Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Avg Rating</span>
                    <span className="font-semibold">{(analytics?.total_stats.avg_rating || 0).toFixed(1)} stars</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Engagement Rate</span>
                    <span className="font-semibold">
                      {(
                        ((analytics?.total_stats.total_likes || 0) /
                          Math.max(analytics?.total_stats.total_views || 1, 1)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Share Activity</span>
                    <span className="font-semibold">{analytics?.total_stats.total_shares || 0} shares</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Subscriber Tiers
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Free</span>
                    <span className="font-semibold">{stats?.by_tier.free || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Supporter</span>
                    <span className="font-semibold">{stats?.by_tier.supporter || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">VIP</span>
                    <span className="font-semibold">{stats?.by_tier.vip || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Collector</span>
                    <span className="font-semibold">{stats?.by_tier.collector || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "items" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Items Performance</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="p-3 text-left font-semibold">Title</th>
                    <th className="p-3 text-center font-semibold">Views</th>
                    <th className="p-3 text-center font-semibold">Likes</th>
                    <th className="p-3 text-center font-semibold">Comments</th>
                    <th className="p-3 text-center font-semibold">Sales</th>
                    <th className="p-3 text-center font-semibold">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3">
                        <p className="line-clamp-1 font-medium">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.item_type}</p>
                      </td>
                      <td className="p-3 text-center">{item.analytics.views}</td>
                      <td className="p-3 text-center">{item.analytics.likes}</td>
                      <td className="p-3 text-center">{item.analytics.comments}</td>
                      <td className="p-3 text-center">{item.analytics.purchases}</td>
                      <td className="p-3 text-center">{item.avg_rating ? `${item.avg_rating.toFixed(1)}` : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "subscribers" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Subscribers ({subscribers.length})</h3>
            <div className="grid gap-4">
              {subscribers.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500">
                  <p>No subscribers yet.</p>
                </div>
              ) : (
                subscribers.map((subscriber) => (
                  <div
                    key={subscriber.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium">{subscriber.subscriber_wallet.slice(0, 12)}...</p>
                      <p className="text-sm text-gray-500">
                        Subscribed {new Date(subscriber.subscribed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold capitalize text-blue-700">
                      {subscriber.subscription_tier}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: "blue" | "red" | "purple" | "green" | "yellow";
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[color]}`}>{icon}</div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

export default CreatorDashboard;
