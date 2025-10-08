import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  Home, 
  LogOut,
  User,
  Settings,
  Menu,
  X,
  ShoppingBag,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { Badge } from './ui/badge';

const Navigation = () => {
  const { user, logout, cartItemCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  // Comprehensive navigation configuration
  const NAV_CONFIG = useMemo(() => ([
    // Common routes for all authenticated users
    { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['buyer', 'seller', 'admin'] },
    { path: '/orders', label: 'Orders', icon: Package, roles: ['buyer', 'seller', 'admin'] },
    
    // Buyer specific routes
    { path: '/products', label: 'Browse Products', icon: ShoppingBag, roles: ['buyer'] },
    { path: '/cart', label: 'Cart', icon: ShoppingCart, roles: ['buyer'], badge: 'cartItemCount' },
    
    // Seller specific routes
    { path: '/my-products', label: 'My Products', icon: Package, roles: ['seller'] },
    { path: '/seller-analytics', label: 'Sales Analytics', icon: TrendingUp, roles: ['seller'] },
    
    // Admin specific routes
    { path: '/admin/products', label: 'All Products', icon: Package, roles: ['admin'] },
    { path: '/users', label: 'User Management', icon: UserCheck, roles: ['admin'] },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin'] },
    { path: '/system-health', label: 'System Health', icon: BarChart3, roles: ['admin'] }
  ]), []);

  // Filter navigation items based on user role
  const navItems = useMemo(() => {
    if (!user) return [];
    return NAV_CONFIG.filter(item => item.roles.includes(user.role));
  }, [user, NAV_CONFIG]);

  // Get user display name and avatar
  const getUserDisplayInfo = () => {
    if (!user) return { name: '', initials: '', avatar: '' };
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const name = user.name || `${firstName} ${lastName}`.trim();
    const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.name?.charAt(0) || 'U';
    const avatar = user.avatar || user.profile?.avatar || '';
    
    return { name, initials, avatar };
  };

  const { name, initials, avatar } = getUserDisplayInfo();

  // Mobile menu handler
  const handleMobileLinkClick = () => {
    setMobileMenuOpen(false);
  };

  if (!user) {
    // Public navigation for non-authenticated users
    return (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">B2B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Nexus</span>
              </Link>
            </div>

            {/* Public Navigation Links */}
            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/products"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Browse Products
              </Link>
              <Link
                to="/about"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Contact
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => navigate('/login')}
                className="hidden sm:flex"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate('/register')}
                className="hidden sm:flex"
              >
                Sign Up
              </Button>

              {/* Mobile menu button for public nav */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu for Public */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-white">
            <div className="flex justify-between items-center p-4 border-b">
              <Link 
                to="/" 
                className="flex items-center space-x-2"
                onClick={handleMobileLinkClick}
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">B2B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Nexus</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              <Link
                to="/products"
                className="block text-gray-600 hover:text-gray-900 py-2 text-base font-medium"
                onClick={handleMobileLinkClick}
              >
                Browse Products
              </Link>
              <Link
                to="/about"
                className="block text-gray-600 hover:text-gray-900 py-2 text-base font-medium"
                onClick={handleMobileLinkClick}
              >
                About
              </Link>
              <Link
                to="/contact"
                className="block text-gray-600 hover:text-gray-900 py-2 text-base font-medium"
                onClick={handleMobileLinkClick}
              >
                Contact
              </Link>
              
              <div className="pt-4 border-t space-y-3">
                <Button
                  className="w-full"
                  onClick={() => {
                    handleMobileLinkClick();
                    navigate('/login');
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    handleMobileLinkClick();
                    navigate('/register');
                  }}
                >
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
    );
  }

  // Authenticated user navigation
  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
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

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const badgeCount = item.badge === 'cartItemCount' ? cartItemCount : 0;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu and Mobile Button */}
          <div className="flex items-center space-x-4">
            {/* Cart Icon for Buyers */}
            {user.role === 'buyer' && (
              <Link
                to="/cart"
                className="relative p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Badge>
                )}
              </Link>
            )}

            {/* User Role Badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700 capitalize">{user.role}</span>
            </div>

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 border-2 border-gray-200">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  <span>Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  <span>Settings</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Role-specific menu items */}
                {user.role === 'buyer' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/orders')}>
                      <Package className="w-4 h-4 mr-2" />
                      <span>My Orders</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/cart')}>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      <span>
                        Shopping Cart
                        {cartItemCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {cartItemCount}
                          </Badge>
                        )}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                
                {user.role === 'seller' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/my-products')}>
                      <Package className="w-4 h-4 mr-2" />
                      <span>My Products</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/seller-analytics')}>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      <span>Sales Analytics</span>
                    </DropdownMenuItem>
                  </>
                )}
                
                {user.role === 'admin' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      <span>Admin Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/users')}>
                      <UserCheck className="w-4 h-4 mr-2" />
                      <span>Manage Users</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/analytics')}>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      <span>System Analytics</span>
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white">
          <div className="flex justify-between items-center p-4 border-b">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="p-4 space-y-1 max-h-[calc(100vh-80px)] overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const badgeCount = item.badge === 'cartItemCount' ? cartItemCount : 0;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between space-x-3 px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={handleMobileLinkClick}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {badgeCount > 0 && (
                    <Badge variant="destructive" className="h-6 w-6 flex items-center justify-center p-0 text-xs">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
            
            <div className="pt-4 mt-4 border-t space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  handleMobileLinkClick();
                  navigate('/profile');
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  handleMobileLinkClick();
                  navigate('/settings');
                }}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;