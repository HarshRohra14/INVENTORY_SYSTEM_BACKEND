'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, X, Trash2 } from 'lucide-react';

interface MiniCartProps {
  onClose: () => void;
}

export default function MiniCart({ onClose }: MiniCartProps) {
  const { cartItems, getTotalItems, getTotalValue, removeItemFromCart } = useCart();
  const cartRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Prevent body scroll when cart is open on mobile
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />

      {/* Cart Container */}
      <div 
        ref={cartRef} 
        className="fixed md:absolute left-0 right-0 md:left-auto md:right-0 bottom-0 md:bottom-auto md:top-full md:mt-2 w-full md:w-96 bg-white md:rounded-xl rounded-t-2xl md:rounded-t-xl shadow-2xl border-t md:border border-gray-200 overflow-hidden z-50 max-h-[90vh] md:max-h-[calc(100vh-100px)] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Shopping Cart</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {cartItems.length > 0 && (
            <p className="text-blue-100 text-xs mt-1">
              {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} in your cart
            </p>
          )}
        </div>

        {/* Cart Items */}
        {cartItems.length === 0 ? (
          <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">Your cart is empty</p>
            <p className="text-gray-500 text-sm">Add items to get started</p>
          </div>
        ) : (
          <>
            {/* Items List - Scrollable */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {cartItems.map((item) => (
                <div key={item.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>SKU: {item.sku}</span>
                        <span>•</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                      {item.price && (
                        <p className="text-sm font-medium text-blue-600 mt-1">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      )}
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeItemFromCart(item.id)}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove item"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
              {/* Total */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700">
                  Total ({getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''})
                </span>
                <span className="text-lg font-bold text-gray-900">
                  ${getTotalValue().toFixed(2)}
                </span>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onClose}
                  type="button"
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text hover:bg-gray-200 transition-colors order-2 sm:order-1"
                >
                  Continue Shopping
                </button>
                <Link
                  href="/dashboard/cart"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400  transition-all shadow-sm hover:shadow-md text-center order-1 sm:order-2"
                >
                  View Cart
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}