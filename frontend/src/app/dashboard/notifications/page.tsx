'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
  orderId?: string; // present for ORDER_* types
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnread(data.data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Notifications load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const markAll = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      });
      toast.success('All notifications marked as read!', {
        icon: '✅',
        duration: 3000,
      });
      load();
    } catch (e) {
      console.error('Mark all error:', e);
      toast.error('Failed to mark notifications as read', {
        duration: 3000,
      });
    }
  };

  const markOne = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      toast.success('Notification marked as read', {
        icon: '✓',
        duration: 2000,
      });
      load();
    } catch (e) {
      console.error('Mark one error:', e);
      toast.error('Failed to mark as read', {
        duration: 3000,
      });
    }
  };

  // Navigate to related entity if available (order detail for order notifications)
  const openNotification = async (n: Notification) => {
    // Optimistically mark as read but don't block navigation
    if (!n.isRead) {
      // fire-and-forget
      markOne(n.id);
    }
    if (n.orderId) {
      router.push(`/dashboard/orders/${n.orderId}`);
      return;
    }
    // fallback: stay on page if no target
  };

  const handleRefresh = async () => {
    toast.promise(
      load(),
      {
        loading: 'Refreshing notifications...',
        success: 'Notifications refreshed!',
        error: 'Failed to refresh',
      },
      {
        success: {
          duration: 2000,
          icon: '🔄',
        },
      }
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  // NEW FUNCTION: Format full date and time
  const formatFullDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'ORDER':
        return (
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      case 'BROADCAST':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  useEffect(() => { load(); }, [token, API_BASE_URL]);

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Toast Container */}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderRadius: '0.5rem',
            padding: '1rem',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Header - UPDATED WITH ICON */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* NOTIFICATION BELL ICON */}
          <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Notifications</h1>
            <p className="mt-1 text-sm text-gray-600">
              {unread > 0 ? (
                <>
                  You have <span className="font-semibold text-orange-600">{unread}</span> unread notification{unread === 1 ? '' : 's'}
                </>
              ) : (
                "You're all caught up!"
              )}
            </p>
          </div>
        </div>
        
        {/* BUTTONS - UPDATED */}
        <div className="flex items-center space-x-3">
          {/* Mark All as Read Button - UPDATED WITH GRADIENT EFFECTS */}
          {unread > 0 && (
            <div className="relative rounded-lg bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 p-[2px] group">
              <button 
                onClick={markAll} 
                className="relative inline-flex items-center px-4 py-2 bg-white rounded-[6px] text-sm font-medium transition-all duration-300 space-x-2 group-hover:bg-transparent"
              >
                <svg className="w-4 h-4 text-orange-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent group-hover:text-white group-hover:bg-none transition-all duration-300">
                  Mark all as read
                </span>
              </button>
            </div>
          )}
          
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="group relative overflow-hidden bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg 
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 px-4">
            <svg className="mx-auto h-16 w-16 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full p-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No notifications</h3>
            <p className="mt-2 text-sm text-gray-500">You don't have any notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(n => (
              <div 
                key={n.id}
                onClick={() => openNotification(n)}
                className={`p-5 transition-colors duration-150 cursor-pointer ${
                  n.isRead ? 'bg-white hover:bg-gray-50' : 'bg-transparent hover:bg-orange-100'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openNotification(n); }}
              >
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  {getNotificationIcon(n.type)}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className={`text-sm font-semibold ${n.isRead ? 'text-gray-900' : 'text-gray-900'}`}>
                            {n.title}
                          </h3>
                          {!n.isRead && (
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                          {n.message}
                        </p>
                        {/* Time Information with both relative and exact time */}
                        <div className="flex items-center mt-2 space-x-4">
                          {/* Relative Time */}
                          <div className="flex items-center text-xs text-gray-900">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(n.createdAt)}
                          </div>
                          
                          {/* Exact Date and Time */}
                          <div className="flex items-center text-xs text-gray-900">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatFullDateTime(n.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Mark as Read Button */}
                      {!n.isRead && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markOne(n.id); }} 
                          className="flex-shrink-0 inline-flex items-center px-3 py-1.5 bg-white text-orange-600 border border-orange-200 rounded-lg text-xs font-medium hover:bg-orange-50 hover:border-orange-300 transition-colors shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {notifications.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-gray-900">
                {notifications.length} total notification{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                {unread} unread
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {notifications.length - unread} read
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}