/**
 * Admin Dashboard Page
 * Location: src/pages/admin/AdminDashboardPage.tsx
 *
 * System overview and administrative statistics
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Gavel,
  Gift,
  DollarSign,
  AlertCircle,
  Settings,
  Activity,
} from "lucide-react";

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalCreators: number;
  activeCreators: number;
  totalProducts: number;
  activeAuctions: number;
  totalGifts: number;
  totalVolume: number;
  platformFees: number;
  creatorPayouts: number;
  ordersToday: number;
  auctionsToday: number;
  giftsToday: number;
};

type VolumePoint = {
  date: string;
  products: number;
  auctions: number;
  gifts: number;
};

type RevenuePoint = {
  date: string;
  revenue: number;
  fees: number;
};

const EMPTY_STATS: AdminStats = {
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
};

function percent(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statsRes, volumeRes, revenueRes] = await Promise.all([
          fetch("/api/admin/dashboard/stats"),
          fetch("/api/admin/dashboard/volume"),
          fetch("/api/admin/dashboard/revenue"),
        ]);

        if (!statsRes.ok || !volumeRes.ok || !revenueRes.ok) {
          throw new Error("Admin dashboard data is currently unavailable.");
        }

        const [statsData, volumeDataResponse, revenueDataResponse] = await Promise.all([
          statsRes.json() as Promise<AdminStats>,
          volumeRes.json() as Promise<VolumePoint[]>,
          revenueRes.json() as Promise<RevenuePoint[]>,
        ]);

        if (!active) return;

        setStats(statsData);
        setVolumeData(Array.isArray(volumeDataResponse) ? volumeDataResponse : []);
        setRevenueData(Array.isArray(revenueDataResponse) ? revenueDataResponse : []);
      } catch (err) {
        if (!active) return;
        console.error("Error fetching dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        setStats(EMPTY_STATS);
        setVolumeData([]);
        setRevenueData([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchDashboardData();

    const refreshInterval = setInterval(() => {
      void fetchDashboardData();
    }, 30000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const userEngagementRate = percent(stats.activeUsers, stats.totalUsers);
  const creatorEngagementRate = percent(stats.activeCreators, stats.totalCreators);
  const creatorPayoutRate = percent(stats.creatorPayouts, stats.totalVolume);
  const platformFeeRate = percent(stats.platformFees, stats.totalVolume);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-1 text-gray-600">Platform overview and statistics</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {error ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShoppingBag className="h-4 w-4" />
              Orders (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.ordersToday}</p>
            <p className="mt-1 text-xs text-gray-600">Live API totals for the last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gavel className="h-4 w-4" />
              Auctions (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.auctionsToday}</p>
            <p className="mt-1 text-xs text-gray-600">{stats.activeAuctions} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4" />
              Gifts (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.giftsToday}</p>
            <p className="mt-1 text-xs text-gray-600">{stats.totalGifts} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Platform Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.platformFees} ETH</p>
            <p className="mt-1 text-xs text-gray-600">${(stats.platformFees * 2500).toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="font-bold">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div className="h-2 w-full rounded-full bg-blue-600" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-600">Active Users (7d)</p>
                <p className="font-bold">
                  {stats.activeUsers.toLocaleString()} ({userEngagementRate.toFixed(1)}%)
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-green-600"
                  style={{ width: `${userEngagementRate}%` }}
                />
              </div>
            </div>

            <Badge variant="outline">
              <Activity className="mr-1 h-3 w-3" />
              {userEngagementRate.toFixed(0)}% engagement
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Creators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-600">Total Creators</p>
                <p className="font-bold">{stats.totalCreators.toLocaleString()}</p>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div className="h-2 w-full rounded-full bg-purple-600" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <p className="text-sm text-gray-600">Active Creators (7d)</p>
                <p className="font-bold">
                  {stats.activeCreators.toLocaleString()} ({creatorEngagementRate.toFixed(1)}%)
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-orange-600"
                  style={{ width: `${creatorEngagementRate}%` }}
                />
              </div>
            </div>

            <Badge variant="outline">{stats.totalProducts.toLocaleString()} products listed</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading volume data...</p>
          ) : volumeData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="products" stroke="#3b82f6" name="Products" />
                <Line type="monotone" dataKey="auctions" stroke="#ef4444" name="Auctions" />
                <Line type="monotone" dataKey="gifts" stroke="#8b5cf6" name="Gifts" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-600">No volume data available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue & Fees (Last 4 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading revenue data...</p>
          ) : revenueData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Creator Volume (ETH)" />
                <Bar dataKey="fees" fill="#10b981" name="Platform Fees (ETH)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-600">No revenue data available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm text-gray-600">Total Platform Volume</p>
              <p className="text-3xl font-bold">{stats.totalVolume} ETH</p>
              <p className="mt-1 text-xs text-gray-500">${(stats.totalVolume * 2500).toFixed(0)}</p>
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-600">Creator Payouts</p>
              <p className="text-3xl font-bold">{stats.creatorPayouts} ETH</p>
              <p className="mt-1 text-xs text-gray-500">{creatorPayoutRate.toFixed(1)}% of volume</p>
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-600">Platform Fees (Collected)</p>
              <p className="text-3xl font-bold">{stats.platformFees} ETH</p>
              <p className="mt-1 text-xs text-gray-500">{platformFeeRate.toFixed(1)}% of volume</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3">
              <p className="font-semibold text-green-900">Smart Contracts</p>
              <Badge className="bg-green-600">Active</Badge>
            </div>

            <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3">
              <p className="font-semibold text-green-900">Database</p>
              <Badge className="bg-green-600">Healthy</Badge>
            </div>

            <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3">
              <p className="font-semibold text-green-900">API Servers</p>
              <Badge className="bg-green-600">Running</Badge>
            </div>

            <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-3">
              <p className="font-semibold text-blue-900">Network</p>
              <Badge className="bg-blue-600">Sepolia Testnet</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button variant="outline" className="justify-start">
            View Transactions
          </Button>
          <Button variant="outline" className="justify-start">
            Manage Users
          </Button>
          <Button variant="outline" className="justify-start">
            Review Disputes
          </Button>
          <Button variant="outline" className="justify-start">
            System Logs
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminDashboardPage;
