'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
interface CartItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
  price: number;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addItemToCart: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  removeItemFromCart: (itemId: string) => void;
  updateItemQuantity: (itemId: string, newQuantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalValue: () => number;
}

// Cart storage key
const CART_STORAGE_KEY = 'inventory-cart';

// Helper functions for localStorage
const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    return storedCart ? JSON.parse(storedCart) : [];
  } catch (error) {
    console.error('Error loading cart from storage:', error);
    return [];
  }
};

const saveCartToStorage = (cartItems: CartItem[]) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

// Create context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Cart provider component
export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(loadCartFromStorage());
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = loadCartFromStorage();
    setCartItems(savedCart);
    setIsInitialized(true);
  }, []);

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    if (isInitialized) {
      saveCartToStorage(cartItems);
    }
  }, [cartItems, isInitialized]);

  // Add item to cart
  const addItemToCart = (item: Omit<CartItem, 'quantity'>, quantity: number) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(cartItem => cartItem.id === item.id);
      
      if (existingItem) {
        // Update quantity if item already exists
        const updatedItems = prevItems.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
        return updatedItems;
      } else {
        // Add new item to cart
        return [...prevItems, { ...item, quantity }];
      }
    });
  };

  // Remove item from cart
  const removeItemFromCart = (itemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  // Update item quantity
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItemFromCart(itemId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Clear entire cart
  const clearCart = () => {
    setCartItems([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  };

  // Get total number of items in cart
  const getTotalItems = () => {
    console.log(cartItems.reduce((total, item) => total + item.quantity, 0));
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  // Get total value of cart
  const getTotalValue = () => {
    // Only include items that are currently in-stock in the total value
    const total = cartItems.reduce((total, item) => {
      if (item.currentStock <= 0) return total;
      return total + (item.price * item.quantity);
    }, 0);
    console.log('Cart total (in-stock only):', total);
    return total;
  };

  const value: CartContextType = {
    cartItems,
    addItemToCart,
    removeItemFromCart,
    updateItemQuantity,
    clearCart,
    getTotalItems,
    getTotalValue,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
