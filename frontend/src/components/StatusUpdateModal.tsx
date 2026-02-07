// StatusUpdateModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import ArrangingOrderComponent from './ArrangingOrderComponent';
import { useAuth } from '../context/AuthContext';

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
  requestedAt?: string;
  approvedAt?: string | null;
  // supporting both shapes used in your codebase
  arrangingStage?: 'ARRANGING' | 'ARRANGED' | 'SENT_FOR_PACKAGING' | null;
  arranging?: { stage?: string } | null;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
  };
  orderItems?: OrderItem[];
}

interface StatusUpdateModalProps {
  order: Order;
  userRole?: string;
  onUpdateStatus: (
    orderId: string,
    newStatus: string,
    trackingDetails?: { trackingId?: string; trackingLink?: string }
  ) => Promise<any>;
  onClose: () => void;
  // optional: a callback to refresh parent data if needed
  onRefresh?: () => Promise<void> | void;
}

export default function StatusUpdateModal({
  order,
  userRole,
  onUpdateStatus,
  onClose,
  onRefresh
}: StatusUpdateModalProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(order.status);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [trackingId, setTrackingId] = useState<string>('');
  const [trackingLink, setTrackingLink] = useState<string>('');
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isArrangingLoading, setIsArrangingLoading] = useState<boolean>(false);
  const [arrangingFiles, setArrangingFiles] = useState<File[]>([]);
  const [arrangingPreviews, setArrangingPreviews] = useState<string[]>([]);
  const [statusFiles, setStatusFiles] = useState<File[]>([]);
  const [statusPreviews, setStatusPreviews] = useState<string[]>([]);
  const [nextArrangingStage, setNextArrangingStage] = useState<{ key: 'ITEM_ARRANGING' | 'ARRANGED_FOR_PACKAGING' | null; label: string | null }>({
    key: null,
    label: null
  });

  // Get token once (do not call useAuth inside callbacks)
  const { token } = useAuth();

  // Read arranging stage from either shape your backend/frontend might return
  const currentArrangingStage = (order as any)?.arranging?.stage || (order as any)?.arrangingStage || null;
  const packagingStatuses = ['SENT_FOR_PACKAGING', 'UNDER_PACKAGING', 'PACKAGING_COMPLETED', 'IN_TRANSIT'];
  const isPackagingPhase = packagingStatuses.includes(currentStatus);

  useEffect(() => {
    if (!isPackagingPhase && selectedStatus) {
      setSelectedStatus('');
    }
  }, [isPackagingPhase, selectedStatus]);

  useEffect(() => {
    if (isPackagingPhase) {
      setNextArrangingStage({ key: null, label: null });
    }
  }, [isPackagingPhase]);

  // Handler for updating arranging stage (called by child component)
  // Note: do not call hooks here. Reuse token above.
  const handleArrangingStageUpdate = async (stage: string) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    setIsArrangingLoading(true);

    try {
      // Enforce required media on certain arranging stages
      if (['ARRANGED', 'SENT_FOR_PACKAGING'].includes(stage) && (!arrangingFiles || arrangingFiles.length === 0)) {
        alert('Please attach at least one photo/video when moving to this arranging stage.');
        setIsArrangingLoading(false);
        return;
      }
      let resp;
      if (arrangingFiles && arrangingFiles.length > 0) {
        const fd = new FormData();
        fd.append('arrangingStage', stage as string);
        arrangingFiles.forEach(f => fd.append('files', f));

        resp = await fetch(`${API_BASE}/api/orders/arranging-stage/${order.id}`, {
          method: 'PUT',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: fd
        });
      } else {
        resp = await fetch(`${API_BASE}/api/orders/arranging-stage/${order.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ arrangingStage: stage })
        });
      }

      const body = await resp.json().catch(() => null);

      if (!resp.ok) {
        // server validation errors are usually in body.message or body.errors
        const message = body?.message || (body?.errors ? body.errors.join(', ') : `Request failed with status ${resp.status}`);
        throw new Error(message);
      }

      // backend returns updated order in body.data
      const updatedOrder = body?.data;
      // If backend returned a new order.status, use it to preselect/reflect status in modal
      if (updatedOrder?.status) {
        setCurrentStatus(updatedOrder.status);
        setSelectedStatus(updatedOrder.status);
      }

      // optionally refresh parent
      if (onRefresh) {
        await onRefresh();
      }

      // Close modal after stage update to meet UX requirement
      onClose();

      // revoke previews
      arrangingPreviews.forEach(url => URL.revokeObjectURL(url));
      setArrangingFiles([]);
      setArrangingPreviews([]);

      return updatedOrder;
    } catch (err: any) {
      // bubble up so ArrangingOrderComponent can show the error if it wants
      const msg = err?.message || String(err);
      // simple UI alert — you can replace with a toast
      alert(`Arranging update failed: ${msg}`);
      throw err;
    } finally {
      setIsArrangingLoading(false);
    }
  };

  // Handler for updating the order status (calls parent prop)
  const handleUpdateStatus = async () => {
    if (!selectedStatus) {
      alert('Please select a status to update.');
      return;
    }

    if (selectedStatus === 'IN_TRANSIT' && (!trackingId || !trackingLink)) {
      alert('Please provide tracking ID and tracking link for IN_TRANSIT status.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trackingDetails = selectedStatus === 'IN_TRANSIT' ? { trackingId, trackingLink } : undefined;

      // For certain statuses require files
      if (['UNDER_PACKAGING', 'PACKAGING_COMPLETED', 'IN_TRANSIT'].includes(selectedStatus) && (!statusFiles || statusFiles.length === 0)) {
        alert('Please attach at least one photo/video before updating to this status.');
        setIsSubmitting(false);
        return;
      }

      // If there are files to upload, send as FormData
      if (statusFiles && statusFiles.length > 0) {
        const fd = new FormData();
        fd.append('newStatus', selectedStatus);
        if (trackingDetails) {
          fd.append('trackingDetails[trackingId]', trackingDetails.trackingId || '');
          fd.append('trackingDetails[trackingLink]', trackingDetails.trackingLink || '');
        }
          if (selectedStatus === 'IN_TRANSIT' && expectedDeliveryTime) {
            fd.append('expectedDeliveryTime', expectedDeliveryTime);
          }

        statusFiles.forEach(f => fd.append('files', f));
        await onUpdateStatus(order.id, fd as unknown as any);
      } else {
        const td = selectedStatus === 'IN_TRANSIT' ? { ...(trackingDetails || {}), expectedDeliveryTime: expectedDeliveryTime || undefined } : trackingDetails;
        await onUpdateStatus(order.id, selectedStatus, td);
      }

      // optional: refresh parent list after success
      if (onRefresh) await onRefresh();

      // close the modal after success
      onClose();
    } catch (err) {
      console.error('Status update error:', err);
      const message = (err as any)?.message || 'Failed to update status';
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center p-6">
      <div className="relative my-8 w-full max-w-5xl shadow-2xl rounded-xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-6 py-4 text-white">
          <div>
            <h3 className="text-xl font-semibold">Update Order Status</h3>
            <p className="mt-1 text-sm opacity-90">{order.orderNumber}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-white/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* Left: details */}
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold text-black">Destination</h4>
              <p className="text-sm text-gray-600">{order.branch.name}</p>
              {order.branch.address && <p className="text-sm text-gray-600">{order.branch.address}</p>}
              {order.branch.city && order.branch.state && (
                <p className="text-sm text-gray-600">{order.branch.city}, {order.branch.state}</p>
              )}
            </div>

            <div className="rounded-lg border p-4 bg-orange-50">
              <h4 className="font-semibold text-orange-400">Status Update Guide</h4>
              <ul className="mt-2 space-y-1 text-sm text-orange-400">
                <li>📦 <strong>Under Packaging</strong> — Order is being prepared.</li>
                <li>✅ <strong>Packaging Completed</strong> — Ready for dispatch.</li>
                <li>🚚 <strong>In Transit</strong> — On the way to destination.</li>
              </ul>
            </div>
          </div>

          {/* Right: arranging + status controls */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-black">Select New Status</h4>

            {/* Arranging sub-component */}
            {!isPackagingPhase && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Arranging Stage</p>

                {['ADMIN', 'MANAGER'].includes(userRole || '') ? (
                  <ArrangingOrderComponent
                    orderId={order.id}
                    orderStatus={currentStatus}
                    arrangingStage={currentArrangingStage as any}
                    onNextStageChange={(info) => setNextArrangingStage(info)}
                  />
                ) : (
                  <div className="text-sm text-gray-500">Arranging controls are visible to Managers and Admins only.</div>
                )}

                {isArrangingLoading && (
                  <div className="mt-3 text-sm text-gray-600">Updating arranging stage...</div>
                )}
                {/* Arranging media uploader (required for ARRANGED/SENT_FOR_PACKAGING) */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Photos / Videos (optional here)</label>
                  <input type="file" accept="image/*,video/*" multiple onChange={(e) => {
                    const selected = e.target.files ? Array.from(e.target.files) : [];
                    setArrangingFiles(selected);
                    setArrangingPreviews(selected.map(f => URL.createObjectURL(f)));
                  }} className="mt-2" />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {arrangingPreviews.map((p, idx) => (
                      <div key={idx} className="w-24 h-24 overflow-hidden rounded-md border">
                        {p.endsWith('.mp4') || p.endsWith('.mov') ? (
                          <video src={p} className="w-full h-full object-cover" />
                        ) : (
                          <img src={p} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Status radio options depending on current order.status and userRole */}
            {isPackagingPhase ? (
            <div className="rounded-lg border p-4 space-y-3">
              {/* SENT_FOR_PACKAGING -> UNDER_PACKAGING */}
              {currentStatus === 'SENT_FOR_PACKAGING' && ['PACKAGER', 'MANAGER', 'ADMIN'].includes(userRole || '') && (
                <label className={`flex items-center gap-3 p-3 rounded-md border ${selectedStatus === 'UNDER_PACKAGING' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="status"
                    value="UNDER_PACKAGING"
                    checked={selectedStatus === 'UNDER_PACKAGING'}
                    onChange={() => setSelectedStatus('UNDER_PACKAGING')}
                  />
                  <div>
                    <div className="font-medium text-black">📦 Under Packaging</div>
                    <div className="text-xs text-gray-500">Order is being prepared</div>
                  </div>
                </label>
              )}

              {/* UNDER_PACKAGING -> PACKAGING_COMPLETED */}
              {currentStatus === 'UNDER_PACKAGING' && ['PACKAGER', 'MANAGER', 'ADMIN'].includes(userRole || '') && (
                <label className={`flex items-center gap-3 p-3 rounded-md border ${selectedStatus === 'PACKAGING_COMPLETED' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="status"
                    value="PACKAGING_COMPLETED"
                    checked={selectedStatus === 'PACKAGING_COMPLETED'}
                    onChange={() => setSelectedStatus('PACKAGING_COMPLETED')}
                  />
                  <div>
                    <div className="font-medium text-black">✅ Packaging Completed</div>
                    <div className="text-xs text-gray-500">Ready for dispatch</div>
                  </div>
                </label>
              )}

              {/* PACKAGING_COMPLETED -> IN_TRANSIT */}
              {currentStatus === 'PACKAGING_COMPLETED' && ['DISPATCHER', 'MANAGER', 'ADMIN'].includes(userRole || '') && (
                <label className={`flex items-center gap-3 p-3 rounded-md border ${selectedStatus === 'IN_TRANSIT' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="status"
                    value="IN_TRANSIT"
                    checked={selectedStatus === 'IN_TRANSIT'}
                    onChange={() => setSelectedStatus('IN_TRANSIT')}
                  />
                  <div>
                    <div className="font-medium text-black">🚚 In Transit</div>
                    <div className="text-xs text-gray-500">On its way to destination</div>
                  </div>
                </label>
              )}

              {/* If IN_TRANSIT is selected show tracking fields */}
              {selectedStatus === 'IN_TRANSIT' && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm text-black font-medium mb-1">Tracking ID <span className="text-red-500">*</span></label>
                    <input
                      className="w-full rounded-md border text-gray-800 px-3 py-2"
                      placeholder="Enter tracking ID"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-black font-medium mb-1">Tracking Link <span className="text-red-500">*</span></label>
                    <input
                      type="url"
                      className="w-full rounded-md border text-gray-800 px-3 py-2"
                      placeholder="https://tracking-url.com/..."
                      value={trackingLink}
                      onChange={(e) => setTrackingLink(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-black font-medium mb-1">Expected Delivery Time</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border text-gray-800 px-3 py-2"
                      value={expectedDeliveryTime}
                      onChange={(e) => setExpectedDeliveryTime(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional — local time</p>
                  </div>
                </div>
              )}

              {(selectedStatus === 'UNDER_PACKAGING' || selectedStatus === 'PACKAGING_COMPLETED' || selectedStatus === 'IN_TRANSIT') && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Photos / Videos (required)</label>
                  <input type="file" accept="image/*,video/*" multiple onChange={(e) => {
                    const selected = e.target.files ? Array.from(e.target.files) : [];
                    setStatusFiles(selected);
                    setStatusPreviews(selected.map(f => URL.createObjectURL(f)));
                  }} className="mt-2" />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {statusPreviews.map((p, idx) => (
                      <div key={idx} className="w-24 h-24 overflow-hidden rounded-md border">
                        {p.endsWith('.mp4') || p.endsWith('.mov') ? (
                          <video src={p} className="w-full h-full object-cover" />
                        ) : (
                          <img src={p} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-xl bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-600"
            disabled={isSubmitting || isArrangingLoading}
          >
            Cancel
          </button>

          {!isPackagingPhase && ['ADMIN', 'MANAGER'].includes(userRole || '') && nextArrangingStage.key && (
            <button
              onClick={() => nextArrangingStage.key && handleArrangingStageUpdate(nextArrangingStage.key)}
              disabled={isArrangingLoading}
              className="rounded-md bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isArrangingLoading ? 'Updating...' : `Mark as ${nextArrangingStage.label}`}
            </button>
          )}

          {isPackagingPhase && (
            <button
              onClick={handleUpdateStatus}
              disabled={isSubmitting || selectedStatus === ''}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
