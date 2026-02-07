'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export default function CartPage() {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Toast state (UI only)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  // Delete confirmation modal state (UI only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemPendingDelete, setItemPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { cartItems, updateItemQuantity, removeItemFromCart, clearCart, getTotalItems, getTotalValue } = useCart();
  const { token } = useAuth();
  const router = useRouter();

  // Toast helpers (UI only; no logic changes)
  const showToast = (type: ToastType, message: string) => {
    const id = toastId + 1;
    setToastId(id);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };
  const removeToastUI = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Handle quantity update (unchanged logic; toast when item becomes 0 and is removed)
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      const item = cartItems.find((ci) => ci.id === itemId);
      removeItemFromCart(itemId);
      if (item) showToast('info', `Removed "${item.name}" from cart`);
    } else {
      updateItemQuantity(itemId, newQuantity);
    }
  };

  // Open delete confirmation modal (UI only)
  const handleRemoveItem = (itemId: string) => {
    const item = cartItems.find((ci) => ci.id === itemId);
    setItemPendingDelete({ id: itemId, name: item?.name || 'this item' });
    setShowDeleteModal(true);
  };

  // Confirm deletion from modal (logic unchanged: still uses removeItemFromCart)
  const confirmRemoveItem = () => {
    if (itemPendingDelete) {
      removeItemFromCart(itemPendingDelete.id);
      showToast('success', `Removed "${itemPendingDelete.name}" from cart`);
    }
    setItemPendingDelete(null);
    setShowDeleteModal(false);
  };

  const cancelRemoveItem = () => {
    setItemPendingDelete(null);
    setShowDeleteModal(false);
  };

  // Handle order submission (unchanged API/logic; adds toast on success/failure)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      setError('Your cart is empty. Please add items before submitting an order.');
      showToast('warning', 'Your cart is empty. Add items before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Split items into in-stock and out-of-stock arrays
      const inStockItems = cartItems.filter(i => i.currentStock > 0).map((item) => ({ sku: item.sku, quantity: item.quantity }));
      const outOfStockItems = cartItems.filter(i => i.currentStock <= 0).map((item) => ({ sku: item.sku, quantity: item.quantity }));

      const orderData = {
        inStockItems,
        outOfStockItems,
        remarks: remarks.trim() || undefined,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Order submitted successfully!');
        showToast('success', 'Stock request submitted successfully!');
        clearCart();
        setRemarks('');

        // Redirect to orders page after a short delay
        setTimeout(() => {
          router.push('/dashboard/orders');
        }, 2000);
      } else {
        const msg = data.message || 'Failed to submit order';
        setError(msg);
        showToast('error', msg);
      }
    } catch (err) {
      setError('Error submitting order. Please try again.');
      showToast('error', 'Error submitting order. Please try again.');
      console.error('Submit order error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-3 rounded-lg shadow-lg border text-sm transition
                ${
                  t.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : t.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : t.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}
            >
              <span className="font-medium">{t.message}</span>
              <button onClick={() => removeToastUI(t.id)} className="ml-auto text-gray-500 hover:text-gray-700" aria-label="Close">
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Header */}
        
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-7 h-7  text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Shopping Cart</h1>
              <p className="text-sm text-gray-500 mt-0.5">Your cart is empty</p>
            </div>
          </div>
       

        {/* Empty Cart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="mx-auto w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="w-12 h-12 text-orange-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Start adding items to your cart to create your stock request.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white px-6 py-3 rounded-lg font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-sm hover:shadow-md"
          >
            <Package className="w-5 h-5" />
            Browse Items
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-lg shadow-lg border text-sm transition
              ${
                t.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : t.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : t.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
              }`}
          >
            <span className="font-medium">{t.message}</span>
            <button onClick={() => removeToastUI(t.id)} className="ml-auto text-gray-500 hover:text-gray-700" aria-label="Close">
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Shopping Cart</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} in your cart
              </p>
            </div>
          </div>
        </div>
      

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cart Items Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Cart Items</h3>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200">
                {getTotalItems()} {getTotalItems() !== 1 ? 'Items' : 'Item'}
              </span>
            </div>

            {/* Items List */}
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="p-5 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Item Icon */}
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-8 h-8 text-orange-600" />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-gray-900 mb-1">{item.name}</h4>
                            {item.currentStock <= 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                Out of Stock
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">SKU:</span> {item.sku}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Category:</span> {item.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Unit:</span> {item.unit}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Price and Quantity */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            className="w-9 h-9 rounded-lg border-2 border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-2 text-center text-sm font-semibold border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="w-9 h-9 rounded-lg border-2 border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          {item.currentStock > 0 ? (
                            <>
                              <p className="text-lg font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                              <p className="text-xs text-gray-500">${(item.price ?? 0).toFixed(2)} per {item.unit}</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Out of stock — price shown when available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label htmlFor="remarks" className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <FileText className="w-5 h-5 text-gray-600" />
              Remarks (Optional)
            </label>
            <textarea
              id="remarks"
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 text-gray-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all resize-none"
              placeholder="Add any special instructions or notes for this order..."
            />
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Order Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold text-gray-900">{getTotalItems()}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-gray-900">Total Value:</span>
                  <span className="text-xl font-bold text-green-600">${getTotalValue().toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || cartItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Request Stock
                    </>
                  )}
                </button>

                {/* Continue Shopping Button */}
                <div className="relative rounded-lg bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 p-[2px] group">
  <button
    type="button"
    onClick={() => router.push('/dashboard')}
    className="w-full flex items-center justify-center gap-2 px-6 py-1.5 bg-white rounded-[6px] font-semibold transition-all duration-300 shadow-sm hover:shadow-md group-hover:bg-transparent"
  >
    <ArrowLeft className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors duration-300" />
    <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent group-hover:text-white group-hover:bg-none transition-all duration-300">
      Continue Shopping
    </span>
  </button>
</div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Stock Request</p>
                  <p className="text-xs text-gray-600">Your request will be reviewed and processed by the inventory team.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal (UI only, replaces alert/confirm) */}
      {showDeleteModal && itemPendingDelete && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={cancelRemoveItem} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all">
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Remove Item</h3>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm text-gray-700">
                  Are you sure you want to remove{' '}
                  <span className="font-semibold text-gray-900">"{itemPendingDelete.name}"</span> from your cart?
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                <button
                  onClick={cancelRemoveItem}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveItem}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}