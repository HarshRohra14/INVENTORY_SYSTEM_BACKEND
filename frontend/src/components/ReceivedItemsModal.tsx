'use client';

import React, { useState } from 'react';

interface ReceivedItemsModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceivedItemsModal({
  order,
  onClose,
  onSuccess
}: ReceivedItemsModalProps) {

  const [files, setFiles] = useState<File[]>([]);
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    setFiles([...files, ...selectedFiles]); // append
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Submit Received Confirmation
  const handleSubmit = async () => {
    if (!checked) return;

    // Make photo upload mandatory
    if (files.length === 0) {
      alert("Please upload at least one photo or video to confirm receipt of items.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("media", file);
      });

      const response = await fetch(
        `${API_BASE_URL}/api/orders/confirm-received/${order.id}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      alert("Something went wrong.");
      console.error(err);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Confirm Items Received
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Upload photos/videos of the items you received. <span className="text-red-600 font-medium">Photo upload is mandatory to confirm delivery.</span>
        </p>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Upload Images / Videos <span className="text-red-500">*</span>
          </label>

          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm cursor-pointer
              text-gray-700 file:bg-orange-500 file:text-white
              file:px-4 file:py-2 file:rounded-lg file:border-none
              file:hover:bg-orange-600"
          />

          {/* Preview */}
          {files.length > 0 && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-lg"
                >
                  <span className="text-sm text-gray-700 truncate w-44">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkbox */}
        <div className="mt-4 flex items-center space-x-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4 text-orange-500 rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">
            I received & checked all items carefully.
          </label>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end items-center space-x-3">

          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            disabled={!checked || files.length === 0 || isSubmitting}
            onClick={handleSubmit}
            className={`px-4 py-2 rounded-lg text-white font-medium shadow-md 
              ${checked && files.length > 0
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
              }`}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>

        </div>
      </div>
    </div>
  );
}
