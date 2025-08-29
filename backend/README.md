# B2B Nexus Backend

A comprehensive B2B e-commerce platform backend built with Node.js, Express.js, and MongoDB Atlas. This platform enables sellers to create stores, list products, and manage inventory, while buyers can browse, search, and purchase products.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**: JWT-based authentication with role-based access control (Admin, Seller, Buyer)
- **Product Management**: CRUD operations for products with advanced search, filtering, and categorization
- **Order Management**: Complete order lifecycle from cart to delivery
- **Real-time Messaging**: Socket.IO-powered chat system between buyers and sellers
- **Payment Integration**: Stripe payment gateway integration
- **File Management**: Cloudinary integration for image and document uploads
- **Shopping Cart & Wishlist**: Full cart and wishlist functionality for buyers

### Advanced Features
- **SEO Optimization**: Product metadata, alternate names, and structured data
- **Analytics Dashboard**: Comprehensive admin analytics and reporting
- **Email Notifications**: Automated emails for orders, status updates, and messages
- **Rate Limiting**: API rate limiting for security
- **Caching**: Redis integration for performance optimization
- **Search & Filtering**: Advanced product search with multiple filters

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas with Mongoose ODM
- **Authentication**: JWT + bcrypt
- **Real-time**: Socket.IO
- **File Uploads**: Multer + Cloudinary
- **Payments**: Stripe
- **Caching**: Redis
- **Email**: Nodemailer
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting

## 📁 Project Structure

```
backend/
├── config/           # Configuration files
│   └── db.js        # MongoDB connection
├── middleware/       # Custom middleware
│   ├── auth.js      # Authentication & authorization
│   └── errorHandler.js # Error handling
├── models/          # Mongoose schemas
│   ├── User.js      # User model
│   ├── Product.js   # Product model
│   ├── Category.js  # Category model
│   ├── Order.js     # Order model
│   ├── Message.js   # Message model
│   ├── Conversation.js # Conversation model
│   ├── Cart.js      # Cart model
│   └── Wishlist.js  # Wishlist model
├── routes/          # API routes
│   ├── auth.js      # Authentication routes
│   ├── users.js     # User management routes
│   ├── products.js  # Product routes
│   ├── categories.js # Category routes
│   ├── orders.js    # Order routes
│   ├── messages.js  # Messaging routes
│   ├── cart.js      # Cart routes
│   ├── wishlist.js  # Wishlist routes
│   ├── admin.js     # Admin panel routes
│   └── payments.js  # Payment routes
├── socket/          # Socket.IO handlers
│   └── socketHandlers.js
├── utils/           # Utility functions
│   ├── emailService.js # Email service
│   └── cloudinaryService.js # Cloudinary integration
├── server.js        # Main application file
├── package.json     # Dependencies
└── .env             # Environment variables
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account
- Cloudinary account
- Stripe account
- Redis server (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Atlas Connection
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/b2b-nexus?retryWrites=true&w=majority

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRE=30d

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret

   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
   STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key

   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # Email Configuration (Gmail)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password

   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

5. **Verify installation**
   Visit `http://localhost:5000/health` to check if the server is running.

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "buyer",
  "company": {
    "name": "Company Name",
    "type": "manufacturer"
  }
}
```

#### POST `/api/auth/login`
User login
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Product Endpoints

#### GET `/api/products`
Get all products with pagination and filtering
```
GET /api/products?page=1&limit=20&category=electronics&minPrice=100&maxPrice=1000
```

#### POST `/api/products` (Seller only)
Create a new product
```json
{
  "name": "Product Name",
  "description": "Product description",
  "price": {
    "current": 99.99,
    "original": 129.99
  },
  "category": "categoryId",
  "stock": 100,
  "images": ["imageUrl1", "imageUrl2"]
}
```

### Cart Endpoints

#### GET `/api/cart`
Get user's shopping cart

#### POST `/api/cart/items`
Add item to cart
```json
{
  "productId": "productId",
  "sellerId": "sellerId",
  "quantity": 2,
  "notes": "Special instructions"
}
```

### Order Endpoints

#### POST `/api/orders`
Create a new order from cart
```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "zipCode": "12345",
    "country": "Country"
  },
  "paymentMethod": "stripe",
  "notes": "Order notes"
}
```

### Messaging Endpoints

#### GET `/api/messages/conversations`
Get user conversations

#### POST `/api/messages/send`
Send a message
```json
{
  "conversationId": "conversationId",
  "content": "Hello, I have a question about your product",
  "attachments": []
}
```

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full platform access, user management, analytics
- **Seller**: Store management, product management, order viewing
- **Buyer**: Product browsing, cart management, order placement

### JWT Token
Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🗄️ Database Models

### User Model
- Authentication fields (email, password, JWT)
- Profile information (firstName, lastName, avatar)
- Company details (name, type, logo, address)
- Role-based permissions
- Account status and verification

### Product Model
- Basic info (name, description, brand)
- Pricing (current, original, bulk pricing)
- Inventory (stock, SKU, weight, dimensions)
- Images and media
- SEO fields (meta title, description, keywords)
- Status and visibility controls

### Order Model
- Order items and quantities
- Buyer and seller information
- Pricing and shipping details
- Payment information
- Status timeline
- Shipping and billing addresses

## 🔌 Socket.IO Events

### Client to Server
- `send_message`: Send a new message
- `typing`: User typing indicator
- `mark_read`: Mark message as read
- `join_conversation`: Join a conversation room

### Server to Client
- `new_message`: Receive new message
- `typing_indicator`: Show typing indicator
- `message_read`: Message read confirmation
- `user_online`: User online status

## 📧 Email Notifications

The platform sends automated emails for:
- Welcome emails
- Password reset
- Order confirmation
- Order status updates
- New message notifications

## 🚀 Performance Optimization

- **Redis Caching**: Frequently accessed data caching
- **Image Optimization**: Cloudinary transformations
- **Database Indexing**: Optimized MongoDB queries
- **Rate Limiting**: API protection
- **Compression**: Response compression with gzip

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **Rate Limiting**: API abuse prevention
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Request data validation
- **Helmet**: Security headers

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📦 Deployment

### Environment Variables
Ensure all required environment variables are set in production.

### Database
- Use MongoDB Atlas production cluster
- Enable database backups
- Set up monitoring and alerts

### Security
- Use strong JWT secrets
- Enable HTTPS
- Set up proper CORS origins
- Configure rate limiting for production

### Monitoring
- Set up logging (Winston/Morgan)
- Monitor API performance
- Set up error tracking (Sentry)
- Database performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Updates & Maintenance

- Regular dependency updates
- Security patches
- Performance optimizations
- Feature enhancements

---

**B2B Nexus Backend** - Powering the future of B2B e-commerce