'use client';

import { useAuth } from '@/context/AuthContext';
import React, { useState, useEffect } from 'react';

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
  remarks: string | null;
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

interface ConfirmationModalProps {
  order: Order;
  onConfirm: (orderId: string) => void;
  onRaiseIssue: (orderId: string, issues: Record<string, string>) => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  order,
  onConfirm,
  onRaiseIssue,
  onClose,
}: ConfirmationModalProps) {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemDetails, setItemDetails] = useState<Record<string, any>>({});
  const [itemIssues, setItemIssues] = useState<Record<string, string>>({});
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const toSafeNumber = (val: any) => {
    const num =
      val === null || val === undefined
        ? 0
        : typeof val === 'string'
        ? parseFloat(val)
        : val;
    return isNaN(num) ? 0 : num;
  };

  const safeTotalValue = toSafeNumber(order.totalValue);

  // ✅ Confirm order
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(order.id);
    } catch (error) {
      console.error('Confirmation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Submit all issues
  const handleSubmitAllIssues = async () => {
    if (Object.keys(itemIssues).length === 0) {
      alert('Please add at least one issue before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRaiseIssue(order.id, itemIssues);
    } catch (error) {
      console.error('Error submitting all issues:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Fetch item details by SKU
  useEffect(() => {
    const fetchItemDetails = async () => {
      try {
        const details: Record<string, any> = {};
        for (const orderItem of order.orderItems) {
          const sku = orderItem.item?.sku || orderItem.sku || '';
          if (!sku) continue;

          const endpoint = `${API_BASE}/api/products/by-sku/${sku}`;
          const res = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              details[sku] = data.data;
            } else {
              console.warn(`⚠️ No product found for SKU: ${sku}`);
            }
          } else {
            console.error(`❌ Failed to fetch product for ${sku} (${res.status})`);
          }
        }
        setItemDetails(details);
      } catch (error) {
        console.error('Error fetching item details:', error);
      }
    };

    fetchItemDetails();
  }, [order]);

  const totalApprovedItems = order.orderItems.reduce(
    (sum, item) => sum + (item.qtyApproved || item.qtyRequested),
    0
  );

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
      <div className="relative my-8 w-full max-w-5xl shadow-2xl rounded-xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-8 py-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Order Receipt
              </h3>
              <p className="text-green-100 mt-1 font-medium text-lg">{order.orderNumber}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-green-50">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h4 className="text-lg font-bold text-gray-900">Order Summary</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">Requested Items</p>
                  <p className="text-2xl font-bold text-gray-900">{order.totalItems}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">Approved Items</p>
                  <p className="text-2xl font-bold text-green-600">{totalApprovedItems}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">${safeTotalValue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Destination Info */}
          <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-green-100">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{order.branch.name}</p>
                <p className="text-sm text-gray-600">{order.branch.address}, {order.branch.city}, {order.branch.state}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Approved Items */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h4 className="text-lg font-bold text-gray-900">Approved Items</h4>
            <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
              {order.orderItems.length} items
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Requested</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Approved</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.orderItems.map((item, index) => {
                  const sku = item.item?.sku || item.sku;
                  const details = itemDetails[sku] || item.item || {};

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-green-50 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{details.name || 'N/A'}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{details.category || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {sku || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg">
                            <span className="text-lg font-bold text-blue-700">{item.qtyRequested}</span>
                            <span className="text-xs text-blue-600">{details.unit || ''}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg ${
                              item.qtyApproved === item.qtyRequested
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            }`}
                          >
                            {item.qtyApproved === item.qtyRequested && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {item.qtyApproved || item.qtyRequested} {details.unit || ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 border border-red-200 transition-all duration-200"
                            onClick={() =>
                              setActiveItemId(activeItemId === item.id ? null : item.id)
                            }
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {activeItemId === item.id ? 'Hide' : 'Raise Issue'}
                          </button>
                        </td>
                      </tr>

                      {activeItemId === item.id && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 bg-red-50 border-l-4 border-red-500">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <label className="block text-sm font-semibold text-red-900 mb-2">
                                  Describe the issue with "{details.name}"
                                </label>
                                <textarea
                                  placeholder="Please provide details about the issue..."
                                  value={itemIssues[item.id] || ''}
                                  onChange={(e) =>
                                    setItemIssues({
                                      ...itemIssues,
                                      [item.id]: e.target.value,
                                    })
                                  }
                                  rows={3}
                                  className="w-full text-sm text-black p-3 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
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

        {/* Actions */}
        <div className="bg-gray-50 px-8 py-5 rounded-b-xl flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>

          <button
            onClick={handleSubmitAllIssues}
            disabled={isSubmitting || Object.keys(itemIssues).length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg text-sm font-semibold hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Submit All Issues
              </>
            )}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirming...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}