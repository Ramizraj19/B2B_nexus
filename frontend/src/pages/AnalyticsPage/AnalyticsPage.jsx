import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');

  // Mock analytics data - replace with actual API calls
  const analyticsData = {
    totalRevenue: 125000,
    totalOrders: 342,
    totalProducts: 156,
    totalUsers: 89,
    revenueGrowth: 12.5,
    orderGrowth: 8.3,
    topProducts: [
      { name: 'Premium Widget A', sales: 45, revenue: 1345.55 },
      { name: 'Deluxe Widget C', sales: 38, revenue: 1519.62 },
      { name: 'Standard Widget B', sales: 32, revenue: 639.68 },
      { name: 'Basic Widget D', sales: 28, revenue: 279.72 }
    ],
    recentActivity: [
      { type: 'order', message: 'New order #ORD-001 received', time: '2 hours ago', status: 'success' },
      { type: 'product', message: 'Product "Premium Widget A" updated', time: '4 hours ago', status: 'info' },
      { type: 'user', message: 'New user registration: john.doe@example.com', time: '6 hours ago', status: 'success' },
      { type: 'order', message: 'Order #ORD-002 shipped', time: '8 hours ago', status: 'info' }
    ]
  };

  const getMetricCard = (title, value, change, icon, color) => (
    <Card className="bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change && (
              <div className="flex items-center mt-1">
                <span className={`text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-xs text-gray-500 ml-1">from last month</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
            <div className={`w-6 h-6 ${color}`}></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getActivityIcon = (type) => {
    const icons = {
      order: '📦',
      product: '🏷️',
      user: '👤',
      revenue: '💰'
    };
    return icons[type] || '📊';
  };

  const getActivityStatus = (status) => {
    const statusConfig = {
      success: { color: 'bg-green-100 text-green-800', label: 'Success' },
      info: { color: 'bg-blue-100 text-blue-800', label: 'Info' },
      warning: { color: 'bg-yellow-100 text-yellow-800', label: 'Warning' },
      error: { color: 'bg-red-100 text-red-800', label: 'Error' }
    };
    
    const config = statusConfig[status] || statusConfig.info;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
              <p className="text-gray-600">Monitor your business performance and insights</p>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant={timeRange === '7d' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                7 Days
              </Button>
              <Button 
                variant={timeRange === '30d' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                30 Days
              </Button>
              <Button 
                variant={timeRange === '90d' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('90d')}
              >
                90 Days
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {getMetricCard('Total Revenue', `$${analyticsData.totalRevenue.toLocaleString()}`, analyticsData.revenueGrowth, '💰', 'text-green-600')}
          {getMetricCard('Total Orders', analyticsData.totalOrders, analyticsData.orderGrowth, '📦', 'text-blue-600')}
          {getMetricCard('Total Products', analyticsData.totalProducts, null, '🏷️', 'text-purple-600')}
          {getMetricCard('Total Users', analyticsData.totalUsers, null, '👤', 'text-orange-600')}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
              <CardDescription>Best selling products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.sales} units sold</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      ${product.revenue.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system activities and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">{getActivityIcon(activity.type)}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    {getActivityStatus(activity.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="mt-8">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Revenue performance over time</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">📊</p>
                  <p className="text-gray-600">Chart visualization would go here</p>
                  <p className="text-sm text-gray-500">Integrate with Chart.js or Recharts for actual charts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Section */}
        <div className="mt-8">
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Export Reports</h3>
                  <p className="text-gray-600">Download analytics data for external analysis</p>
                </div>
                <div className="flex space-x-3">
                  <Button variant="outline">Export CSV</Button>
                  <Button variant="outline">Export PDF</Button>
                  <Button>Generate Report</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;