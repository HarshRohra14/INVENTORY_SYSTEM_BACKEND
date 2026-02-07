'use client';

import React, { useState } from 'react';

interface ReceivedIssueModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceivedIssueModal({
  order,
  onClose,
  onSuccess
}: ReceivedIssueModalProps) {

  // per-item reasons and files
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
  const [itemFiles, setItemFiles] = useState<Record<string, File[]>>({});
  const [confirmRaise, setConfirmRaise] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const handleFileChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const arr = Array.from(e.target.files);
    setItemFiles(prev => ({ ...(prev || {}), [itemId]: [...(prev[itemId] || []), ...arr] }));
  };

  const removeItemFile = (itemId: string, idx: number) => {
    setItemFiles(prev => ({ ...(prev || {}), [itemId]: (prev[itemId] || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    if (!confirmRaise) {
      alert("Please confirm you want to raise an issue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();

      // Build issues array for items that have reasons or files
      const issuesPayload: Array<{ itemId: string; reason: string }> = [];
      for (const oi of order.orderItems || []) {
        const itemId = oi.id;
        const reason = itemReasons[itemId]?.trim() || "";
        const filesForItem = itemFiles[itemId] || [];
        if (reason || (filesForItem && filesForItem.length > 0)) {
          issuesPayload.push({ itemId, reason });
        }
      }

      if (issuesPayload.length === 0) {
        alert('Please provide at least one item issue or upload a file for an item.');
        setIsSubmitting(false);
        return;
      }

      fd.append('issues', JSON.stringify(issuesPayload));

      // Append files per-item with fieldname media_<itemId>
      for (const [itemId, filesArr] of Object.entries(itemFiles)) {
        (filesArr || []).forEach((f) => {
          fd.append(`media_${itemId}`, f);
        });
      }

      const resp = await fetch(`${API}/api/orders/report-received-issues/${order.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: fd
      });

      const data = await resp.json();

      if (!resp.ok) {
        alert(data.message || 'Failed to report received issues');
        setIsSubmitting(false);
        return;
      }

      // success
      onSuccess();
      onClose();

    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Raise Issue for Received Items
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-4">Report issues per item and upload images/videos per item.</p>

        {/* Per-item inputs */}
        <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
          {(order.orderItems || []).map((oi: any) => (
            <div key={oi.id} className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{oi.sku || oi.id} — {oi.item?.name || 'Item'}</p>
                  <p className="text-xs text-gray-500">Requested: {oi.qtyRequested}</p>
                </div>
              </div>

              <label className="text-sm text-gray-700">Issue description (optional)</label>
              <textarea
                className="w-full mt-2 border rounded-lg p-2 text-gray-700"
                rows={2}
                value={itemReasons[oi.id] || ''}
                onChange={(e) => setItemReasons(prev => ({ ...prev, [oi.id]: e.target.value }))}
                placeholder="Describe issue for this item"
              />

              <label className="block text-sm font-medium mb-2 mt-2 text-gray-700">Upload media for this item (optional)</label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => handleFileChange(oi.id, e)}
                className="block w-full text-sm cursor-pointer text-gray-700"
              />

              {(itemFiles[oi.id] || []).length > 0 && (
                <div className="mt-2 space-y-2">
                  {(itemFiles[oi.id] || []).map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-1 rounded">
                      <span className="text-sm truncate w-48">{f.name}</span>
                      <button onClick={() => removeItemFile(oi.id, idx)} className="text-red-600 text-sm">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Checkbox */}
        <div className="mt-4 flex items-center space-x-3">
          <input
            type="checkbox"
            checked={confirmRaise}
            onChange={(e) => setConfirmRaise(e.target.checked)}
            className="h-4 w-4 text-orange-500 rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">
            I want to raise an issue for the received items.
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            disabled={!confirmRaise || isSubmitting}
            onClick={handleSubmit}
            className={`px-4 py-2 rounded-lg text-white font-medium shadow-md 
              ${confirmRaise ? "bg-red-600 hover:bg-red-700" : "bg-gray-400 cursor-not-allowed"}`}
          >
            {isSubmitting ? "Submitting..." : "Raise Issue"}
          </button>
        </div>

      </div>
    </div>
  );
}
