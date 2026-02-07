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

interface DispatchModalProps {
  order: Order;
  onDispatch: (orderId: string, dispatchData: { trackingId: string; courierLink: string }) => void;
  onClose: () => void;
}

export default function DispatchModal({ order, onDispatch, onClose }: DispatchModalProps) {
  const [trackingId, setTrackingId] = useState('');
  const [courierLink, setCourierLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Handle dispatch submission
  const handleSubmit = async () => {
    if (!trackingId.trim()) {
      alert('Please enter a tracking ID');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Build FormData to include files
      const payload = new FormData();
      payload.append('trackingId', trackingId.trim());
      payload.append('courierLink', courierLink.trim());
      files.forEach((f) => payload.append('files', f));

      await onDispatch(order.id, payload as unknown as any);
    } catch (error) {
      console.error('Dispatch error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    setFiles(selected);
    const urls = selected.map(f => URL.createObjectURL(f));
    setPreviews(urls);
  };

  // Calculate total approved items
  const totalApprovedItems = order.orderItems.reduce((sum, item) => {
    return sum + (item.qtyApproved || item.qtyRequested);
  }, 0);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Dispatch Order: {order.orderNumber}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Photos / Videos (required)</label>
            <input type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="mt-2" />
            <div className="mt-2 flex gap-2 flex-wrap">
              {previews.map((p, idx) => (
                <div key={idx} className="w-24 h-24 overflow-hidden rounded-md border">
                  {/* simple img preview for images; videos show poster if available */}
                  {p.endsWith('.mp4') || p.endsWith('.mov') ? (
                    <video src={p} className="w-full h-full object-cover" />
                  ) : (
                    <img src={p} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-2 text-sm text-gray-500">
            <p><strong>Branch:</strong> {order.branch.name}</p>
            <p><strong>Requester:</strong> {order.requester.firstName} {order.requester.lastName}</p>
            <p><strong>Approved:</strong> {order.approvedAt ? new Date(order.approvedAt).toLocaleString() : 'N/A'}</p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-6 bg-gray-50 p-4 rounded-md">
          <h4 className="text-md font-medium text-gray-900 mb-3">Order Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Items Approved: <span className="font-medium">{totalApprovedItems}</span></p>
              <p className="text-gray-600">Order Value: <span className="font-medium">${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</span></p>
            </div>
            <div>
              <p className="text-gray-600">Destination: <span className="font-medium">{order.branch.name}</span></p>
              <p className="text-gray-600">Address: <span className="font-medium">{order.branch.address}, {order.branch.city}</span></p>
            </div>
          </div>
        </div>

        {/* Approved Items */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Items to Dispatch</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty Approved
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.orderItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.item.name}</div>
                      <div className="text-sm text-gray-500">{item.item.category}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {item.item.sku}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {item.qtyApproved || item.qtyRequested} {item.item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dispatch Information */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Dispatch Information</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="trackingId" className="block text-sm font-medium text-gray-700">
                Tracking ID *
              </label>
              <input
                type="text"
                id="trackingId"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter courier tracking number"
                className="mt-1 text-black block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="courierLink" className="block text-sm font-medium text-gray-700">
                Courier Tracking Link (Optional)
              </label>
              <input
                type="url"
                id="courierLink"
                value={courierLink}
                onChange={(e) => setCourierLink(e.target.value)}
                placeholder="https://courier.com/track/..."
                className="mt-1 text-black block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Important Notice
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Once dispatched, this order will be marked as "In Transit" and stock levels will be updated in the BoxHero system. 
                  The branch user will be notified with tracking information.
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
            onClick={handleSubmit}
            disabled={isSubmitting || !trackingId.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Dispatching...' : 'Mark as Dispatched'}
          </button>
        </div>
      </div>
    </div>
  );
}
