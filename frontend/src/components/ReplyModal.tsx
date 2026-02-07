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

interface ReplyModalProps {
  order: Order;
  onReply: (orderId: string, reply: string) => void;
  onClose: () => void;
}

export default function ReplyModal({ order, onReply, onClose }: ReplyModalProps) {
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle reply submission
  const handleReply = async () => {
    if (!reply.trim()) {
      alert('Please provide a reply');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReply(order.id, reply.trim());
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Reply to Issue: {order.orderNumber}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          
          <div className="mt-2 text-sm text-gray-500">
            <p><strong>Branch:</strong> {order.branch.name}</p>
            <p><strong>Requester:</strong> {order.requester.firstName} {order.requester.lastName}</p>
            <p><strong>Status:</strong> {order.status}</p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-6 bg-gray-50 p-4 rounded-md">
          <h4 className="text-md font-medium text-gray-900 mb-3">Order Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Items: <span className="font-medium">{order.totalItems}</span></p>
              <p className="text-sm text-gray-600">
  Order Value: <span className="font-medium">
    ${order.totalValue ? Number(order.totalValue).toFixed(2) : '0.00'}
  </span>
</p>

            </div>
            <div>
              <p className="text-gray-600">Destination: <span className="font-medium">{order.branch.name}</span></p>
              <p className="text-gray-600">Address: <span className="font-medium">{order.branch.address}, {order.branch.city}</span></p>
            </div>
          </div>
        </div>

        {/* Issue Details */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Issue Details</h4>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h5 className="text-sm font-medium text-red-800 mb-2">Issue Raised:</h5>
            <p className="text-sm text-red-700">{order.remarks || 'No specific issue details provided'}</p>
          </div>
        </div>

        {/* Manager Reply */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Your Reply</h4>
          <div>
            <label htmlFor="reply" className="block text-sm font-medium text-gray-700">
              Reply to Issue *
            </label>
            <textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Please provide your response to the issue raised..."
              rows={6}
              className="mt-1 text-black block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
        </div>

        {/* Previous Reply (if any) */}
        {order.managerReply && (
          <div className="mt-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Previous Reply</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-700">{order.managerReply}</p>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Important Information
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your reply will be sent to the branch user and the order status will be updated to "Under Review" 
                  for the branch user to take further action.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReply}
            disabled={isSubmitting || !reply.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending Reply...' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}


