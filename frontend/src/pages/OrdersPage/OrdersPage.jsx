import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { ordersAPI } from '../../api';

const OrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user, currentPage, selectedStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        limit: 10,
        ...(selectedStatus && { status: selectedStatus })
      };

      // Use different API calls based on user role
      let response;
      if (user?.role === 'seller') {
        response = await ordersAPI.getSellerOrders(params);
      } else {
        response = await ordersAPI.getOrders(params);
      }
      
      if (response.success) {
        setOrders(response.data.orders || response.orders || []);
        setTotalPages(response.data.totalPages || response.totalPages || 1);
      } else {
        setError(response.message || 'Failed to fetch orders');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      confirmed: { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
      processing: { color: 'bg-purple-100 text-purple-800', label: 'Processing' },
      shipped: { color: 'bg-blue-100 text-blue-800', label: 'Shipped' },
      delivered: { color: 'bg-green-100 text-green-800', label: 'Delivered' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      refunded: { color: 'bg-gray-100 text-gray-800', label: 'Refunded' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const OrderSkeleton = () => (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-gray-600 mb-4">Please log in to view your orders</div>
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
            <Button onClick={fetchOrders}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {user?.role === 'buyer' ? 'My Orders' : 'Orders'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'buyer' 
              ? 'Track your order history and current orders' 
              : 'Manage and track all orders from your customers'
            }
          </p>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedStatus === '' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('')}
              size="sm"
            >
              All Orders
            </Button>
            <Button
              variant={selectedStatus === 'pending' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('pending')}
              size="sm"
            >
              Pending
            </Button>
            <Button
              variant={selectedStatus === 'shipped' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('shipped')}
              size="sm"
            >
              Shipped
            </Button>
            <Button
              variant={selectedStatus === 'delivered' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('delivered')}
              size="sm"
            >
              Delivered
            </Button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <OrderSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order._id} className="bg-white hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Order #{order.orderNumber || order._id}</CardTitle>
                        <CardDescription>
                          {formatDate(order.createdAt)} • {order.items?.length || 0} items
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(order.status)}
                        <span className="text-2xl font-bold text-green-600">
                          ${order.total?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Order Items */}
                      <div className="space-y-2">
                        {order.items?.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-600">
                            <span>
                              {item.product?.name || item.name} (x{item.quantity})
                            </span>
                            <span>${(item.unitPrice || item.price || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Order Details */}
                      <div className="pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Customer:</span>
                          <span>{order.customer?.firstName} {order.customer?.lastName}</span>
                        </div>
                        {user?.role === 'buyer' && order.seller && (
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">Seller:</span>
                            <span>{order.seller?.company?.name || `${order.seller?.firstName} ${order.seller?.lastName}`}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        {order.status === 'pending' && user?.role === 'buyer' && (
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            Cancel Order
                          </Button>
                        )}
                        {order.status === 'shipped' && user?.role === 'buyer' && (
                          <Button variant="outline" size="sm">
                            Track Package
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {orders.length === 0 && !loading && (
              <Card className="bg-white">
                <CardContent className="p-12 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders found</h3>
                  <p className="text-gray-600 mb-6">
                    {selectedStatus 
                      ? `No orders with status "${selectedStatus}" found.`
                      : 'You haven\'t placed any orders yet.'
                    }
                  </p>
                  <Button onClick={() => window.location.href = '/products'}>
                    Browse Products
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;