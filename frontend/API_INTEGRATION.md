# Frontend API Integration

This document describes how the frontend pages have been connected to the backend API, replacing hardcoded mock data with live data.

## API Structure

### Configuration (`src/api/config.js`)
- Centralized axios configuration with interceptors
- Automatic token management
- Error handling for authentication failures
- Base URL configuration

### API Modules

#### Products API (`src/api/products.js`)
- `getProducts(params)` - Fetch products with filters, pagination, search
- `getProduct(id)` - Get single product details
- `getProductsByCategory(categoryId, params)` - Filter by category
- `searchProducts(searchTerm, params)` - Search products
- `getFeaturedProducts(params)` - Get featured products
- `getMyProducts(params)` - Get seller's products (authenticated)
- `createProduct(productData)` - Create new product (seller only)
- `updateProduct(id, productData)` - Update product (seller only)
- `deleteProduct(id)` - Delete product (seller only)
- `getCategories()` - Get all product categories

#### Cart API (`src/api/cart.js`)
- `getCart()` - Get user's cart (authenticated)
- `addToCart(productId, quantity, sellerId, notes)` - Add item to cart
- `updateCartItem(itemId, quantity)` - Update item quantity
- `removeFromCart(itemId)` - Remove item from cart
- `clearCart()` - Clear entire cart
- `applyDiscount(discountCode)` - Apply discount code
- `removeDiscount()` - Remove discount
- `getCartSummary()` - Get cart totals and summary

#### Orders API (`src/api/orders.js`)
- `getOrders(params)` - Get user's orders (authenticated)
- `getOrder(orderId)` - Get single order details
- `createOrder(orderData)` - Create new order (buyer only)
- `updateOrderStatus(orderId, status, notes)` - Update order status
- `cancelOrder(orderId, reason)` - Cancel order
- `getOrderTracking(orderId)` - Get tracking information
- `getOrdersByStatus(status, params)` - Filter by status
- `getSellerOrders(params)` - Get seller's orders (seller only)
- `getOrderStats(params)` - Get order statistics

#### Users API (`src/api/users.js`)
- `getCurrentUser()` - Get current user profile (authenticated)
- `updateProfile(userData)` - Update user profile
- `getUser(userId)` - Get user by ID (admin only)
- `getAllUsers(params)` - Get all users (admin only)
- `updateUser(userId, userData)` - Update user (admin only)
- `deleteUser(userId)` - Delete user (admin only)
- `changePassword(currentPassword, newPassword)` - Change password
- `uploadProfilePicture(formData)` - Upload profile picture
- `getUserStats()` - Get user statistics

## Updated Components

### ProductsPage
- ✅ Live product data from API
- ✅ Search and filtering
- ✅ Category filtering
- ✅ Pagination
- ✅ Loading states with Skeleton components
- ✅ Error handling

### CartPage
- ✅ Live cart data from API
- ✅ Add/remove/update cart items
- ✅ Real-time totals calculation
- ✅ Loading states
- ✅ Authentication checks
- ✅ Error handling

### OrdersPage
- ✅ Live order data from API
- ✅ Status filtering
- ✅ Pagination
- ✅ Role-based data (buyer/seller)
- ✅ Loading states
- ✅ Error handling

### MyProductsPage
- ✅ Live product management for sellers
- ✅ Create, update, delete products
- ✅ Category selection from API
- ✅ Status management
- ✅ Loading states
- ✅ Error handling

### Dashboard
- ✅ Live statistics and data
- ✅ Role-based dashboard content
- ✅ Recent activity from API
- ✅ Loading states
- ✅ Error handling

## Features Added

### Loading States
- Skeleton components for better UX
- Loading spinners and placeholders
- Progressive loading of data

### Error Handling
- Graceful error display
- Retry mechanisms
- User-friendly error messages
- Fallback content

### Authentication Integration
- Automatic token management
- Role-based access control
- Protected routes and components
- Session handling

### Real-time Data
- Live product information
- Real-time cart updates
- Current order status
- Live statistics

## Usage Examples

### Fetching Products
```javascript
import { productsAPI } from '../api';

// Get all products
const products = await productsAPI.getProducts();

// Search products
const searchResults = await productsAPI.searchProducts('widget');

// Get products by category
const categoryProducts = await productsAPI.getProductsByCategory('categoryId');
```

### Managing Cart
```javascript
import { cartAPI } from '../api';

// Get cart
const cart = await cartAPI.getCart();

// Add item to cart
await cartAPI.addToCart('productId', 2, 'sellerId', 'Notes');

// Update quantity
await cartAPI.updateCartItem('itemId', 3);
```

### Managing Orders
```javascript
import { ordersAPI } from '../api';

// Get user orders
const orders = await ordersAPI.getOrders();

// Create new order
const newOrder = await ordersAPI.createOrder(orderData);

// Update order status
await ordersAPI.updateOrderStatus('orderId', 'shipped');
```

## Environment Configuration

Make sure to set the backend URL in your environment variables:

```bash
REACT_APP_BACKEND_URL=http://localhost:5001
```

The default fallback is `http://localhost:5001` if not specified.

## Error Handling

The API layer includes comprehensive error handling:
- Network errors
- Authentication failures
- Validation errors
- Server errors
- Rate limiting

All errors are caught and displayed to users with appropriate retry options.

## Performance Optimizations

- Pagination for large datasets
- Debounced search
- Efficient state management
- Minimal API calls
- Loading states to prevent layout shifts
