import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { productsAPI, ordersAPI, usersAPI } from '../../api';
import axios from 'axios';
import { API_URL } from '../../api/config';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

      if (user?.role === 'admin') {
        // Fetch admin-specific dashboard data
        const { data } = await axios.get(`${API_URL}/api/admin/dashboard-stats`);
        setAdminStats(data.data);
        setStats(data.data);
        
        // Set recent orders from admin stats
        if (data.data?.orderStats?.recentOrders) {
          setRecentOrders(data.data.orderStats.recentOrders);
        }
      } else {
        // Fetch regular user dashboard data
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
        }

        const results = await Promise.all(promises);
        
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
        }
      }
    } catch (err) {
      console.error('Dashboard API Error:', err);
      console.error('Error Response:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'Failed to fetch dashboard data');
      toast({
        variant: "destructive",
        title: "Error loading dashboard",
        description: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  // Admin-specific chart data formatting
  const formatRevenueData = () => {
    if (!adminStats?.orderStats?.revenueByMonth) return [];
    
    return adminStats.orderStats.revenueByMonth.map(item => ({
      month: `${item._id.month}/${item._id.year}`,
      revenue: item.revenue.toFixed(2)
    }));
  };

  const formatOrderStatusData = () => {
    if (!adminStats?.orderStats?.byStatus) return [];
    
    return adminStats.orderStats.byStatus.map(item => ({
      name: item._id,
      value: item.count
    }));
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
    } else if (user?.role === 'seller') {
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
        },
        {
          title: 'Add Product',
          description: 'List a new product for sale',
          path: '/add-product'
        }
      );
    } else if (user?.role === 'admin') {
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
          value: adminStats?.userStats?.total || 0,
          description: 'Registered users',
          color: 'text-blue-600'
        },
        {
          title: 'Total Products',
          value: adminStats?.productStats?.total || 0,
          description: 'In the system',
          color: 'text-green-600'
        },
        {
          title: 'Total Orders',
          value: adminStats?.orderStats?.total || 0,
          description: 'All orders',
          color: 'text-purple-600'
        },
        {
          title: 'Total Revenue',
          value: `$${adminStats?.orderStats?.revenue?.toFixed(2) || '0.00'}`,
          description: 'System revenue',
          color: 'text-green-600'
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

  // Loading Skeletons
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

  const ChartSkeleton = () => (
    <div className="h-80 w-full flex items-center justify-center">
      <Skeleton className="h-64 w-full" />
    </div>
  );

  // Admin Dashboard Components
  const AdminOverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {getStatsCards().map((stat, index) => (
          <Card key={index} className="bg-white">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.title}</h3>
              <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue overview</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatRevenueData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
            <CardDescription>Orders by current status</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formatOrderStatusData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {formatOrderStatusData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} orders`, props.payload.name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest orders across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <OrderSkeleton key={index} />
              ))}
            </div>
          ) : adminStats?.orderStats?.recentOrders?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Order ID</th>
                    <th className="text-left py-2">Customer</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {adminStats.orderStats.recentOrders.map((order) => (
                    <tr key={order._id} className="border-b hover:bg-muted/50">
                      <td className="py-2">{order.orderNumber}</td>
                      <td className="py-2">{order.userDetails?.[0]?.name || 'Unknown'}</td>
                      <td className="py-2">{formatDate(order.createdAt)}</td>
                      <td className="py-2">
                        <Badge 
                          variant={
                            order.status === 'delivered' ? 'default' : 
                            order.status === 'shipped' ? 'secondary' :
                            order.status === 'processing' ? 'outline' :
                            order.status === 'cancelled' ? 'destructive' : 'outline'
                          }
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">${order.total?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent orders to show</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" onClick={() => navigate('/orders')}>
            View All Orders
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  // Render different dashboards based on user role
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-gray-600 mb-4">Please log in to view your dashboard</div>
            <Button onClick={() => navigate('/login')}>
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

  // Admin Dashboard with Tabs
  if (user?.role === 'admin') {
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
              Admin Dashboard - System Overview & Management
            </p>
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
                      onClick={() => navigate(action.path)}
                    >
                      Go to {action.title}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Admin Tabs */}
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview">
              <AdminOverviewTab />
            </TabsContent>
            
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
            
            <TabsContent value="orders">
              <OrderManagement />
            </TabsContent>
            
            <TabsContent value="products">
              <ProductManagement stats={adminStats?.productStats} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Regular User Dashboard (Buyer/Seller)
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
                    onClick={() => navigate(action.path)}
                  >
                    Go to {action.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="bg-white rounded-lg shadow">
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
        </Card>
      </div>
    </div>
  );
};

// Admin Management Components (from second dashboard)
const UserManagement = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/admin/pending-users`);
        setPendingUsers(data.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching pending users",
          description: error.response?.data?.error?.message || "Something went wrong",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPendingUsers();
  }, [toast]);

  const handleUserStatusUpdate = async (userId, status, rejectionReason = '') => {
    try {
      await axios.put(`${API_URL}/api/admin/user/${userId}/status`, {
        status,
        rejectionReason
      });
      
      setPendingUsers(pendingUsers.filter(user => user._id !== userId));
      
      toast({
        title: `User ${status === 'active' ? 'approved' : 'rejected'} successfully`,
        description: `The user account has been ${status === 'active' ? 'approved' : 'rejected'}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: `Failed to ${status === 'active' ? 'approve' : 'reject'} user`,
        description: error.response?.data?.error?.message || "Something went wrong",
      });
    }
  };

  if (loading) {
    return <div className="py-10 text-center">Loading pending users...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending User Approval</CardTitle>
        <CardDescription>Review and approve user registration requests</CardDescription>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No pending user approvals
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Role</th>
                  <th className="text-left py-2">Registered</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user._id} className="border-b hover:bg-muted/50">
                    <td className="py-2">{user.name || `${user.firstName} ${user.lastName}`}</td>
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">
                      <Badge variant={user.role === 'seller' ? 'secondary' : 'outline'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-2">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-right space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-green-600 hover:text-green-700 border-green-600 hover:border-green-700"
                        onClick={() => handleUserStatusUpdate(user._id, 'active')}
                      >
                        Approve
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 border-red-600 hover:border-red-700"
                        onClick={() => {
                          const reason = window.prompt('Enter reason for rejection:');
                          if (reason !== null) {
                            handleUserStatusUpdate(user._id, 'rejected', reason);
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/admin/orders`);
        setOrders(data.data?.orders || data.orders || []);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching orders",
          description: error.response?.data?.error?.message || "Something went wrong",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [toast]);

  const handleOrderStatusUpdate = async (orderId, status) => {
    try {
      const { data } = await axios.put(`${API_URL}/api/admin/orders/${orderId}/status`, { status });
      
      setOrders(orders.map(order => 
        order._id === orderId ? { ...order, status: data.data.status } : order
      ));
      
      toast({
        title: "Order status updated",
        description: `The order has been updated to ${status}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update order status",
        description: error.response?.data?.error?.message || "Something went wrong",
      });
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'shipped': return 'secondary';
      case 'processing': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="py-10 text-center">Loading orders...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Management</CardTitle>
        <CardDescription>View and update order statuses</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Order #</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b hover:bg-muted/50">
                    <td className="py-2">{order.orderNumber}</td>
                    <td className="py-2">{order.shippingAddress?.name || 'Unknown'}</td>
                    <td className="py-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">${order.total?.toFixed(2) || '0.00'}</td>
                    <td className="py-2 text-right">
                      <select 
                        value="" 
                        onChange={(e) => {
                          if (e.target.value) {
                            handleOrderStatusUpdate(order._id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="p-1 border rounded"
                      >
                        <option value="">Update Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button variant="outline" onClick={() => navigate('/orders')}>View All Orders</Button>
      </CardFooter>
    </Card>
  );
};

const ProductManagement = ({ stats }) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products Overview</CardTitle>
        <CardDescription>Manage your product inventory</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between mb-6">
          <div>
            <h3 className="font-medium">Total Products</h3>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </div>
          <div>
            <h3 className="font-medium">Low Stock Alert</h3>
            <p className="text-2xl font-bold text-orange-500">{stats?.lowStock || 0}</p>
          </div>
        </div>
        
        <h3 className="font-medium mb-2">Products by Category</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.byCategory?.map(cat => ({
              name: cat._id || 'Uncategorized',
              count: cat.count
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Products" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button variant="outline" onClick={() => navigate('/products')}>Manage Products</Button>
      </CardFooter>
    </Card>
  );
};

export default Dashboard;