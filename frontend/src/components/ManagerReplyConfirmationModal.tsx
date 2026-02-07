'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import IssueThread from './IssueThread';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Building2, 
  MessageSquare,
  Hash,
  Tag,
  Send,
  FileText,
  Eye,
  Clock,
  User
} from 'lucide-react';

interface OrderItem {
  id: string;
  qtyRequested: number;
  qtyApproved: number | null;
  unitPrice: number | string | null;
  totalPrice: number | string | null;
  sku?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  remarks: string | null;
  managerReply: string | null;
  totalItems: number;
  totalValue: number | string | null;
  requestedAt: string;
  approvedAt: string | null;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
  };
  orderItems: OrderItem[];
}

interface ManagerReplyConfirmationModalProps {
  order: Order;
  onConfirm: (orderId: string) => void;
  onRaiseIssue: (orderId: string, issues: Record<string, string>) => void;
  onClose: () => void;
}

export default function ManagerReplyConfirmationModal({
  order,
  onConfirm,
  onRaiseIssue,
  onClose,
}: ManagerReplyConfirmationModalProps) {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemDetails, setItemDetails] = useState<Record<string, any>>({});
  const [itemIssues, setItemIssues] = useState<Record<string, string>>({});
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [viewReplyItemId, setViewReplyItemId] = useState<string | null>(null);
  const [itemConversations, setItemConversations] = useState<Record<string, any[]>>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // ✅ Convert to number safely
  const toSafeNumber = (val: any) => {
    const num =
      val === null || val === undefined
        ? 0
        : typeof val === 'string'
        ? parseFloat(val)
        : val;
    return isNaN(num) ? 0 : num;
  };

  // ✅ Fetch product details by SKU
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const details: Record<string, any> = {};

        for (const item of order.orderItems) {
          const sku = item.sku || '';
          if (!sku) continue;

          const res = await fetch(`${API_URL}/api/products/by-sku/${sku}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              details[sku] = data.data;
            }
          } else {
            console.warn(`⚠️ Failed to fetch item for SKU: ${sku}`);
          }
        }
        setItemDetails(details);
      } catch (error) {
        console.error('Error fetching item details:', error);
      }
    };

    fetchDetails();
  }, [order, token]);

  // ✅ Fetch conversations for specific items
  useEffect(() => {
    const fetchConversations = async () => {
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
            const itemId = issue.orderItem?.id || issue.itemId;
            if (!itemId) return;
            if (!grouped[itemId]) grouped[itemId] = [];
            grouped[itemId].push(issue);
          });

          setItemConversations(grouped);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    if (token) fetchConversations();
  }, [order.id, token]);

  // ✅ Confirm
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(order.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Submit all issues (item-wise)
  const handleSubmitAllIssues = async () => {
    if (Object.keys(itemIssues).length === 0) {
      alert('Please add at least one issue before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRaiseIssue(order.id, itemIssues);
    } catch (error) {
      console.error('Error submitting issues:', error);
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
                  <h3 className="text-2xl font-bold text-white">Manager Reply Received</h3>
                  <p className="text-blue-100 text-sm mt-0.5">Order #{order.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white flex items-center justify-center transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-5 border-b border-indigo-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Branch Info */}
              <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">Branch</p>
                    <p className="font-bold text-gray-900 text-sm truncate">{order.branch.name}</p>
                  </div>
                </div>
              </div>

              {/* Previous Issue */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">Your Previous Issue</p>
                    <p className="font-medium text-gray-900 text-sm truncate">{order.remarks || 'No previous issue'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            {/* Updated Items */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <h4 className="text-lg font-bold text-gray-900">Updated Approved Items</h4>
                <span className="ml-auto text-sm text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full font-semibold">
                  {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border-2 border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Item Details
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.orderItems.map((item, index) => {
                      const sku = item.sku || '';
                      const details = itemDetails[sku] || {};
                      const hasConversation = itemConversations[item.id]?.length > 0;
                      const requestedQty = toSafeNumber(item.qtyRequested);
                      const approvedQty = toSafeNumber(item.qtyApproved);
                      const isModified = approvedQty < requestedQty;
                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`hover:bg-green-50/50 transition-colors ${isModified ? 'bg-amber-50' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl font-bold text-green-700 shadow-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{details.name || 'N/A'}</p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Tag className="w-3 h-3 text-gray-400" />
                                    <p className="text-xs text-gray-500">{details.category || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <Hash className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-700 font-medium">{sku || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-lg">
                                <span className="text-sm font-semibold text-gray-700">{requestedQty}</span>
                                <span className="text-xs text-gray-500">{details.unit || ''}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${isModified ? 'bg-amber-100' : 'bg-green-100'}`}>
                                <div className="inline-flex items-center gap-1">
                                  <span className={`text-sm font-bold ${isModified ? 'text-amber-800' : 'text-green-700'}`}>{approvedQty}</span>
                                  <span className={`text-xs ${isModified ? 'text-amber-700' : 'text-green-600'}`}>{details.unit || ''}</span>
                                </div>
                                {isModified && (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                                    <AlertTriangle className="w-3 h-3" />
                                    Less than requested
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                {/* View Reply Button */}
                                {hasConversation && (
                                  <button
                                    onClick={() =>
                                      setViewReplyItemId(viewReplyItemId === item.id ? null : item.id)
                                    }
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-200 transition-all shadow-sm hover:shadow"
                                  >
                                    <Eye className="w-4 h-4" />
                                    {viewReplyItemId === item.id ? 'Hide Reply' : 'View Reply'}
                                  </button>
                                )}
                                
                                {/* Raise Issue Button */}
                                <button
                                  onClick={() =>
                                    setActiveItemId(activeItemId === item.id ? null : item.id)
                                  }
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200 transition-all shadow-sm hover:shadow"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                  {activeItemId === item.id ? 'Hide Issue' : 'Raise Issue'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* View Reply Section */}
                          {viewReplyItemId === item.id && hasConversation && (
                            <tr>
                              <td colSpan={5} className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-sm font-bold text-indigo-900 mb-3">
                                      Conversation for "{details.name}"
                                    </label>
                                    <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-inner max-h-96 overflow-y-auto space-y-3">
                                      {itemConversations[item.id]?.map((msg: any) => {
                                        const isManager = msg.senderRole === 'MANAGER' || msg.senderRole === 'ADMIN';
                                        const isBranch = msg.senderRole === 'BRANCH_USER';
                                        return (
                                          <div
                                            key={msg.id}
                                            className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}
                                          >
                                            <div
                                              className={`px-4 py-3 rounded-2xl text-sm max-w-md shadow-md ${
                                                isManager
                                                  ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-br-sm'
                                                  : isBranch
                                                  ? 'bg-gradient-to-br from-red-500 to-rose-500 text-white rounded-bl-sm'
                                                  : 'bg-gray-100 text-gray-800'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 mb-1">
                                                <User className="w-3 h-3 opacity-90" />
                                                <p className="font-bold text-xs opacity-90">
                                                  {isManager ? '👨‍💼 Manager' : isBranch ? '🏢 Branch User' : msg.senderRole}
                                                </p>
                                              </div>
                                              <p className="leading-relaxed">{msg.message}</p>
                                              <div className="flex items-center gap-1 text-[10px] mt-2 opacity-75">
                                                <Clock className="w-3 h-3" />
                                                <span>{new Date(msg.createdAt).toLocaleString()}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Raise Issue Section */}
                          {activeItemId === item.id && (
                            <tr>
                              <td colSpan={5} className="px-6 py-5 bg-red-50 border-l-4 border-red-500">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-sm font-bold text-red-900 mb-3">
                                      Describe the issue with "{details.name}"
                                    </label>
                                    <textarea
                                      placeholder="Please provide detailed information about the issue..."
                                      value={itemIssues[item.id] || ''}
                                      onChange={(e) =>
                                        setItemIssues({
                                          ...itemIssues,
                                          [item.id]: e.target.value,
                                        })
                                      }
                                      rows={3}
                                      className="w-full text-sm p-4 text-black border-2 border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none shadow-inner"
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmitAllIssues}
                disabled={isSubmitting || Object.keys(itemIssues).length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold hover:from-red-700 hover:to-rose-700 hover:shadow-lg hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit All Issues
                  </>
                )}
              </button>

              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Accept & Confirm Order
                  </>
                )}
              </button>
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
        .animate-in {
          animation: zoom-in-95 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}