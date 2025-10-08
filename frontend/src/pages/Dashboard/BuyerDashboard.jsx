import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Helmet } from 'react-helmet';
import { useToast } from '../../hooks/use-toast';
import axios from 'axios';
import { API_URL } from '../../api/config';
import { useAuth } from '../../context/AuthContext';

const BuyerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState({
    recentOrders: [],
    savedItems: [],
    unreadMessages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBuyerDashboard = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/users/buyer/dashboard`);
        setData(data.data);
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

    fetchBuyerDashboard();
  }, [toast]);

  useEffect(() => {
    document.title = 'Buyer Dashboard | B2B Nexus';
  }, []);

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
        <title>Buyer Dashboard | B2B Nexus</title>
        <meta name="description" content="View your orders, saved items, and messages" />
      </Helmet>

      <div className="container mx-auto px-4 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Welcome, {user.name}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.recentOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                In the last 30 days
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
                View Orders
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saved Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.savedItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Products in your wishlist
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={() => navigate('/wishlist')}>
                View Saved Items
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.unreadMessages}</div>
              <p className="text-xs text-muted-foreground">
                Unread messages from sellers
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={() => navigate('/messages')}>
                View Messages
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <Tabs defaultValue="orders" className="mb-8">
          <TabsList>
            <TabsTrigger value="orders">Recent Orders</TabsTrigger>
            <TabsTrigger value="saved">Saved Items</TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Your Recent Orders</CardTitle>
                <CardDescription>Track and manage your purchases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Order #</th>
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Items</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-right py-2">Total</th>
                        <th className="text-right py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.length > 0 ? (
                        data.recentOrders.map((order) => (
                          <tr key={order._id} className="border-b hover:bg-muted/50">
                            <td className="py-2">{order.orderNumber}</td>
                            <td className="py-2">{new Date(order.date).toLocaleDateString()}</td>
                            <td className="py-2">{order.itemCount} items</td>
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
                            <td className="py-2 text-right">${order.total.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${order._id}`)}>
                                Details
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-muted-foreground">
                            No orders found. Start shopping to see your orders here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              {data.recentOrders.length > 0 && (
                <CardFooter>
                  <Button variant="outline" onClick={() => navigate('/orders')}>View All Orders</Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="saved">
            <Card>
              <CardHeader>
                <CardTitle>Saved Items</CardTitle>
                <CardDescription>Products you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                {data.savedItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.savedItems.map((item) => (
                      <Card key={item._id} className="overflow-hidden">
                        <div className="aspect-square relative">
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium mb-1 truncate">{item.name}</h3>
                          <p className="text-muted-foreground text-sm mb-2">{item.seller}</p>
                          <div className="flex justify-between items-center">
                            <span className="font-bold">${item.price.toFixed(2)}</span>
                            <Button size="sm" onClick={() => navigate(`/products/${item._id}`)}>
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>You don't have any saved items.</p>
                    <Button 
                      className="mt-4" 
                      variant="outline" 
                      onClick={() => navigate('/products')}
                    >
                      Browse Products
                    </Button>
                  </div>
                )}
              </CardContent>
              {data.savedItems.length > 0 && (
                <CardFooter>
                  <Button variant="outline" onClick={() => navigate('/wishlist')}>View All Saved Items</Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        </Tabs>
        
        <Card>
          <CardHeader>
            <CardTitle>Recommended for You</CardTitle>
            <CardDescription>Based on your previous purchases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10 text-muted-foreground">
              <p>Recommendations will appear here as you make more purchases.</p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/products')}
              >
                Browse All Products
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BuyerDashboard;