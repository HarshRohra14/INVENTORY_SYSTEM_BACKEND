'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notificationSound } from '@/utils/notificationSound';
import NotificationSoundSettings from './NotificationSoundSettings';

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
  orderId?: string;
}

export default function NotificationsBell() {
  const { token } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [previousUnread, setPreviousUnread] = useState(0);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        const newNotifications = data.data.notifications || [];
        const newUnread = data.data.unreadCount || 0;
        
        // Play notification sound if new unread notifications
        if (newUnread > previousUnread && newUnread > 0) {
          notificationSound.play();
        }
        
        setNotifications(newNotifications);
        setUnread(newUnread);
        setPreviousUnread(newUnread);
      }
    } catch (e) {
      console.error('Fetch notifications error:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, API_BASE_URL]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markAll: true })
      });
      fetchNotifications();
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  };

  const markOneRead = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [id] })
      });
      // Refresh silently
      fetchNotifications();
    } catch (e) {
      console.error('Mark one read error:', e);
    }
  };

  const openNotification = (n: Notification) => {
    if (!n.isRead) {
      // fire-and-forget; don't block navigation
      markOneRead(n.id);
    }
    if (n.orderId) {
      setOpen(false);
      router.push(`/dashboard/orders/${n.orderId}`);
    }
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
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'BROADCAST':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        type="button"
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="sr-only">View notifications</span>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Notification Badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <>
          {/* Mobile Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden" 
            onClick={() => setOpen(false)}
          />

          {/* Notifications Container */}
          <div 
            ref={dropdownRef}
            className="fixed md:absolute left-0 right-0 md:left-auto md:right-0 bottom-0 md:bottom-auto md:top-full md:mt-2 w-full md:w-96 bg-white md:rounded-xl rounded-t-2xl md:rounded-t-xl shadow-2xl border-t md:border border-gray-200 overflow-hidden z-50 max-h-[90vh] md:max-h-[calc(100vh-100px)] flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-white font-semibold text-lg">Notifications</h3>
                {unread > 0 && (
                  <p className="text-orange-100 text-xs mt-0.5">{unread} unread notification{unread !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    type="button"
                    className="text-xs font-medium text-gray-900 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {/* Close button for mobile */}
                <button
                  onClick={() => setOpen(false)}
                  type="button"
                  className="md:hidden text-white/80 hover:text-white transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notifications List - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">No notifications</p>
                  <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className={`px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-orange-50' : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openNotification(notification); }}
                    >
                      <div className="flex space-x-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium text-gray-900`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mt-1 line-clamp-2 whitespace-pre-line">
                            {notification.message}
                          </p>
                          <div className="flex items-center mt-2 space-x-4">
                            <div className="flex items-center text-xs text-gray-900">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatTime(notification.createdAt)}
                            </div>
                            <div className="flex items-center text-xs text-gray-900">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatFullDateTime(notification.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Fixed at bottom */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
                {/* Sound Settings */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setShowSoundSettings(!showSoundSettings)}
                    className="w-full px-4 py-3 text-left text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center">
                      {notificationSound.isSoundEnabled() ? '🔊' : '🔇'} Sound Settings
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${showSoundSettings ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showSoundSettings && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <NotificationSoundSettings onClose={() => setShowSoundSettings(false)} />
                    </div>
                  )}
                </div>
                
                {/* View All Link */}
                <Link
                  href="/dashboard/notifications"
                  className="block px-4 py-3 text-center text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  View all notifications →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}