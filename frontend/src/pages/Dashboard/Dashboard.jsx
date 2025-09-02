import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { productsAPI, ordersAPI, usersAPI } from '../../api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch different data based on user role
      const promises = [];

      if (user?.role === 'buyer') {
        promises.push(
          ordersAPI.getOrders({ page: 1, limit: 5 }),
          ordersAPI.getOrderStats()
        );
      } else if (user?.role === 'seller') {
        promises.push(
          productsAPI.getMyProducts({ page: 1, limit: 5 }),
          ordersAPI.getSellerOrders({ page: 1, limit: 5 }),
          ordersAPI.getOrderStats()
        );
      } else if (user?.role === 'admin') {
        promises.push(
          productsAPI.getProducts({ page: 1, limit: 5 }),
          ordersAPI.getOrders({ page: 1, limit: 5 }),
          usersAPI.getAllUsers({ page: 1, limit: 5 }),
          ordersAPI.getOrderStats()
        );
      }

      const results = await Promise.all(promises);
      
      // Process results based on user role
      if (user?.role === 'buyer') {
        const [ordersResponse, statsResponse] = results;
        if (ordersResponse.success) {
          setRecentOrders(ordersResponse.data.orders || ordersResponse.orders || []);
        }
        if (statsResponse.success) {
          setStats(statsResponse.data || statsResponse);
        }
      } else if (user?.role === 'seller') {
        const [productsResponse, ordersResponse, statsResponse] = results;
        if (productsResponse.success) {
          setStats(prev => ({ ...prev, products: productsResponse.data.products || productsResponse.products || [] }));
        }
        if (ordersResponse.success) {
          setRecentOrders(ordersResponse.data.orders || ordersResponse.orders || []);
        }
        if (statsResponse.success) {
          setStats(prev => ({ ...prev, ...statsResponse.data }));
        }
      } else if (user?.role === 'admin') {
        const [productsResponse, ordersResponse, usersResponse, statsResponse] = results;
        if (productsResponse.success) {
          setStats(prev => ({ ...prev, products: productsResponse.data.products || productsResponse.products || [] }));
        }
        if (ordersResponse.success) {
          setRecentOrders(ordersResponse.data.orders || ordersResponse.orders || []);
        }
        if (usersResponse.success) {
          setStats(prev => ({ ...prev, users: usersResponse.data.users || usersResponse.users || [] }));
        }
        if (statsResponse.success) {
          setStats(prev => ({ ...prev, ...statsResponse.data }));
        }
      }

    } catch (err) {
      console.error('Dashboard API Error:', err);
      console.error('Error Response:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getQuickActions = () => {
    const actions = [];

    if (user?.role === 'buyer') {
      actions.push(
        {
          title: 'Browse Products',
          description: 'Discover new products from verified sellers',
          path: '/products'
        },
        {
          title: 'Shopping Cart',
          description: 'View items in your cart',
          path: '/cart'
        },
        {
          title: 'My Orders',
          description: 'Track your order history',
          path: '/orders'
        }
      );
    }

    if (user?.role === 'seller') {
      actions.push(
        {
          title: 'My Products',
          description: 'Manage your product catalog',
          path: '/my-products'
        },
        {
          title: 'Orders',
          description: 'View and manage incoming orders',
          path: '/orders'
        }
      );
    }

    if (user?.role === 'admin') {
      actions.push(
        {
          title: 'All Products',
          description: 'Manage all products in the system',
          path: '/products'
        },
        {
          title: 'Users',
          description: 'Manage user accounts and permissions',
          path: '/users'
        },
        {
          title: 'Analytics',
          description: 'System-wide analytics and insights',
          path: '/analytics'
        }
      );
    }

    return actions;
  };

  const getStatsCards = () => {
    if (user?.role === 'buyer') {
      return [
        {
          title: 'Total Orders',
          value: stats.totalOrders || 0,
          description: 'Orders placed',
          color: 'text-blue-600'
        },
        {
          title: 'Active Orders',
          value: stats.activeOrders || 0,
          description: 'Currently processing',
          color: 'text-yellow-600'
        },
        {
          title: 'Completed Orders',
          value: stats.completedOrders || 0,
          description: 'Successfully delivered',
          color: 'text-green-600'
        }
      ];
    } else if (user?.role === 'seller') {
      return [
        {
          title: 'Total Products',
          value: stats.totalProducts || 0,
          description: 'In your catalog',
          color: 'text-blue-600'
        },
        {
          title: 'Active Products',
          value: stats.activeProducts || 0,
          description: 'Currently listed',
          color: 'text-green-600'
        },
        {
          title: 'Total Orders',
          value: stats.totalOrders || 0,
          description: 'From customers',
          color: 'text-purple-600'
        }
      ];
    } else if (user?.role === 'admin') {
      return [
        {
          title: 'Total Users',
          value: stats.totalUsers || 0,
          description: 'Registered users',
          color: 'text-blue-600'
        },
        {
          title: 'Total Products',
          value: stats.totalProducts || 0,
          description: 'In the system',
          color: 'text-green-600'
        },
        {
          title: 'Total Orders',
          value: stats.totalOrders || 0,
          description: 'All orders',
          color: 'text-purple-600'
        }
      ];
    }
    return [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const StatCardSkeleton = () => (
    <Card className="bg-white">
      <CardContent className="p-6">
        <Skeleton className="h-6 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  );

  const OrderSkeleton = () => (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <Skeleton className="w-3 h-3 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-gray-600 mb-4">Please log in to view your dashboard</div>
            <Button onClick={() => window.location.href = '/login'}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-red-600 mb-4">Error: {error}</div>
            <Button onClick={fetchDashboardData}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600 mt-2">
            Here's what's happening in your {user?.role} dashboard
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <StatCardSkeleton key={index} />
              ))
            ) : (
              getStatsCards().map((stat, index) => (
                <Card key={index} className="bg-white">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.title}</h3>
                    <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {getQuickActions().map((action, index) => (
              <Card key={index} className="bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{action.description}</p>
                  <Button 
                    className="w-full" 
                    onClick={() => window.location.href = action.path}
                  >
                    Go to {action.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {user?.role === 'buyer' ? 'Your latest orders' : 
               user?.role === 'seller' ? 'Recent orders and products' : 
               'System-wide recent activity'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <OrderSkeleton key={index} />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.slice(0, 5).map((order) => (
                  <div key={order._id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Order #{order.orderNumber || order._id} - ${order.total?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(order.createdAt)} • {order.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No recent activity to show</p>
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;