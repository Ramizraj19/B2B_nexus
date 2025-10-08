import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import ForgotPasswordPage from './pages/LoginPage/ForgotPasswordPage';
import ResetPasswordPage from './pages/LoginPage/ResetPasswordPage';
import ProductsPage from './pages/ProductsPage/ProductsPage';
import Dashboard from './pages/Dashboard/Dashboard';
import CartPage from './pages/CartPage/CartPage';
import OrdersPage from './pages/OrdersPage/OrdersPage';
import MyProductsPage from './pages/MyProductsPage/MyProductsPage';
import UnauthorizedPage from './pages/UnauthorizedPage/UnauthorizedPage';
import UsersPage from './pages/UsersPage/UsersPage';
import AnalyticsPage from './pages/AnalyticsPage/AnalyticsPage';
import SellerDashboard from './pages/Dashboard/SellerDashboard';
import BuyerDashboard from './pages/Dashboard/BuyerDashboard';
import MessagesPage from './pages/MessagesPage/MessagesPage';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Navigation />
          
          <main className="min-h-screen bg-gray-50 py-6">
            <ErrorBoundary>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<ProductsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* Protected Routes */}
                <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                
                {/* Role-based Dashboards */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      {({ user }) => {
                        if (user.role === 'admin') return <Dashboard />;
                        if (user.role === 'seller') return <SellerDashboard />;
                        return <BuyerDashboard />;
                      }}
                    </ProtectedRoute>
                  } 
                />
                
                {/* Seller Routes */}
                <Route 
                  path="/my-products" 
                  element={
                    <ProtectedRoute requiredRole="seller">
                      <MyProductsPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Admin Routes */}
                <Route 
                  path="/admin/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/users" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <UsersPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/analytics" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AnalyticsPage />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </ErrorBoundary>
          </main>
          
          <Footer />
          <Toaster />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;