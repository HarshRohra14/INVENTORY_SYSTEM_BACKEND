'use client';

import React, { useState } from 'react';

interface OrderItem {
  id: string;
  qtyRequested: number;
  qtyApproved: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
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
  managerReply: string | null;
  totalItems: number;
  totalValue: number | null;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
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

interface CloseModalProps {
  order: Order;
  onClose: (orderId: string) => void;
  onCancel: () => void;
}

export default function CloseModal({ order, onClose, onCancel }: CloseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle order closure
  const handleClose = async () => {
    setIsSubmitting(true);
    try {
      await onClose(order.id);
    } catch (error) {
      console.error('Close order error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe numeric conversions
  const safeTotalValue = Number(order.totalValue || 0);

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
      <div className="relative my-8 w-full max-w-7xl shadow-2xl rounded-xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 px-8 py-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Close & Complete Order
              </h3>
              <p className="text-green-100 mt-1 font-medium text-lg">{order.orderNumber}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Order Info Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">Branch</p>
                  <p className="text-gray-700 font-semibold">{order.branch.name}</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">Requester</p>
                  <p className="text-gray-700 font-semibold">{order.requester.firstName} {order.requester.lastName}</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">Status</p>
                  <p className="text-gray-700 font-semibold">{order.status.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-6">
          {/* Row 1: Order Summary and Order Timeline side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Summary */}
            <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h4 className="text-lg font-bold text-gray-900">Order Summary</h4>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase">Total Items</p>
                      <p className="text-2xl font-bold text-gray-900">{order.totalItems}</p>
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

                {/* Destination */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600 uppercase mb-1">Destination</p>
                      <p className="text-sm font-semibold text-gray-900">{order.branch.name}</p>
                      <p className="text-sm text-gray-600">{order.branch.address}, {order.branch.city}, {order.branch.state}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-lg font-bold text-gray-900">Order Timeline</h4>
              </div>
              
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400"></div>
                
                <div className="space-y-6">
                  {/* Requested */}
                  <div className="flex items-start gap-4 relative">
                    <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full border-4 border-white shadow-md z-10">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="flex-1 bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-sm font-semibold text-green-900">Order Requested</p>
                      <p className="text-xs text-green-700 mt-1">{new Date(order.requestedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Approved */}
                  {order.approvedAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full border-4 border-white shadow-md z-10">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">Order Approved</p>
                        <p className="text-xs text-blue-700 mt-1">{new Date(order.approvedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Received */}
                  {order.receivedAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full border-4 border-white shadow-md z-10">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <p className="text-sm font-semibold text-purple-900">Order Received</p>
                        <p className="text-xs text-purple-700 mt-1">{new Date(order.receivedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Order Items - Full Width */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h4 className="text-lg font-bold text-gray-900">Order Items</h4>
              <span className="ml-auto text-sm text-gray-500 bg-gray-200 px-3 py-1 rounded-full font-medium">
                {order.orderItems.length} items
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item Details</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Total Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.orderItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-green-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.item.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">{item.item.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {item.item.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                          <span className="text-lg font-bold text-green-700">{item.qtyApproved || item.qtyRequested}</span>
                          <span className="text-xs text-green-600">{item.item.unit}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">
                          ${Number(item.unitPrice || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-gray-900">
                          ${Number(item.totalPrice || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 3: Order Completion Confirmation - Full Width */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  Order Completion Confirmation
                </h3>
                <div className="text-sm text-green-700 space-y-2">
                  <p className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>This order has been successfully delivered and confirmed as received by the branch user.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Closing this order will mark it as <strong>completed</strong> in the system.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-amber-700"><strong>Note:</strong> Once closed, this order cannot be reopened.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-8 py-5 rounded-b-xl flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
          
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Closing Order...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Close Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}