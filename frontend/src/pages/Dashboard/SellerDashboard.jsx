import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Helmet } from 'react-helmet';
import { useToast } from '../../hooks/use-toast';
import axios from 'axios';
import { API_URL } from '../../api/config';
import { useAuth } from '../../context/AuthContext';

const SellerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalSales: 0,
    recentOrders: [],
    productStats: [],
    salesData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerDashboard = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/users/seller/dashboard`);
        setStats(data.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching dashboard data",
          description: error.response?.data?.error?.message || "Something went wrong"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSellerDashboard();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Seller Dashboard | B2B Nexus</title>
        <meta name="description" content="Manage your products, orders, and store performance" />
      </Helmet>

      <div className="container mx-auto px-4 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Seller Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                For all your products
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+2</span> this week
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={() => navigate('/my-products')}>
                Manage Products
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Orders to Fulfill</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-amber-600">3</span> need shipping
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
                View Orders
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <Tabs defaultValue="products" className="mb-8">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Recent Orders</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Product Performance</CardTitle>
                <CardDescription>Your top-selling products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.productStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sales" fill="#8884d8" name="Sales ($)" />
                      <Bar dataKey="quantity" fill="#82ca9d" name="Units Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => navigate('/my-products/add')}>Add New Product</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest orders for your products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Order #</th>
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Customer</th>
                        <th className="text-left py-2">Product</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-right py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.length > 0 ? (
                        stats.recentOrders.map((order) => (
                          <tr key={order._id} className="border-b hover:bg-muted/50">
                            <td className="py-2">{order.orderNumber}</td>
                            <td className="py-2">{new Date(order.date).toLocaleDateString()}</td>
                            <td className="py-2">{order.customer}</td>
                            <td className="py-2">{order.product}</td>
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
                            <td className="py-2 text-right">${order.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-muted-foreground">
                            No recent orders found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => navigate('/orders')}>View All Orders</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Sales Performance</CardTitle>
                <CardDescription>Monthly sales overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SellerDashboard;