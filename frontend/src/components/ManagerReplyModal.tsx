'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Package, 
  AlertTriangle, 
  Send, 
  MessageSquare,
  Hash,
  Tag,
  TrendingUp,
  User,
  Building2,
  Layers,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Reply,
  EyeOff
} from 'lucide-react';

interface OrderItem {
  id: string;
  qtyRequested: number;
  qtyApproved: number | null;
  unitPrice: number | string | null;
  totalPrice: number | string | null;
  item: {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    currentStock: number;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalItems: number;
  branch: { name: string };
  requester: { firstName: string; lastName: string };
  orderItems: OrderItem[];
}

interface ManagerReplyModalProps {
  order: Order;
  onSubmitReplies: (
    orderId: string,
    replies: { itemId: string; reply: string; qtyApproved: number; issueIds?: string[] }[]
  ) => Promise<void>;
  onClose: () => void;
}

export default function ManagerReplyModal({
  order,
  onSubmitReplies,
  onClose,
}: ManagerReplyModalProps) {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemReplies, setItemReplies] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<Record<string, any[]>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const chatRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // ✅ Fetch issues grouped by orderItemId
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/${order.id}/issues`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const grouped: Record<string, any[]> = {};

          data.data.forEach((issue: any) => {
            const key = issue.orderItem?.id || issue.itemId;
            if (!key) return;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(issue);
          });

          setIssues(grouped);
          
          // ✅ All items start collapsed - user must click to expand
          // Removed auto-expand logic
        } else {
          setIssues({});
        }
      } catch (err) {
        console.error('❌ Error fetching issues:', err);
      }
    };

    if (token) fetchIssues();
  }, [order.id, token, API_URL]);

  // ✅ Initialize approved quantities
  useEffect(() => {
    const initial: Record<string, number> = {};
    order.orderItems.forEach((item) => {
      initial[item.id] = item.qtyApproved ?? item.qtyRequested ?? 0;
    });
    setQuantities(initial);
  }, [order.orderItems]);

  // ✅ Auto-scroll to bottom of chat when expanded
  useEffect(() => {
    Object.keys(expandedItems).forEach(itemId => {
      if (expandedItems[itemId] && chatRefs.current[itemId]) {
        setTimeout(() => {
          chatRefs.current[itemId]?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
      }
    });
  }, [expandedItems]);

  // Handlers
  const handleQuantityChange = (itemId: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleReplyChange = (itemId: string, val: string) => {
    setItemReplies((prev) => ({ ...prev, [itemId]: val }));
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSubmit = async () => {
    const formatted = order.orderItems
      .filter((item) => (itemReplies[item.id] || '').trim() !== '')
      .map((item) => ({
        itemId: item.id,
        reply: itemReplies[item.id],
        qtyApproved: quantities[item.id] ?? 0,
        issueIds: (issues[item.id] || []).map((i) => i.id),
      }));

    if (formatted.length === 0) {
      alert('Please provide at least one reply before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitReplies(order.id, formatted);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
      <div className="relative my-8 w-full max-w-6xl animate-in zoom-in-95 fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Manager Reply</h2>
                  <p className="text-blue-100 text-sm mt-0.5">Order #{order.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white flex items-center justify-center transition-all duration-200 hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Order Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Branch Info */}
              <div className="bg-white rounded-xl p-3 border border-blue-200 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-wide">Branch</p>
                    <p className="font-bold text-gray-900 text-sm truncate">{order.branch.name}</p>
                  </div>
                </div>
              </div>

              {/* Requester Info */}
              <div className="bg-white rounded-xl p-3 border border-indigo-200 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-wide">Requested By</p>
                    <p className="font-bold text-gray-900 text-sm truncate">
                      {order.requester.firstName} {order.requester.lastName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Items Info */}
              <div className="bg-white rounded-xl p-3 border border-purple-200 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5 uppercase tracking-wide">Total Items</p>
                    <p className="font-bold text-gray-900 text-sm">
                      {order.totalItems} {order.totalItems === 1 ? 'Item' : 'Items'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {order.orderItems.map((item) => {
                const key = item.id;
                const itemIssues = issues[key] || [];
                const isExpanded = expandedItems[key] || false;
                const hasIssues = itemIssues.length > 0;

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                      hasIssues
                        ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-lg shadow-red-100'
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg'
                    }`}
                  >
                    {/* Item Header - All in One Row */}
                    <div className={`p-4 ${hasIssues ? 'bg-gradient-to-r from-red-100/50 to-rose-100/50' : 'bg-gradient-to-r from-gray-50 to-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                          hasIssues ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}>
                            {hasIssues ? (
                            <AlertTriangle className="w-7 h-7 text-white" />
                            ) : (
                            <Package className="w-7 h-7 text-white" />
                            )}
                          </div>

                        {/* Item Details */}
                          <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-base mb-1.5 truncate">{item.item.name}</h4>
                            <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700 border border-gray-300 shadow-sm">
                                <Tag className="w-3 h-3" />
                                {item.item.category}
                              </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700 border border-gray-300 shadow-sm">
                                <Hash className="w-3 h-3" />
                                {item.item.sku}
                              </span>
                              {hasIssues && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-lg text-xs font-bold text-white shadow-md animate-pulse">
                                  <AlertTriangle className="w-3 h-3" />
                                  {itemIssues.length} Issue{itemIssues.length !== 1 ? 's' : ''}
                                </span>
                              )}
                          </div>
                        </div>

                        {/* Quantities */}
                        <div className="flex gap-2">
                          <div className="text-center px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-300 shadow-sm">
                            <p className="text-[10px] text-gray-500 mb-0.5 font-semibold uppercase tracking-wide">Requested</p>
                            <p className="text-base font-bold text-gray-900">
                              {item.qtyRequested}
                              <span className="text-[10px] text-gray-500 ml-1">{item.item.unit}</span>
                            </p>
                          </div>
                          <div className="text-center px-3 py-2 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-300 shadow-sm">
                            <p className="text-[10px] text-blue-700 mb-0.5 font-semibold uppercase tracking-wide">Approved</p>
                            <p className="text-base font-bold text-blue-700">
                              {item.qtyApproved ?? item.qtyRequested}
                              <span className="text-[10px] text-blue-600 ml-1">{item.item.unit}</span>
                            </p>
                        </div>
                      </div>

                      {/* View Reply Button */}
                        <button
                          onClick={() => toggleItemExpanded(key)}
                          className={`px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 inline-flex items-center gap-2 shadow-md flex-shrink-0 ${
                            hasIssues
                              ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                          }`}
                        >
                          {isExpanded ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              <span className="text-sm">Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              <span className="text-sm">{hasIssues ? `View Issues` : 'Reply'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Reply Section */}
                    {isExpanded && (
                      <div className="border-t-2 border-gray-200 animate-slideDown">
                        {/* Chat History */}
                        {hasIssues && (
                          <div className="px-5 py-4 bg-gradient-to-b from-gray-50 to-white">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-white" />
                              </div>
                              <p className="font-bold text-gray-900 text-sm">Conversation History</p>
                              <span className="ml-auto px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-lg shadow-md">
                                {itemIssues.length} message{itemIssues.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-300 rounded-xl p-4 shadow-inner max-h-64 overflow-y-auto space-y-3 custom-scrollbar">
                              {itemIssues.map((msg) => {
                                const isManager = msg.senderRole === 'MANAGER' || msg.senderRole === 'ADMIN';
                                const isBranch = msg.senderRole === 'BRANCH_USER';
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`px-4 py-3 rounded-2xl text-sm max-w-md shadow-lg ${
                                        isManager
                                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-sm'
                                          : isBranch
                                          ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-bl-sm'
                                          : 'bg-white border border-gray-300 text-gray-800 shadow-md'
                                      }`}
                                    >
                                      <p className="font-bold mb-1 text-xs opacity-90">
                                        {isManager ? '👨‍💼 Manager' : isBranch ? '🏢 Branch User' : msg.senderRole}
                                      </p>
                                      <p className="leading-relaxed">{msg.message}</p>
                                      <div className="flex items-center gap-1 text-[10px] mt-2 opacity-75">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(msg.createdAt).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              <div ref={(el) => (chatRefs.current[key] = el)} />
                            </div>
                          </div>
                        )}

                        {/* Form Section */}
                        <div className="p-5 space-y-4 bg-white">
                          {/* New Approved Quantity */}
                          <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-white" />
                              </div>
                              New Approved Quantity
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                value={quantities[key] || 0}
                                onChange={(e) => handleQuantityChange(key, parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all shadow-sm hover:border-indigo-400"
                                placeholder="Enter quantity"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded">
                                {item.item.unit}
                              </span>
                            </div>
                          </div>

                          {/* Reply */}
                          <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                                <Reply className="w-4 h-4 text-white" />
                              </div>
                              Your Reply
                            </label>
                            <textarea
                              rows={3}
                              value={itemReplies[key] || ''}
                              onChange={(e) => handleReplyChange(key, e.target.value)}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all resize-none shadow-sm hover:border-indigo-400"
                              placeholder="Write your reply to address any issues or provide additional information..."
                            />
                          </div>

                          {/* Quick Reply Actions */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              {hasIssues && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  Reply will be sent to branch user
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                handleReplyChange(key, '');
                                handleQuantityChange(key, item.qtyRequested);
                              }}
                              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all shadow-sm hover:shadow-md"
                            >
                              Clear Form
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-t-2 border-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">{order.orderItems.length}</span> item{order.orderItems.length !== 1 ? 's' : ''} to review
                </p>
                {Object.values(issues).some(arr => arr.length > 0) && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg text-xs font-bold shadow-md">
                    {Object.values(issues).reduce((sum, arr) => sum + arr.length, 0)} total issue{Object.values(issues).reduce((sum, arr) => sum + arr.length, 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 inline-flex items-center gap-2 shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Replies
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes zoom-in-95 {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 2000px;
          }
        }
        .animate-in {
          animation: zoom-in-95 0.2s ease-out;
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #6366f1, #8b5cf6);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #4f46e5, #7c3aed);
        }
      `}</style>
    </div>
  );
}