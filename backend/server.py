from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_TIME = 7  # days

# Create the main app without a prefix
app = FastAPI(title="B2B Nexus API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    SELLER = "seller"
    BUYER = "buyer"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    full_name: str
    role: UserRole
    is_active: bool = True
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role: UserRole
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    alternate_names: List[str] = []
    description: str
    price: float
    stock_quantity: int
    category: str
    tags: List[str] = []
    images: List[str] = []
    seller_id: str
    seller_name: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    alternate_names: List[str] = []
    description: str
    price: float
    stock_quantity: int
    category: str
    tags: List[str] = []
    images: List[str] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    alternate_names: Optional[List[str]] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None

class CartItem(BaseModel):
    product_id: str
    product_name: str
    price: float
    quantity: int
    seller_id: str

class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem] = []
    total_amount: float = 0.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    buyer_id: str
    buyer_name: str
    seller_id: str
    seller_name: str
    items: List[CartItem]
    total_amount: float
    status: OrderStatus = OrderStatus.PENDING
    shipping_address: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    items: List[CartItem]
    shipping_address: str

# Utility Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_TIME)
    to_encode = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_doc = await db.users.find_one({"id": user_id})
        if user_doc is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash password and create user
    hashed_password = hash_password(user_data.password)
    user_dict = user_data.dict()
    user_dict.pop('password')
    
    user = User(**user_dict)
    user_doc = user.dict()
    user_doc['password'] = hashed_password
    
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token = create_access_token(user.id, user.role.value)
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc or not verify_password(login_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account deactivated")
    
    access_token = create_access_token(user.id, user.role.value)
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Product Routes
@api_router.post("/products", response_model=Product)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    product_dict = product_data.dict()
    product_dict['seller_id'] = current_user.id
    product_dict['seller_name'] = current_user.full_name
    
    product = Product(**product_dict)
    await db.products.insert_one(product.dict())
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None
):
    filter_query = {"is_active": True}
    
    if category:
        filter_query["category"] = category
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    if min_price is not None or max_price is not None:
        price_filter = {}
        if min_price is not None:
            price_filter["$gte"] = min_price
        if max_price is not None:
            price_filter["$lte"] = max_price
        filter_query["price"] = price_filter
    
    products = await db.products.find(filter_query).skip(skip).limit(limit).to_list(length=None)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product_doc = await db.products.find_one({"id": product_id, "is_active": True})
    if not product_doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product_doc)

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: User = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    product_doc = await db.products.find_one({"id": product_id})
    if not product_doc:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if current_user.role == UserRole.SELLER and product_doc["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this product")
    
    update_data = {k: v for k, v in product_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated_product = await db.products.find_one({"id": product_id})
    return Product(**updated_product)

@api_router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    product_doc = await db.products.find_one({"id": product_id})
    if not product_doc:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if current_user.role == UserRole.SELLER and product_doc["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")
    
    await db.products.update_one({"id": product_id}, {"$set": {"is_active": False}})
    return {"message": "Product deleted successfully"}

# Cart Routes
@api_router.get("/cart", response_model=Cart)
async def get_cart(current_user: User = Depends(require_role([UserRole.BUYER]))):
    cart_doc = await db.carts.find_one({"user_id": current_user.id})
    if not cart_doc:
        cart = Cart(user_id=current_user.id)
        await db.carts.insert_one(cart.dict())
        return cart
    return Cart(**cart_doc)

@api_router.post("/cart/add")
async def add_to_cart(
    product_id: str,
    quantity: int = 1,
    current_user: User = Depends(require_role([UserRole.BUYER]))
):
    product_doc = await db.products.find_one({"id": product_id, "is_active": True})
    if not product_doc:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_doc["stock_quantity"] < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    cart_doc = await db.carts.find_one({"user_id": current_user.id})
    if not cart_doc:
        cart = Cart(user_id=current_user.id)
        cart_doc = cart.dict()
    
    cart_item = CartItem(
        product_id=product_id,
        product_name=product_doc["name"],
        price=product_doc["price"],
        quantity=quantity,
        seller_id=product_doc["seller_id"]
    )
    
    # Check if item already exists in cart
    items = cart_doc.get("items", [])
    existing_item = None
    for i, item in enumerate(items):
        if item["product_id"] == product_id:
            existing_item = i
            break
    
    if existing_item is not None:
        items[existing_item]["quantity"] += quantity
    else:
        items.append(cart_item.dict())
    
    total_amount = sum(item["price"] * item["quantity"] for item in items)
    
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$set": {"items": items, "total_amount": total_amount, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {"message": "Item added to cart successfully"}

# Order Routes
@api_router.post("/orders", response_model=Order)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(require_role([UserRole.BUYER]))
):
    total_amount = sum(item.price * item.quantity for item in order_data.items)
    
    order = Order(
        buyer_id=current_user.id,
        buyer_name=current_user.full_name,
        seller_id=order_data.items[0].seller_id,  # Assuming single seller per order
        seller_name="",  # Will be filled from seller info
        items=order_data.items,
        total_amount=total_amount,
        shipping_address=order_data.shipping_address
    )
    
    # Get seller name
    seller_doc = await db.users.find_one({"id": order.seller_id})
    if seller_doc:
        order.seller_name = seller_doc["full_name"]
    
    await db.orders.insert_one(order.dict())
    
    # Clear cart after order
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$set": {"items": [], "total_amount": 0.0}}
    )
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.BUYER:
        orders = await db.orders.find({"buyer_id": current_user.id}).to_list(length=None)
    elif current_user.role == UserRole.SELLER:
        orders = await db.orders.find({"seller_id": current_user.id}).to_list(length=None)
    else:  # Admin
        orders = await db.orders.find().to_list(length=None)
    
    return [Order(**order) for order in orders]

# Admin Routes
@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find().to_list(length=None)
    return [User(**user) for user in users]

@api_router.get("/admin/analytics")
async def get_analytics(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({"is_active": True})
    total_orders = await db.orders.count_documents({})
    total_revenue = await db.orders.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]).to_list(length=1)
    
    revenue = total_revenue[0]["total"] if total_revenue else 0
    
    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": revenue
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()