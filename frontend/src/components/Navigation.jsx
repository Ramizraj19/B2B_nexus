import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  Home, 
  LogOut,
  User,
  Settings
} from 'lucide-react';

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const getNavItems = () => {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['buyer', 'seller', 'admin'] }
    ];

    if (user?.role === 'buyer') {
      items.push(
        { path: '/products', label: 'Browse Products', icon: Package, roles: ['buyer'] },
        { path: '/cart', label: 'Cart', icon: ShoppingCart, roles: ['buyer'] },
        { path: '/orders', label: 'My Orders', icon: Package, roles: ['buyer'] }
      );
    }

    if (user?.role === 'seller') {
      items.push(
        { path: '/my-products', label: 'My Products', icon: Package, roles: ['seller'] },
        { path: '/orders', label: 'Orders', icon: Package, roles: ['seller'] }
      );
    }

    if (user?.role === 'admin') {
      items.push(
        { path: '/products', label: 'All Products', icon: Package, roles: ['admin'] },
        { path: '/users', label: 'Users', icon: Users, roles: ['admin'] },
        { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin'] }
      );
    }

    return items;
  };

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B2B</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Nexus</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {getNavItems().map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">{user.firstName} {user.lastName}</span>
              <span className="text-xs text-gray-500 capitalize">({user.role})</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/profile')}
                className="text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {getNavItems().map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
