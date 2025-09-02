import React, { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { productsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';

const MyProductsPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    stock: '',
    brand: '',
    tags: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.role === 'seller') {
      fetchProducts();
      fetchCategories();
    } else {
      setLoading(false);
    }
  }, [user, currentPage]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        limit: 12
      };

      const response = await productsAPI.getMyProducts(params);
      
      if (response.success) {
        setProducts(response.data.products || response.products || []);
        setTotalPages(response.data.totalPages || response.totalPages || 1);
      } else {
        setError(response.message || 'Failed to fetch products');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      if (response.success) {
        setCategories(response.data.categories || response.categories || []);
        if (response.data.categories?.length > 0) {
          setNewProduct(prev => ({ ...prev, category: response.data.categories[0]._id }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.description || !newProduct.stock) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: {
          current: parseFloat(newProduct.price),
          original: parseFloat(newProduct.price)
        },
        category: newProduct.category,
        stock: parseInt(newProduct.stock),
        brand: newProduct.brand || '',
        tags: newProduct.tags ? newProduct.tags.split(',').map(tag => tag.trim()) : [],
        status: 'active',
        visibility: 'public'
      };

      const response = await productsAPI.createProduct(productData);
      
      if (response.success) {
        // Reset form and refresh products
        setNewProduct({
          name: '',
          price: '',
          description: '',
          category: categories[0]?._id || '',
          stock: '',
          brand: '',
          tags: ''
        });
        setShowAddForm(false);
        fetchProducts();
      } else {
        setError(response.message || 'Failed to create product');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await productsAPI.updateProduct(productId, { status: newStatus });
      
      if (response.success) {
        fetchProducts(); // Refresh the list
      } else {
        setError(response.message || 'Failed to update product status');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update product status');
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await productsAPI.deleteProduct(productId);
      
      if (response.success) {
        fetchProducts(); // Refresh the list
      } else {
        setError(response.message || 'Failed to delete product');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' },
      out_of_stock: { color: 'bg-red-100 text-red-800', label: 'Out of Stock' },
      draft: { color: 'bg-yellow-100 text-yellow-800', label: 'Draft' }
    };
    
    const config = statusConfig[status] || statusConfig.inactive;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const ProductSkeleton = () => (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-4" />
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
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
            <div className="text-lg text-gray-600 mb-4">Please log in to manage your products</div>
            <Button onClick={() => window.location.href = '/login'}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== 'seller') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg text-gray-600 mb-4">This page is only available for sellers</div>
            <Button onClick={() => window.location.href = '/products'}>
              Browse Products
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
            <Button onClick={fetchProducts}>Try Again</Button>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Products</h1>
              <p className="text-gray-600">Manage your product catalog and inventory</p>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Cancel' : 'Add New Product'}
            </Button>
          </div>
        </div>

        {/* Add Product Form */}
        {showAddForm && (
          <Card className="bg-white mb-8">
            <CardHeader>
              <CardTitle>Add New Product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <Input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <Input
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Enter product description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <Input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <Input
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                    placeholder="Enter brand name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <Input
                    value={newProduct.tags}
                    onChange={(e) => setNewProduct({...newProduct, tags: e.target.value})}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button 
                  onClick={handleAddProduct} 
                  className="mr-2"
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add Product'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <Card key={product._id} className="bg-white hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>
                          {product.category?.name || 'Uncategorized'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(product.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-green-600">
                          ${product.price?.current || product.price || 0}
                        </span>
                        <span className="text-sm text-gray-600">
                          Stock: {product.stock || 0}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleProductStatus(product._id, product.status)}
                        >
                          {product.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteProduct(product._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && !loading && (
              <Card className="bg-white">
                <CardContent className="p-12 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm ? 'No products match your search.' : 'You haven\'t added any products yet.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowAddForm(true)}>
                      Add Your First Product
                    </Button>
                  )}
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

export default MyProductsPage;