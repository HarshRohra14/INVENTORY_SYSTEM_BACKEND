'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

interface IssueThreadProps {
  orderId: string;
  orderItems: {
    id: string;
    sku?: string;
    qtyRequested: number;
  }[];
}

export default function IssueThread({ orderId, orderItems }: IssueThreadProps) {
  const { token } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // ✅ Fetch issue messages
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/issues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setIssues(data.data);
        }
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, [orderId, token]);

  // ✅ Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [issues]);

  if (loading) return <p className="text-sm text-gray-500">Loading conversation...</p>;

  // ✅ Group messages per item
  const grouped = issues.reduce((acc, issue) => {
    const key = issue.itemId || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="mt-4">
      {Object.entries(grouped).map(([itemId, itemMessages]) => {
        const itemInfo = orderItems.find((i) => i.id === itemId);
        return (
          <div
            key={itemId}
            className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1">
              🧾 {itemInfo?.sku || 'General Discussion'}
            </h4>

            {/* Chat Thread */}
            <div className="space-y-3 max-h-72 overflow-y-auto px-2">
              {itemMessages.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No messages yet.</p>
              ) : (
                itemMessages.map((msg) => {
                  const isManager =
                    msg.senderRole === 'MANAGER' || msg.senderRole === 'ADMIN';
                  const isBranch = msg.senderRole === 'BRANCH_USER';

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`px-4 py-2 rounded-2xl text-sm max-w-xs shadow-sm ${
                          isManager
                            ? 'bg-blue-100 text-blue-900 rounded-br-none'
                            : isBranch
                            ? 'bg-red-100 text-red-900 rounded-bl-none'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="font-medium mb-0.5">
                          {isManager
                            ? 'Manager:'
                            : isBranch
                            ? 'Branch:'
                            : msg.senderRole}
                        </p>
                        <p>{msg.message}</p>
                        <span className="block text-[10px] text-gray-500 mt-1 text-right">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
