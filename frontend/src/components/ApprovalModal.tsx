"use client";
import React, { useState, useEffect } from "react";

interface OrderItem {
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
  totalItems: number;
  totalValue: number | null;
  requestedAt: string;
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

interface ApprovalModalProps {
  order: Order;
  onApprove: (
    orderId: string,
    approvedItems: Array<{ sku: string; qtyApproved: number }>
  ) => void;
  onClose: () => void;
}

export default function ApprovalModal({
  order,
  onApprove,
  onClose,
}: ApprovalModalProps) {
  const [approvedQuantities, setApprovedQuantities] = useState<{
    [sku: string]: number;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize approved quantities by SKU
  useEffect(() => {
    const initialQuantities: { [sku: string]: number } = {};
    order.orderItems.forEach((orderItem) => {
      initialQuantities[orderItem.item.sku] = orderItem.qtyRequested;
    });
    setApprovedQuantities(initialQuantities);
  }, [order.orderItems]);

  const handleQuantityChange = (sku: string, quantity: number) => {
    const orderItem = order.orderItems.find((oi) => oi.item.sku === sku);
    if (!orderItem) return;

    const maxQuantity = orderItem.qtyRequested;
    const validQuantity = Math.max(0, Math.min(quantity, maxQuantity));

    setApprovedQuantities((prev) => ({
      ...prev,
      [sku]: validQuantity,
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const approvedItems = order.orderItems.map((orderItem) => ({
        sku: orderItem.item.sku,
        qtyApproved: approvedQuantities[orderItem.item.sku] || 0,
      }));

      console.log("✅ Approve Payload →", approvedItems);
      await onApprove(order.id, approvedItems);
    } catch (error) {
      console.error("Approval error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalApprovedItems = Object.values(approvedQuantities).reduce(
    (sum, qty) => sum + qty,
    0
  );

  const getStockStatus = (currentStock: number, requested: number) => {
    if (currentStock === 0)
      return { label: "Out of Stock", color: "text-red-600 bg-red-50" };
    if (currentStock < requested)
      return { label: "Low Stock", color: "text-orange-600 bg-orange-50" };
    return { label: "In Stock", color: "text-green-600 bg-green-50" };
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
      <div className="relative my-8 w-full max-w-5xl shadow-2xl rounded-xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-8 py-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Review & Approve Order
              </h3>
              <p className="text-blue-100 mt-1 font-medium text-lg">
                {order.orderNumber}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Order Info Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">Branch</p>
                  <p className="text-gray-700 font-semibold">
                    {order.branch.name}
                  </p>
                  <p className="text-gray-700 text-xs">
                    {order.branch.city}, {order.branch.state}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">
                    Requester
                  </p>
                  <p className="text-gray-700 font-semibold">
                    {order.requester.firstName} {order.requester.lastName}
                  </p>
                  <p className="text-gray-700 text-xs">
                    {order.requester.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 text-xs font-medium">
                    Submitted
                  </p>
                  <p className="text-gray-700 font-semibold">
                    {new Date(order.requestedAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-700 text-xs">
                    {new Date(order.requestedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {order.remarks && (
            <div className="mt-4 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <p className="text-blue-100 text-xs font-medium mb-1">Remarks</p>
              <p className="text-white text-sm">{order.remarks}</p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h4 className="text-lg font-bold text-gray-900">Order Items</h4>
            <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
              {order.orderItems.length} items
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
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
                    Stock Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Approve Quantity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.orderItems.map((orderItem, index) => {
                  const stockStatus = getStockStatus(
                    orderItem.item.currentStock,
                    orderItem.qtyRequested
                  );
                  return (
                    <tr
                      key={orderItem.item.sku}
                      className="hover:bg-blue-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {orderItem.item.name}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                {orderItem.item.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {orderItem.item.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${stockStatus.color}`}
                          >
                            {stockStatus.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-700">
                            {orderItem.item.currentStock}{" "}
                            <span className="text-xs text-gray-500">
                              {orderItem.item.unit}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg">
                          <span className="text-lg font-bold text-blue-700">
                            {orderItem.qtyRequested}
                          </span>
                          <span className="text-xs text-blue-600">
                            {orderItem.item.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              handleQuantityChange(
                                orderItem.item.sku,
                                (approvedQuantities[orderItem.item.sku] || 0) -
                                  1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors duration-150"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={orderItem.qtyRequested}
                            value={approvedQuantities[orderItem.item.sku] || 0}
                            onChange={(e) =>
                              handleQuantityChange(
                                orderItem.item.sku,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center text-black px-3 py-2 text-sm font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
                          />
                          <button
                            onClick={() =>
                              handleQuantityChange(
                                orderItem.item.sku,
                                (approvedQuantities[orderItem.item.sku] || 0) +
                                  1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-bold transition-colors duration-150"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          Max: {orderItem.qtyRequested} {orderItem.item.unit}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="px-8 pb-6">
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 p-6 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">
                    Requested Items
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {order.totalItems}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">
                    Approved Items
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {totalApprovedItems}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase">
                    Order Value
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${order.totalValue ? Number(order.totalValue).toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-8 py-5 rounded-b-xl flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || totalApprovedItems === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Approving...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Confirm Approval
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}