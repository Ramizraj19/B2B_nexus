import React, { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { cartAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';

const CartPage = () => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({});
  const [cartTotals, setCartTotals] = useState({
    subtotal: 0,
    discount: 0,
    total: 0,
    totalItems: 0
  });

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cartAPI.getCart();
      
      if (response.success) {
        const cartData = response.data.cart;
        setCartItems(cartData.items || []);
        setCartTotals(cartData.totals || {
          subtotal: 0,
          discount: 0,
          total: 0,
          totalItems: 0
        });
      } else {
        setError(response.message || 'Failed to fetch cart');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      await removeItem(itemId);
      return;
    }

    try {
      setUpdating(prev => ({ ...prev, [itemId]: true }));
      
      const response = await cartAPI.updateCartItem(itemId, newQuantity);
      
      if (response.success) {
        // Update local state with new cart data
        const cartData = response.data.cart;
        setCartItems(cartData.items || []);
        setCartTotals(cartData.totals || cartTotals);
      } else {
        setError(response.message || 'Failed to update quantity');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update quantity');
    } finally {
      setUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const removeItem = async (itemId) => {
    try {
      setUpdating(prev => ({ ...prev, [itemId]: true }));
      
      const response = await cartAPI.removeFromCart(itemId);
      
      if (response.success) {
        // Update local state with new cart data
        const cartData = response.data.cart;
        setCartItems(cartData.items || []);
        setCartTotals(cartData.totals || cartTotals);
      } else {
        setError(response.message || 'Failed to remove item');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove item');
    } finally {
      setUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const clearCart = async () => {
    try {
      const response = await cartAPI.clearCart();
      
      if (response.success) {
        setCartItems([]);
        setCartTotals({
          subtotal: 0,
          discount: 0,
          total: 0,
          totalItems: 0
        });
      } else {
        setError(response.message || 'Failed to clear cart');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear cart');
    }
  };

  const CartItemSkeleton = () => (
    <Card className="bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-10 w-20" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-20" />
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
            <div className="text-lg text-gray-600 mb-4">Please log in to view your cart</div>
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
            <Button onClick={fetchCart}>Try Again</Button>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shopping Cart</h1>
          <p className="text-gray-600">Review your items and proceed to checkout</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <CartItemSkeleton key={index} />
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-600 mb-6">Add some products to get started</p>
              <Button onClick={() => window.location.href = '/products'}>
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item._id} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {item.product?.name || 'Product Name Unavailable'}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                          {item.product?.description || 'No description available'}
                        </p>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm text-gray-600">Qty:</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item._id, parseInt(e.target.value))}
                              className="w-20"
                              disabled={updating[item._id]}
                            />
                          </div>
                          <span className="text-lg font-semibold text-green-600">
                            ${((item.product?.price?.current || item.product?.price || 0) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item._id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={updating[item._id]}
                      >
                        {updating[item._id] ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Clear Cart Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear Cart
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white sticky top-8">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {cartItems.map((item) => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span>{item.product?.name || 'Product'} (x{item.quantity})</span>
                        <span>${((item.product?.price?.current || item.product?.price || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${cartTotals.subtotal.toFixed(2)}</span>
                    </div>
                    {cartTotals.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-${cartTotals.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>${cartTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full" size="lg">
                    Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;