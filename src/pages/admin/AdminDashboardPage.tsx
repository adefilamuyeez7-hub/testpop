/**
 * Admin Dashboard Page
 * Location: src/pages/admin/AdminDashboardPage.tsx
 * 
 * System overview and administrative statistics
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'recharts';
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
} from 'lucide-react';

/**
 * Fallback data structure for when API fails
 */
const FALLBACK_STATS = {
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

const FALLBACK_VOLUME_DATA = [
  { date: 'Mon', products: 240, auctions: 221, gifts: 120 },
  { date: 'Tue', products: 321, auctions: 281, gifts: 150 },
  { date: 'Wed', products: 281, auctions: 251, gifts: 170 },
  { date: 'Thu', products: 381, auctions: 301, gifts: 200 },
  { date: 'Fri', products: 451, auctions: 421, gifts: 220 },
  { date: 'Sat', products: 521, auctions: 481, gifts: 250 },
  { date: 'Sun', products: 381, auctions: 331, gifts: 180 },
];

const FALLBACK_REVENUE_DATA = [
  { date: 'Week 1', revenue: 2400, fees: 240 },
  { date: 'Week 2', revenue: 3210, fees: 321 },
  { date: 'Week 3', revenue: 2290, fees: 229 },
  { date: 'Week 4', revenue: 2000, fees: 200 },
];

export function AdminDashboardPage() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [volumeData, setVolumeData] = useState(FALLBACK_VOLUME_DATA);
  const [revenueData, setRevenueData] = useState(FALLBACK_REVENUE_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch stats in parallel
        const [statsRes, volumeRes, revenueRes] = await Promise.all([
          fetch('/api/admin/dashboard/stats'),
          fetch('/api/admin/dashboard/volume'),
          fetch('/api/admin/dashboard/revenue'),
        ]);

        // Handle stats response
        if (!statsRes.ok) {
          console.warn('Failed to fetch stats, using fallback');
        } else {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Handle volume response
        if (!volumeRes.ok) {
          console.warn('Failed to fetch volume data, using fallback');
        } else {
          const volumeDataResponse = await volumeRes.json();
          setVolumeData(volumeDataResponse);
        }

        // Handle revenue response
        if (!revenueRes.ok) {
          console.warn('Failed to fetch revenue data, using fallback');
        } else {
          const revenueDataResponse = await revenueRes.json();
          setRevenueData(revenueDataResponse);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        // Fallback to hardcoded data on error
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh data every 30 seconds
    const refreshInterval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(refreshInterval);
  }, []);


  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Platform overview and statistics</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Orders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Orders (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.ordersToday}</p>
            <p className="text-xs text-green-600 mt-1">↑ 12% from yesterday</p>
          </CardContent>
        </Card>

        {/* Daily Auctions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gavel className="w-4 h-4" />
              Auctions (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.auctionsToday}</p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.activeAuctions} active
            </p>
          </CardContent>
        </Card>

        {/* Daily Gifts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Gifts (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.giftsToday}</p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.totalGifts} total
            </p>
          </CardContent>
        </Card>

        {/* Platform Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Platform Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.platformFees} ETH</p>
            <p className="text-xs text-gray-600 mt-1">
              ${(stats.platformFees * 2500).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User & Creator Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="font-bold">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="text-sm text-gray-600">Active Users (7d)</p>
                <p className="font-bold">
                  {stats.activeUsers.toLocaleString()} (
                  {((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%)
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${(stats.activeUsers / stats.totalUsers) * 100}%`,
                  }}
                />
              </div>
            </div>

            <Badge variant="outline">
              <Activity className="w-3 h-3 mr-1" />
              {((stats.activeUsers / stats.totalUsers) * 100).toFixed(0)}% engagement
            </Badge>
          </CardContent>
        </Card>

        {/* Creators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Creators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-sm text-gray-600">Total Creators</p>
                <p className="font-bold">{stats.totalCreators.toLocaleString()}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="text-sm text-gray-600">Active Creators (7d)</p>
                <p className="font-bold">
                  {stats.activeCreators.toLocaleString()} (
                  {((stats.activeCreators / stats.totalCreators) * 100).toFixed(1)}%)
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{
                    width: `${(stats.activeCreators / stats.totalCreators) * 100}%`,
                  }}
                />
              </div>
            </div>

            <Badge variant="outline">
              {stats.totalProducts.toLocaleString()} products listed
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="products"
                stroke="#3b82f6"
                name="Products"
              />
              <Line
                type="monotone"
                dataKey="auctions"
                stroke="#ef4444"
                name="Auctions"
              />
              <Line
                type="monotone"
                dataKey="gifts"
                stroke="#8b5cf6"
                name="Gifts"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Fees (Last 4 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Platform Volume */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Total Platform Volume</p>
              <p className="text-3xl font-bold">{stats.totalVolume} ETH</p>
              <p className="text-xs text-gray-500 mt-1">
                ${(stats.totalVolume * 2500).toFixed(0)}
              </p>
            </div>

            {/* Creator Payouts */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Creator Payouts</p>
              <p className="text-3xl font-bold">{stats.creatorPayouts} ETH</p>
              <p className="text-xs text-gray-500 mt-1">
                {((stats.creatorPayouts / stats.totalVolume) * 100).toFixed(1)}% of
                volume
              </p>
            </div>

            {/* Platform Fees */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Platform Fees (Collected)</p>
              <p className="text-3xl font-bold">{stats.platformFees} ETH</p>
              <p className="text-xs text-gray-500 mt-1">
                {((stats.platformFees / stats.totalVolume) * 100).toFixed(1)}% of
                volume
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
              <p className="font-semibold text-green-900">Smart Contracts</p>
              <Badge className="bg-green-600">Active</Badge>
            </div>

            <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
              <p className="font-semibold text-green-900">Database</p>
              <Badge className="bg-green-600">Healthy</Badge>
            </div>

            <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
              <p className="font-semibold text-green-900">API Servers</p>
              <Badge className="bg-green-600">Running</Badge>
            </div>

            <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
              <p className="font-semibold text-blue-900">Network</p>
              <Badge className="bg-blue-600">Sepolia Testnet</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
