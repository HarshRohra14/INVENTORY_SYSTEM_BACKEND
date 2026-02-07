'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import {
  X,
  Search,
  RefreshCw,
  ShoppingCart,
  Package,
  Image as ImageIcon,
  Filter,
  SortAsc,
  Tag,
  Box,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ruler,
} from 'lucide-react';

// Types (unchanged)
interface Item {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unit: string;
  sellingPrice: number | null;
  photoUrl?: string;
  cost?: number;
  price?: number;
  safetyStock?: number;
  targetLocation?: string;
  dimension?: string;
  branch: {
    id: string;
    name: string;
  };
}

interface ItemsResponse {
  success: boolean;
  data: {
    products: Item[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      limit: number;
    };
  };
}

interface CategoriesResponse {
  success: boolean;
  data: string[];
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export default function ItemListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination state from backend
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 20,
  });

  // Filtering and sorting states
  const [targetLocation, setTargetLocation] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Quantity inputs for each item
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});

  // Refresh products states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);

  // Filters show/hide
  const [showFilters, setShowFilters] = useState(true);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  const { token } = useAuth();
  const { addItemToCart } = useCart();

  // Toast Functions
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = toastId + 1;
    setToastId(id);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch items
  const fetchItems = async () => {
    try {
      setIsLoading(true);

      const cleanedTargetLocation = targetLocation.replace(/["']/g, '').trim();

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(stockStatus !== 'all' && { stockStatus }),
        ...(cleanedTargetLocation && { targetLocation: cleanedTargetLocation }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
      });

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const endpoint = `${API_URL}/api/products/by-branch-target-locations?${params}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: ItemsResponse = await response.json();

      if (data.success) {
        setItems(data.data.products);
        setPagination(data.data.pagination);
      } else {
        setError(data.message || (data as any).error || 'Failed to fetch items');
      }
    } catch (err) {
      setError('Error fetching items');
      console.error('Fetch items error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/products/categories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: CategoriesResponse = await response.json();

      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  // Fetch target locations
  const fetchTargetLocations = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/branches/me/target-locations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data: CategoriesResponse = await response.json();

      if (data.success) {
        setTargetLocations(data.data);
      }
    } catch (err) {
      console.error('Fetch target locations error:', err);
    }
  };

  // Refresh products from BoxHero
  const refreshProducts = async () => {
    try {
      setIsRefreshing(true);
      setRefreshError('');
      setRefreshMessage('');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/products/refresh`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setRefreshMessage(`Successfully synced ${data.syncedProducts} products from BoxHero`);
        showToast('success', `Successfully synced ${data.syncedProducts} products!`);
        await fetchItems();
        await fetchCategories();
      } else {
        setRefreshError(data.message || 'Failed to refresh products');
        showToast('error', data.message || 'Failed to refresh products');
      }
    } catch (err) {
      setRefreshError('Error refreshing products');
      showToast('error', 'Error refreshing products');
      console.error('Refresh products error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    if (token) {
      fetchItems();
      fetchCategories();
      fetchTargetLocations();
    }
  }, [token, currentPage, searchTerm, selectedCategory, stockStatus, targetLocation, sortBy, sortOrder]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchItems();
  };

  // Handle filter changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleStockStatusChange = (status: string) => {
    setStockStatus(status);
    setCurrentPage(1);
  };

  // Handle quantity change
  const handleQuantityChange = (itemId: string, quantity: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, quantity),
    }));
  };

  // Handle add to cart
  const handleAddToCart = (item: Item) => {
    const quantity = quantities[item.id] || 1;

    if (quantity <= 0) {
      showToast('warning', 'Please enter a valid quantity');
      return;
    }

    if (quantity > item.currentStock) {
      showToast('error', `Only ${item.currentStock} items available in stock`);
      return;
    }

    addItemToCart(
      {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        price: item.price ?? 0,
      },
      quantity
    );

    setQuantities((prev) => ({
      ...prev,
      [item.id]: 1,
    }));

    showToast('success', `Added ${quantity} ${item.name} to cart`);
  };

  const handleAddAllToCart = () => {
    const selectedItems = items.filter((item) => quantities[item.id] > 0);
    if (selectedItems.length === 0) {
      showToast('warning', 'Please select items to add to cart');
      return;
    }

    selectedItems.forEach((item) => {
      addItemToCart(
        {
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          unit: item.unit,
          currentStock: item.currentStock,
          price: item.price ?? 0,
        },
        quantities[item.id]
      );
    });

    setQuantities({});
    showToast('success', `Added ${selectedItems.length} items to cart`);
  };

  // Get stock status
  const getStockStatus = (item: Item) => {
    if (item.currentStock === 0)
      return {
        text: 'Out of Stock',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: AlertCircle,
      };
    if (item.currentStock <= item.minStockLevel)
      return {
        text: 'Low Stock',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: TrendingUp,
      };
    return {
      text: 'In Stock',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: CheckCircle2,
    };
  };

  // Pagination Component (top and bottom)
  const PaginationControls = () => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm font-medium text-gray-600">
          Showing{' '}
          <span className="text-orange-400 font-semibold">
            {(pagination.currentPage - 1) * pagination.limit + 1}
          </span>{' '}
          to{' '}
          <span className="text-orange-400 font-semibold">
            {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
          </span>{' '}
          of <span className="text-orange-400 font-semibold">{pagination.totalCount}</span> items
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="p-2 bg-white border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gradient-to-r hover:from-orange-400 hover:to-orange-500 hover:text-white hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 bg-white border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gradient-to-r hover:from-orange-400 hover:to-orange-500 hover:text-white hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = Math.max(1, pagination.currentPage - 2) + i;
              if (pageNum > pagination.totalPages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[36px] h-9 px-3 rounded-lg font-semibold text-sm transition-all shadow-sm ${
                    pagination.currentPage === pageNum
                      ? 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Mobile: Current Page Indicator */}
          <div className="sm:hidden px-4 py-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white rounded-lg font-semibold text-sm">
            {pagination.currentPage} / {pagination.totalPages}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={!pagination.hasNextPage}
            className="p-2 bg-white border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gradient-to-r hover:from-orange-400 hover:to-orange-500 hover:text-white hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentPage(pagination.totalPages)}
            disabled={currentPage >= pagination.totalPages}
            className="p-2 bg-white border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gradient-to-r hover:from-orange-400 hover:to-orange-500 hover:text-white hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400">
        <div className="relative">
          <div className="w-20 h-20 border-8 border-gray-200 border-t-transparent rounded-full animate-spin"></div>
          <div
            className="absolute inset-0 w-20 h-20 border-8 border-orange-600 border-t-transparent rounded-full animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          ></div>
        </div>
        <div className="mt-6 space-y-1 text-center">
          <p className="text-lg font-semibold text-gray-900">Loading Inventory</p>
          <p className="text-sm text-gray-500">Please wait while we fetch your items...</p>
        </div>
      </div>
    );
  }

  const selectedItemsCount = Object.values(quantities).filter((qty) => qty > 0).length;

  return (
    <div className="min-h-screen">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border-2 animate-slide-in-right pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200'
                : toast.type === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : toast.type === 'warning' ? (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  toast.type === 'success'
                    ? 'text-green-900'
                    : toast.type === 'error'
                    ? 'text-red-900'
                    : toast.type === 'warning'
                    ? 'text-yellow-900'
                    : 'text-orange-900'
                }`}
              >
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className={`flex-shrink-0 ${
                toast.type === 'success'
                  ? 'text-green-600 hover:text-green-800'
                  : toast.type === 'error'
                  ? 'text-red-600 hover:text-red-800'
                  : toast.type === 'warning'
                  ? 'text-yellow-600 hover:text-yellow-800'
                  : 'text-orange-600 hover:text-orange-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-fade-in"
            onClick={() => setSelectedImage(null)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-scale-in"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="relative bg-white rounded-3xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="bg-white/90 hover:bg-white backdrop-blur-sm p-2 rounded-full shadow-lg transition-all transform hover:scale-110 hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>
              <div className="p-6">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.name}
                  className="max-w-full max-h-[75vh] object-contain mx-auto rounded-lg shadow-lg"
                />
                <div className="mt-4 text-center">
                  <p className="text-lg font-semibold text-gray-900">{selectedImage.name}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="max-w-full mx-auto p-3 space-y-4">
        {/* Header */}
        
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                  Inventory Catalog
                </h1>
                <p className="text-sm text-gray-900">
                  {pagination.totalCount} products available
                </p>
              </div>
            </div>

            <button
              onClick={refreshProducts}
              disabled={isRefreshing}
              className="w-full lg:w-auto bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Products'}
            </button>
          </div>

          {/* Messages */}
          {(refreshMessage || refreshError) && (
            <div className="mt-3 space-y-2">
              {refreshMessage && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{refreshMessage}</span>
                </div>
              )}
              {refreshError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{refreshError}</span>
                </div>
              )}
            </div>
          )}
        

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg flex items-center justify-center shadow">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Search & Filter</h2>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-sm text-gray-700 transition"
              >
                {showFilters ? 'Hide' : 'Show'}
              </button>
            </div>

            {showFilters && (
              <form onSubmit={handleSearch} className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition placeholder-gray-400 bg-white"
                    placeholder="Search by name, SKU, or category..."
                  />
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition bg-white cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetLocation}
                    onChange={(e) => {
                      setTargetLocation(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition bg-white cursor-pointer"
                  >
                    <option value="">All Locations</option>
                    {targetLocations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>

                  <select
                    value={stockStatus}
                    onChange={(e) => handleStockStatusChange(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition bg-white cursor-pointer"
                  >
                    <option value="all">All Stock</option>
                    <option value="in-stock">In Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>

                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field);
                      setSortOrder(order);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition bg-white cursor-pointer"
                  >
                    <option value="name-asc">Name: A-Z</option>
                    <option value="name-desc">Name: Z-A</option>
                    <option value="currentStock-asc">Qty: Low-High</option>
                    <option value="currentStock-desc">Qty: High-Low</option>
                  </select>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Top Pagination */}
        {items.length > 0 && <PaginationControls />}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Items Table/Cards */}
        {items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-1">No Items Found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
            {/* Desktop Table - Hidden on mobile */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">#</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Image</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">SKU</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Category</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase">Dimension</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase">Stock</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase">Unit</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase">Quantity</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const stockStatus = getStockStatus(item);
                    const StockIcon = stockStatus.icon;
                    const rowNumber = (pagination.currentPage - 1) * pagination.limit + index + 1;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-indigo-50 transition-colors"
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg">
                            <span className="text-xs font-bold text-white">{rowNumber}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {item.photoUrl ? (
                            <div
                              className="cursor-pointer"
                              onClick={() => setSelectedImage({ url: item.photoUrl!, name: item.name })}
                            >
                              <img
                                src={item.photoUrl}
                                alt={item.name}
                                className="h-12 w-12 rounded-lg object-cover border border-gray-200 hover:border-orange-500 transition-all shadow-sm hover:shadow-md transform hover:scale-110 duration-200"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md font-mono text-xs font-medium">
                            {item.sku}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-semibold text-gray-900 max-w-[200px] truncate">
                            {item.name}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          {item.dimension ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-200">
                              <Ruler className="w-3 h-3" />
                              {item.dimension}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-gray-900">{item.currentStock}</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${stockStatus.bgColor} ${stockStatus.color} border ${stockStatus.borderColor}`}
                            >
                              <StockIcon className="w-3 h-3 mr-1" />
                              {stockStatus.text}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-sm font-medium text-gray-700">
                          {item.unit}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 0) - 1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 transition-all flex items-center justify-center"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.currentStock}
                              value={quantities[item.id] || 0}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center px-2 py-1 text-sm font-bold border-2 border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-900"
                            />
                            <button
                              onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 0) + 1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 transition-all flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleAddToCart(item)}
                            disabled={
                              !quantities[item.id] ||
                              quantities[item.id] <= 0 ||
                              quantities[item.id] > item.currentStock
                            }
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Cards - Hidden on desktop */}
            <div className="xl:hidden divide-y divide-gray-200">
              {items.map((item, index) => {
                const stockStatus = getStockStatus(item);
                const StockIcon = stockStatus.icon;
                const rowNumber = (pagination.currentPage - 1) * pagination.limit + index + 1;

                return (
                  <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-3">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {item.photoUrl ? (
                          <div
                            className="cursor-pointer"
                            onClick={() => setSelectedImage({ url: item.photoUrl!, name: item.name })}
                          >
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{item.name}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-1">SKU: {item.sku}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">
                            {item.category}
                          </span>
                          {item.dimension && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-200">
                              <Ruler className="w-3 h-3" />
                              {item.dimension}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${stockStatus.bgColor} ${stockStatus.color}`}
                          >
                            <StockIcon className="w-3 h-3 mr-1" />
                            {item.currentStock} {item.unit}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 pt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 0) - 1)}
                              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.currentStock}
                              value={quantities[item.id] || 0}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center px-2 py-1.5 text-sm font-bold border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900"
                            />
                            <button
                              onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 0) + 1)}
                              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleAddToCart(item)}
                            disabled={
                              !quantities[item.id] ||
                              quantities[item.id] <= 0 ||
                              quantities[item.id] > item.currentStock
                            }
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bulk Actions Footer */}
            {selectedItemsCount > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-indigo-50 px-4 py-4 border-t border-orange-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-600 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{selectedItemsCount} items selected</p>
                      <p className="text-xs text-gray-600">Ready to add to cart</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleAddAllToCart}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add All
                    </button>

                    <button
                      onClick={() => setQuantities({})}
                      className="bg-white text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-100 transition shadow-sm border border-gray-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Pagination */}
        {items.length > 0 && <PaginationControls />}
      </div>

      {/* Animations CSS */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}