#!/usr/bin/env python3
"""
B2B Nexus Backend API Testing Suite
Tests all authentication, product management, cart, order, and admin endpoints
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class B2BNexusAPITester:
    def __init__(self, base_url="https://b2b-connect-1.preview.emergentagent.com"):
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
        """Test user registration for all roles"""
        print("\n🔐 Testing User Registration...")
        
        test_users = [
            {
                "role": "admin",
                "email": f"admin_{datetime.now().strftime('%H%M%S')}@test.com",
                "username": f"admin_{datetime.now().strftime('%H%M%S')}",
                "full_name": "Test Admin",
                "password": "AdminPass123!",
                "company_name": "Admin Corp"
            },
            {
                "role": "seller",
                "email": f"seller_{datetime.now().strftime('%H%M%S')}@test.com",
                "username": f"seller_{datetime.now().strftime('%H%M%S')}",
                "full_name": "Test Seller",
                "password": "SellerPass123!",
                "company_name": "Seller Inc"
            },
            {
                "role": "buyer",
                "email": f"buyer_{datetime.now().strftime('%H%M%S')}@test.com",
                "username": f"buyer_{datetime.now().strftime('%H%M%S')}",
                "full_name": "Test Buyer",
                "password": "BuyerPass123!",
                "company_name": "Buyer LLC"
            }
        ]

        for user_data in test_users:
            success, response, status_code = self.make_request('POST', 'auth/register', user_data)
            
            if success and 'access_token' in response:
                self.tokens[user_data['role']] = response['access_token']
                self.users[user_data['role']] = response['user']
                self.log_test(f"Register {user_data['role']}", True, f"Status: {status_code}")
            else:
                self.log_test(f"Register {user_data['role']}", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

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
            
            success, response, status_code = self.make_request('POST', 'auth/login', login_data)
            
            if success and 'access_token' in response:
                # Update token (in case it's different)
                self.tokens[role] = response['access_token']
                self.log_test(f"Login {role}", True, f"Status: {status_code}")
            else:
                self.log_test(f"Login {role}", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n👤 Testing Get Current User...")
        
        for role in ['admin', 'seller', 'buyer']:
            if role not in self.tokens:
                continue
                
            success, response, status_code = self.make_request('GET', 'auth/me', token=self.tokens[role])
            
            if success and 'id' in response:
                self.log_test(f"Get current user ({role})", True, f"Status: {status_code}")
            else:
                self.log_test(f"Get current user ({role})", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_product_creation(self):
        """Test product creation by seller"""
        print("\n📦 Testing Product Creation...")
        
        if 'seller' not in self.tokens:
            self.log_test("Product creation", False, "No seller token available")
            return

        test_products = [
            {
                "name": "Test Laptop",
                "description": "High-performance laptop for business",
                "price": 75000.0,
                "stock_quantity": 10,
                "category": "electronics",
                "tags": ["laptop", "computer", "business"]
            },
            {
                "name": "Office Chair",
                "description": "Ergonomic office chair",
                "price": 15000.0,
                "stock_quantity": 25,
                "category": "furniture",
                "tags": ["chair", "office", "ergonomic"]
            }
        ]

        for product_data in test_products:
            success, response, status_code = self.make_request(
                'POST', 'products', product_data, token=self.tokens['seller']
            )
            
            if success and 'id' in response:
                self.products[response['id']] = response
                self.log_test(f"Create product: {product_data['name']}", True, f"Status: {status_code}")
            else:
                self.log_test(f"Create product: {product_data['name']}", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_product_listing(self):
        """Test product listing and filtering"""
        print("\n📋 Testing Product Listing...")
        
        # Test basic product listing
        success, response, status_code = self.make_request('GET', 'products')
        
        if success and isinstance(response, list):
            self.log_test("List all products", True, f"Status: {status_code}, Found: {len(response)} products")
        else:
            self.log_test("List all products", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

        # Test search functionality
        success, response, status_code = self.make_request('GET', 'products', params={'search': 'laptop'})
        
        if success and isinstance(response, list):
            self.log_test("Search products", True, f"Status: {status_code}, Found: {len(response)} products")
        else:
            self.log_test("Search products", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

        # Test category filtering
        success, response, status_code = self.make_request('GET', 'products', params={'category': 'electronics'})
        
        if success and isinstance(response, list):
            self.log_test("Filter by category", True, f"Status: {status_code}, Found: {len(response)} products")
        else:
            self.log_test("Filter by category", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_product_update(self):
        """Test product update by seller"""
        print("\n✏️ Testing Product Update...")
        
        if 'seller' not in self.tokens or not self.products:
            self.log_test("Product update", False, "No seller token or products available")
            return

        product_id = list(self.products.keys())[0]
        update_data = {
            "price": 80000.0,
            "stock_quantity": 15
        }

        success, response, status_code = self.make_request(
            'PUT', f'products/{product_id}', update_data, token=self.tokens['seller']
        )
        
        if success and 'id' in response:
            self.log_test("Update product", True, f"Status: {status_code}")
        else:
            self.log_test("Update product", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_cart_functionality(self):
        """Test cart operations for buyer"""
        print("\n🛒 Testing Cart Functionality...")
        
        if 'buyer' not in self.tokens:
            self.log_test("Cart functionality", False, "No buyer token available")
            return

        # Test get cart
        success, response, status_code = self.make_request('GET', 'cart', token=self.tokens['buyer'])
        
        if success and 'id' in response:
            self.log_test("Get cart", True, f"Status: {status_code}")
        else:
            self.log_test("Get cart", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

        # Test add to cart
        if self.products:
            product_id = list(self.products.keys())[0]
            success, response, status_code = self.make_request(
                'POST', 'cart/add', token=self.tokens['buyer'], 
                params={'product_id': product_id, 'quantity': 2}
            )
            
            if success:
                self.log_test("Add to cart", True, f"Status: {status_code}")
            else:
                self.log_test("Add to cart", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_order_creation(self):
        """Test order creation"""
        print("\n📋 Testing Order Creation...")
        
        if 'buyer' not in self.tokens or not self.products:
            self.log_test("Order creation", False, "No buyer token or products available")
            return

        # First get cart to see items
        success, cart_response, _ = self.make_request('GET', 'cart', token=self.tokens['buyer'])
        
        if success and cart_response.get('items'):
            order_data = {
                "items": cart_response['items'],
                "shipping_address": "123 Test Street, Test City, 12345"
            }
            
            success, response, status_code = self.make_request(
                'POST', 'orders', order_data, token=self.tokens['buyer']
            )
            
            if success and 'id' in response:
                self.log_test("Create order", True, f"Status: {status_code}")
            else:
                self.log_test("Create order", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")
        else:
            self.log_test("Create order", False, "No items in cart")

    def test_get_orders(self):
        """Test getting orders for different roles"""
        print("\n📦 Testing Get Orders...")
        
        for role in ['buyer', 'seller', 'admin']:
            if role not in self.tokens:
                continue
                
            success, response, status_code = self.make_request('GET', 'orders', token=self.tokens[role])
            
            if success and isinstance(response, list):
                self.log_test(f"Get orders ({role})", True, f"Status: {status_code}, Found: {len(response)} orders")
            else:
                self.log_test(f"Get orders ({role})", False, 
                            f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        print("\n👑 Testing Admin Endpoints...")
        
        if 'admin' not in self.tokens:
            self.log_test("Admin endpoints", False, "No admin token available")
            return

        # Test get all users
        success, response, status_code = self.make_request('GET', 'admin/users', token=self.tokens['admin'])
        
        if success and isinstance(response, list):
            self.log_test("Get all users (admin)", True, f"Status: {status_code}, Found: {len(response)} users")
        else:
            self.log_test("Get all users (admin)", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

        # Test get analytics
        success, response, status_code = self.make_request('GET', 'admin/analytics', token=self.tokens['admin'])
        
        if success and 'total_users' in response:
            self.log_test("Get analytics (admin)", True, f"Status: {status_code}")
        else:
            self.log_test("Get analytics (admin)", False, 
                        f"Status: {status_code}, Error: {response.get('detail', 'Unknown error')}")

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n🚫 Testing Unauthorized Access...")
        
        # Test accessing admin endpoint with buyer token
        if 'buyer' in self.tokens:
            success, response, status_code = self.make_request('GET', 'admin/users', token=self.tokens['buyer'])
            
            if not success and status_code == 403:
                self.log_test("Buyer accessing admin endpoint", True, "Correctly denied access")
            else:
                self.log_test("Buyer accessing admin endpoint", False, "Should have been denied access")

        # Test accessing protected endpoint without token
        success, response, status_code = self.make_request('GET', 'auth/me')
        
        if not success and status_code == 401:
            self.log_test("Access without token", True, "Correctly denied access")
        else:
            self.log_test("Access without token", False, "Should have been denied access")

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
    tester = B2BNexusAPITester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())