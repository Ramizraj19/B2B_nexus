#!/usr/bin/env python3
"""
B2B Nexus Backend API Testing Suite
Tests all authentication, product management, cart, order, and admin endpoints
"""

import requests
import sys
import json
import random
import os
from datetime import datetime
from typing import Dict, Any, Optional

class B2BNexusAPITester:
    def __init__(self, base_url: Optional[str] = None):
        if base_url is None:
            base_url = os.environ.get("BASE_URL", "http://localhost:5001")
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.products = {}  # Store created products
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status} - {name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.test_results.append({
            'name': name,
            'success': success,
            'details': details
        })
        return success

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                     token: str = None, params: Dict = None) -> tuple[bool, Dict, int]:
        """Make HTTP request with error handling"""
        # Normalize endpoint to avoid double /api
        endpoint = endpoint.lstrip('/')
        if endpoint.startswith('api/'):
            endpoint = endpoint[4:]
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": "Unsupported method"}, 0

            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            return response.status_code < 400, response_data, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_user_registration(self):
        """Test user registration for buyer and seller"""
        print("\n🔐 Testing User Registration...")
        
        test_users = [
            {
                "role": "seller",
                "email": f"seller_{datetime.now().strftime('%H%M%S')}@test.com",
                "firstName": "Test",
                "lastName": "Seller",
                "password": "SellerPass123!",
                "company": {
                    "name": "Seller Inc",
                    "businessType": "manufacturer"
                }
            },
            {
                "role": "buyer",
                "email": f"buyer_{datetime.now().strftime('%H%M%S')}@test.com",
                "firstName": "Test",
                "lastName": "Buyer",
                "password": "BuyerPass123!",
                "company": {
                    "name": "Buyer LLC",
                    "businessType": "manufacturer"
                }
            }
        ]

        for user_data in test_users:
            success, response, status_code = self.make_request('POST', '/api/auth/register', user_data)
            
            if success and 'data' in response and 'access_token' in response['data']:
                self.tokens[user_data['role']] = response['data']['access_token']
                self.users[user_data['role']] = response['data']['user']
                self.log_test(f"Register {user_data['role']}", True, f"Status: {status_code}")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test(f"Register {user_data['role']}", False, 
                              f"Status: {status_code}, Error: {error_msg}")

    def test_user_login(self):
        """Test user login"""
        print("\n🔑 Testing User Login...")
        
        # Test login for each registered user
        for role in ['admin', 'seller', 'buyer']:
            if role not in self.users:
                continue
                
            user = self.users[role]
            login_data = {
                "email": user['email'],
                "password": f"{role.title()}Pass123!"
            }
            
            success, response, status_code = self.make_request('POST', '/api/auth/login', login_data)
            
            if success and 'data' in response and 'access_token' in response['data']:
                # Update token (in case it's different)
                self.tokens[role] = response['data']['access_token']
                self.log_test(f"Login {role}", True, f"Status: {status_code}")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test(f"Login {role}", False, 
                              f"Status: {status_code}, Error: {error_msg}")

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n👤 Testing Get Current User...")
        
        for role in ['admin', 'seller', 'buyer']:
            if role not in self.tokens:
                continue
                
            success, response, status_code = self.make_request('GET', '/api/auth/me', token=self.tokens[role])
            
            if success and 'data' in response and 'id' in response['data'].get('user', {}):
                self.log_test(f"Get current user ({role})", True, f"Status: {status_code}")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test(f"Get current user ({role})", False, 
                              f"Status: {status_code}, Error: {error_msg}")

    def test_product_creation(self):
        """Test product creation by seller"""
        print("\n📦 Testing Product Creation...")
        
        if 'seller' not in self.tokens:
            self.log_test("Product creation", False, "No seller token available")
            return

        # Try to find a usable category
        category_id = None
        # Prefer electronics
        success, response, status_code = self.make_request('GET', 'categories/search', params={'q': 'electronics'}, token=self.tokens['seller'])
        if success and 'data' in response and response['data'].get('categories'):
            category_id = response['data']['categories'][0]['id']
        else:
            # Fallback: list categories
            success, response, status_code = self.make_request('GET', 'categories', token=self.tokens['seller'])
            if success and 'data' in response and response['data'].get('categories'):
                category_id = response['data']['categories'][0]['id']

        if not category_id:
            self.log_test("Product creation", False, "No category available (requires admin to create)")
            return

        test_products = [
            {
                "name": "Test Laptop",
                "description": "High-performance laptop for business",
                "price": {
                    "current": 75000.0,
                    "currency": "USD"
                },
                "inventory": {
                    "stock": 10,
                    "minOrderQuantity": 1
                },
                "category": category_id,
                "tags": ["laptop", "computer", "business"],
                "sku": f"LAPTOP_{random.randint(1000, 9999)}",
                "status": "active",
                "visibility": "public",
                "images": {"primary": "https://via.placeholder.com/600x400.png?text=Product"}
            }
        ]

        for product_data in test_products:
            success, response, status_code = self.make_request(
                'POST', 'products', product_data, token=self.tokens['seller']
            )
            
            if success and 'data' in response and 'id' in response['data'].get('product', {}):
                product = response['data']['product']
                self.products[product['id']] = product
                self.log_test(f"Create product: {product_data['name']}", True, f"Status: {status_code}")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test(f"Create product: {product_data['name']}", False, 
                              f"Status: {status_code}, Error: {error_msg}")

    def test_product_listing(self):
        """Test product listing and filtering"""
        print("\n📋 Testing Product Listing...")
        
        # Test basic product listing
        success, response, status_code = self.make_request('GET', '/api/products')
        
        if success and 'data' in response and isinstance(response['data'].get('products', []), list):
            products = response['data']['products']
            self.log_test("List all products", True, f"Status: {status_code}, Found: {len(products)} products")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("List all products", False, 
                          f"Status: {status_code}, Error: {error_msg}")

        # Test search functionality
        success, response, status_code = self.make_request('GET', '/api/products', params={'search': 'laptop'})
        
        if success and 'data' in response and isinstance(response['data'].get('products', []), list):
            products = response['data']['products']
            self.log_test("Search products", True, f"Status: {status_code}, Found: {len(products)} products")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Search products", False, 
                          f"Status: {status_code}, Error: {error_msg}")

        # Test category filtering
        success, response, status_code = self.make_request('GET', '/api/products', params={'category': 'electronics'})
        
        if success and 'data' in response and isinstance(response['data'].get('products', []), list):
            products = response['data']['products']
            self.log_test("Filter by category", True, f"Status: {status_code}, Found: {len(products)} products")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Filter by category", False, 
                          f"Status: {status_code}, Error: {error_msg}")

    def test_product_update(self):
        """Test product update by seller"""
        print("\n✏️ Testing Product Update...")
        
        if 'seller' not in self.tokens or not self.products:
            self.log_test("Product update", False, "No seller token or products available")
            return

        product_id = list(self.products.keys())[0]
        update_data = {
            "price": {
                "current": 80000.0
            },
            "inventory": {
                "stock": 15
            }
        }

        success, response, status_code = self.make_request(
            'PUT', f'/api/products/{product_id}', update_data, token=self.tokens['seller']
        )
        
        if success and 'data' in response and 'id' in response['data'].get('product', {}):
            self.log_test("Update product", True, f"Status: {status_code}")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Update product", False, 
                          f"Status: {status_code}, Error: {error_msg}")

    def test_cart_functionality(self):
        """Test cart operations for buyer"""
        print("\n🛒 Testing Cart Functionality...")
        
        if 'buyer' not in self.tokens:
            self.log_test("Cart functionality", False, "No buyer token available")
            return

        success, response, status_code = self.make_request('GET', 'cart', token=self.tokens['buyer'])
        
        if success and 'data' in response and 'cart' in response['data']:
            self.log_test("Get cart", True, f"Status: {status_code}")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Get cart", False, f"Status: {status_code}, Error: {error_msg}")

        # Add to cart if we have a product
        if self.products:
            product_id = list(self.products.keys())[0]
            product = self.products[product_id]
            seller_id = product.get('seller', {}).get('id') or self.users.get('seller', {}).get('id')
            cart_data = {
                "productId": product_id,
                "sellerId": seller_id,
                "quantity": 2
            }
            success, response, status_code = self.make_request('POST', 'cart/items', cart_data, token=self.tokens['buyer'])
            if success and 'data' in response and 'cart' in response['data']:
                self.log_test("Add to cart", True, f"Status: {status_code}")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test("Add to cart", False, f"Status: {status_code}, Error: {error_msg}")

    def test_order_creation(self):
        """Test order creation"""
        print("\n📋 Testing Order Creation...")
        
        if 'buyer' not in self.tokens or not self.products:
            self.log_test("Order creation", False, "No buyer token or products available")
            return

        # First get cart
        success, cart_response, _ = self.make_request('GET', 'cart', token=self.tokens['buyer'])
        
        items_payload = []
        if success and cart_response.get('data', {}).get('cart', {}).get('items'):
            for item in cart_response['data']['cart']['items']:
                if item.get('product') and isinstance(item['product'], dict):
                    items_payload.append({
                        'product': item['product']['id'],
                        'quantity': item['quantity']
                    })

        if not items_payload:
            self.log_test("Create order", False, "No items in cart")
            return

        order_data = {
            "items": items_payload,
            "shipping": {
                "method": "standard",
                "cost": 0,
                "estimatedDays": 5
            },
            "billingAddress": {
                "firstName": "Test",
                "lastName": "Buyer",
                "company": "Test Company",
                "address": {
                    "street": "123 Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "country": "Test Country",
                    "zipCode": "12345"
                },
                "phone": "+1234567890",
                "email": self.users['buyer']['email']
            },
            "shippingAddress": {
                "firstName": "Test",
                "lastName": "Buyer",
                "company": "Test Company",
                "address": {
                    "street": "123 Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "country": "Test Country",
                    "zipCode": "12345"
                },
                "phone": "+1234567890",
                "email": self.users['buyer']['email']
            },
            "payment": {
                "method": "stripe"
            }
        }

        success, response, status_code = self.make_request('POST', 'orders', order_data, token=self.tokens['buyer'])
        
        if success and 'data' in response and 'order' in response['data']:
            self.log_test("Create order", True, f"Status: {status_code}")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Create order", False, f"Status: {status_code}, Error: {error_msg}")

    def test_get_orders(self):
        """Test getting orders for different roles"""
        print("\n📦 Testing Get Orders...")
        
        for role in ['buyer', 'seller', 'admin']:
            if role not in self.tokens:
                continue
                
            success, response, status_code = self.make_request('GET', '/api/orders', token=self.tokens[role])
            
            if success and 'data' in response and isinstance(response['data'].get('orders', []), list):
                orders = response['data']['orders']
                self.log_test(f"Get orders ({role})", True, f"Status: {status_code}, Found: {len(orders)} orders")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test(f"Get orders ({role})", False, 
                              f"Status: {status_code}, Error: {error_msg}")

    def test_admin_endpoints(self):
        """Skip admin tests if no admin token"""
        print("\n👑 Testing Admin Endpoints...")
        
        if 'admin' not in self.tokens:
            self.log_test("Admin endpoints", False, "No admin token available")
            return

        # Test get all users
        success, response, status_code = self.make_request('GET', '/api/admin/users', token=self.tokens['admin'])
        
        if success and 'data' in response and isinstance(response['data'].get('users', []), list):
            users = response['data']['users']
            self.log_test("Get all users (admin)", True, f"Status: {status_code}, Found: {len(users)} users")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Get all users (admin)", False, 
                          f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

        # Test get analytics
        success, response, status_code = self.make_request('GET', '/api/admin/analytics', token=self.tokens['admin'])
        
        if success and 'data' in response and response['data']:
            self.log_test("Get analytics (admin)", True, f"Status: {status_code}")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Get analytics (admin)", False, 
                          f"Status: {status_code}, Error: {error_msg}")

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n🚫 Testing Unauthorized Access...")
        
        # Test accessing admin endpoint with buyer token
        if 'buyer' in self.tokens:
            success, response, status_code = self.make_request('GET', '/api/admin/users', token=self.tokens['buyer'])
            
            if not success and status_code == 403:
                self.log_test("Buyer accessing admin endpoint", True, "Correctly denied access")
            else:
                error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
                self.log_test("Buyer accessing admin endpoint", False, f"Should have been denied access, got: {error_msg}")

        # Test accessing protected endpoint without token
        success, response, status_code = self.make_request('GET', '/api/auth/me')
        
        if not success and status_code == 401:
            self.log_test("Access without token", True, "Correctly denied access")
        else:
            error_msg = response.get('message', 'Unknown error') if isinstance(response, dict) else str(response)
            self.log_test("Access without token", False, f"Should have been denied access, got: {error_msg}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting B2B Nexus API Testing Suite")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)

        # Run test suites in order
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        self.test_product_creation()
        self.test_product_listing()
        self.test_product_update()
        self.test_cart_functionality()
        self.test_order_creation()
        self.test_get_orders()
        self.test_admin_endpoints()
        self.test_unauthorized_access()

        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")

        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")

        return self.tests_passed == self.tests_run

def main():
    """Main function to run tests"""
    print("🚀 Starting B2B Nexus API Testing Suite")
    override_url = sys.argv[1] if len(sys.argv) > 1 else None
    tester = B2BNexusAPITester(override_url)
    print(f"🌐 Testing against: {tester.base_url}")
    print("="*60)
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())