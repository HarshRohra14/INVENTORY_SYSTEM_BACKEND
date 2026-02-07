'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../context/AuthContext';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import AttachmentViewer from "../../../components/AttachmentViewer";
import ManagerReplyConfirmationModal from '../../../../components/ManagerReplyConfirmationModal';
import OrderTimeline from "../../../../components/OrderTimeline";
import { User, Clock, MessageSquare } from 'lucide-react';

// Types matching your backend API
interface OrderItem {
  id: string;
  sku: string;
  qtyRequested: number;
  qtyApproved: number | null;
  qtyReceived: number | null;
  unitPrice: string | null;
  totalPrice: string | null;
}

interface ItemDetail {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
}

interface Tracking {
  id: string;
  trackingId: string | null;
  courierName: string | null;
  courierLink: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  notes: string | null;
}


interface Order {
  id: string;
  orderNumber: string;
  status: string;
  remarks: string | null;
  managerReply: string | null;
  totalItems: number;
  totalValue: string | null;

  requestedAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;

  arrangingStartedAt?: string | null;
  arrangingCompletedAt?: string | null;
  sentForPackagingAt?: string | null;
  packagingStartedAt?: string | null;
  packagingCompletedAt?: string | null;

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
  tracking: Tracking | null;

  // ✅ FIX: Add this
  orderIssues: {
    id: string;
    message: string;
    senderRole: string;
    createdAt: string;
    repliedBy?: string | null;
    repliedAt?: string | null;
    itemId?: string | null;
  }[];
}


interface OrderDetailResponse {
  success: boolean;
  data: Order;
  message?: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemsData, setItemsData] = useState<{ [sku: string]: ItemDetail }>({});
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showManagerReplyModal, setShowManagerReplyModal] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openItemChatId, setOpenItemChatId] = useState<string | null>(null);

  // Fetch all item details for SKUs in parallel
  const fetchItemsDetails = async (skus: string[]) => {
    const uniqueSkus = Array.from(new Set(skus));
    const results = await Promise.all(
      uniqueSkus.map(async (sku) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/products/by-sku/${sku}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) return null;
          const json = await res.json();
          return { sku, detail: json.data };
        } catch (err) {
          return null;
        }
      })
    );
    const skuMap: { [sku: string]: ItemDetail } = {};
    results.forEach((result) => {
      if (result && result.detail) {
        skuMap[result.sku] = result.detail;
      }
    });
    setItemsData(skuMap);
  };

  // Fetch order and its items' details
  const fetchOrderDetails = async () => {
    if (!token || !params.id) return;
    try {
      setIsLoading(true);
      setIsRefreshing(true);
      setError('');
      const orderId = params.id as string;
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data: OrderDetailResponse = await response.json();
      if (data.success) {
        setOrder(data.data);
        const skus = data.data.orderItems.map(oi => oi.sku);
        await fetchItemsDetails(skus);
      } else {
        setError(data.message || 'Failed to fetch order details');
      }
    } catch (err) {
      setError('An error occurred while fetching order details');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token && params.id) {
      fetchOrderDetails();
    }
  }, [token, params.id, API_BASE_URL]);

  // Order Actions
  const handleConfirmOrder = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/confirm/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('Order confirmed successfully!');
        setShowConfirmationModal(false);
        await fetchOrderDetails();
      } else {
        alert(`Error confirming order: ${data.message}`);
      }
    } catch (err) {
      alert('Error confirming order');
    }
  };

  const handleRaiseIssue = async (orderId: string, issueReason: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/raise-issue/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueReason }),
      });
      const data = await response.json();
      if (data.success) {
        alert('Issue raised successfully! The order has been sent back to the manager for re-evaluation.');
        setShowConfirmationModal(false);
        await fetchOrderDetails();
      } else {
        alert(`Error raising issue: ${data.message}`);
      }
    } catch (err) {
      alert('Error raising issue');
    }
  };

  const handleConfirmManagerReply = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/confirm-manager-reply/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('Manager reply confirmed successfully! The order is now approved.');
        await fetchOrderDetails();
      } else {
        alert(`Error confirming manager reply: ${data.message}`);
      }
    } catch (err) {
      alert('Error confirming manager reply');
    }
  };

  const handleConfirmOrderReceived = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/confirm-received/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('Order received confirmed successfully!');
        await fetchOrderDetails();
      } else {
        alert(`Error confirming order received: ${data.message}`);
      }
    } catch (err) {
      alert('Error confirming order received');
    }
  };

  // Status badge for order status
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
      'UNDER_REVIEW': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      'CONFIRM_PENDING': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'APPROVED_ORDER': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      'RAISED_ISSUE': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
      'WAITING_FOR_MANAGER_REPLY': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
      'MANAGER_REPLIED': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
      'UNDER_PACKAGING': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
      'IN_TRANSIT': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
      'CONFIRM_ORDER_RECEIVED': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      'CLOSED_ORDER': { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
    };

    return statusConfig[status] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };
  };

  // Format status text
  const formatStatusText = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Date formatter and price helpers
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toNumber = (val: string | null | number): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  };

  // LOADING/ERROR STATES
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-orange-600 border-r-indigo-600"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
        <Link 
          href="/dashboard/orders" 
          className="inline-flex items-center text-orange-600 hover:text-orange-900 font-medium transition-colors"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </Link>
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-red-800">Error Loading Order</h3>
              <p className="mt-1 text-red-700">{error || 'Order not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusBadge(order.status);
  // Group order issues by itemId for quick lookup
  const issuesByItem: Record<string, any[]> = {};
  order.orderIssues.forEach((issue) => {
    const itemId = issue.itemId;
    if (!itemId) return;
    if (!issuesByItem[itemId]) issuesByItem[itemId] = [];
    issuesByItem[itemId].push(issue);
  });

  // MAIN PAGE CONTENT
  return (
    <div className="space-y-1 p-1 bg-gray-50 min-h-screen">
      {/* Header - Updated without gradient background */}
      <div className="p-1">
        <Link 
          href="/dashboard/orders" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium mb-6 transition-colors"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
</div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-orange-400 via-amber-400 to-yellow-400 bg-clip-text ">
                Order Details
              </h1>
              <p className="mt-1 text-lg text-gray-600">Order #{order.orderNumber}</p>
              <div className="mt-3 flex items-center space-x-4">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {order.requester.firstName} {order.requester.lastName}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {order.branch.name}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchOrderDetails}
              disabled={isRefreshing}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all duration-200 disabled:opacity-50"
              title="Refresh order details"
            >
              {isRefreshing ? (
                <div className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full"></div>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${statusStyle.bg} ${statusStyle.text} border-2 border-${statusStyle.text.replace('text-', '')}/30 shadow-md`}>
              <span className={`h-2 w-2 rounded-full ${statusStyle.dot} mr-2 animate-pulse`}></span>
              {formatStatusText(order.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
          </div>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-5 border border-orange-100">
            <div className="flex items-start">
              <div className="text-orange-400 via-amber-400 to-yellow-400 rounded-lg p-2 mr-3">
                <svg className="h-5 w-5 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Branch Information</h3>
                <p className="text-base font-semibold text-gray-900">{order.branch.name}</p>
                <p className="text-sm text-gray-600 mt-1">{order.branch.address}</p>
                <p className="text-sm text-gray-600">{order.branch.city}, {order.branch.state}</p>
              </div>
            </div>
          </div>


{/* ================== FULL DETAILED ORDER TIMELINE ================== */}
<div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mt-6">
  <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-200">
    <div className="flex items-center">
      <svg className="h-6 w-6 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h2 className="text-lg font-bold text-gray-900">Order Timeline</h2>
    </div>
  </div>

  <div className="px-6 py-6">
    {/** 🔥 MERGED TIMELINE EVENTS (STATUS + ISSUE EVENTS) */}
{(() => {
  // Group issue events by createdAt timestamp (rounded to minute)

    // 🔥 Build issue cycles to prevent duplicates
const issueCycles: { type: string; date: string }[] = [];
let lastType: string | null = null;

order.orderIssues
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  .forEach(issue => {
    const currentType = issue.senderRole === "BRANCH_USER" ? "ISSUE_RAISED" : "ISSUE_REPLIED";

    if (currentType !== lastType) {
      issueCycles.push({
        type: currentType,
        date: issue.createdAt
      });
      lastType = currentType;
    }
  });



  const timelineEvents = [
    // Status timeline events
    { label: "Order Requested", date: order.requestedAt, type: "STATUS" },
    { label: "Order Approved", date: order.approvedAt, type: "STATUS" },
    { label: "Arranging Started", date: order.arrangingStartedAt, type: "STATUS" },
    { label: "Arranged", date: order.arrangingCompletedAt, type: "STATUS" },
    { label: "Sent for Packaging", date: order.sentForPackagingAt, type: "STATUS" },
    { label: "Packaging Started", date: order.packagingStartedAt, type: "STATUS" },
    { label: "Packaging Completed", date: order.packagingCompletedAt, type: "STATUS" },
    { label: "Dispatched", date: order.dispatchedAt, type: "STATUS" },
    { label: "Order Received", date: order.receivedAt, type: "STATUS" },
    { label: "Order Closed", date: order.closedAt, type: "STATUS" },

    // 🔥 Inject grouped issue timeline events
    ...issueCycles.map(ev => ({
  label: ev.type === "ISSUE_RAISED" ? "Issue Raised" : "Manager Replied",
  date: ev.date,
  type: ev.type
})),

  ]
    .filter(e => e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return timelineEvents.map((event, idx) => (
    <div key={idx} className="relative">
      <span
        className={`absolute -left-3 top-1 w-6 h-6 rounded-full border-4 ${
          event.type === "ISSUE_RAISED"
            ? "bg-red-500 border-red-200"
            : event.type === "ISSUE_REPLIED"
            ? "bg-indigo-500 border-indigo-200"
            : "bg-orange-500 border-orange-200"
        }`}
      ></span>

      <div
        className={`p-4 rounded-lg shadow border ${
          event.type === "ISSUE_RAISED"
            ? "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
            : event.type === "ISSUE_REPLIED"
            ? "bg-gradient-to-r from-indigo-50 to-sky-50 border-indigo-200"
            : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
        }`}
      >
        <h3 className="text-sm font-semibold text-gray-900">{event.label}</h3>
        <p className="text-xs text-gray-600 mt-1">
          {new Date(event.date).toLocaleString()}
        </p>
      </div>
    </div>
  ));
})()}

  </div>
</div>
{/* ================== END TIMELINE ================== */}


          
          
        </div>
      </div>

      {/* Tracking Info */}
      {order.tracking && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Tracking Information</h2>
            </div>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {order.tracking.trackingId && (
                <div className="bg-gradient-to-br from-sky-50 to-orange-50 rounded-lg p-4 border border-sky-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Tracking ID
                  </h3>
                  <p className="text-base font-mono font-semibold text-gray-900">{order.tracking.trackingId}</p>
                </div>
              )}
              {order.tracking.courierName && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-4 border border-emerald-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    Courier Service
                  </h3>
                  <p className="text-base font-semibold text-gray-900">{order.tracking.courierName}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {order.tracking.estimatedDelivery && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Estimated Delivery
                  </h3>
                  <p className="text-base font-semibold text-gray-900">{formatDate(order.tracking.estimatedDelivery)}</p>
                </div>
              )}
              {order.tracking.courierLink && (
                <a 
                  href={order.tracking.courierLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-orange-400 via-amber-400 to-yellow-400 text-white rounded-lg p-4 hover:shadow-lg transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Track Your Package</span>
                    <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Order Items */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="text-orange-400 via-amber-400 to-yellow-400 text-orange-800 px-4 py-2 rounded-full text-sm font-semibold border border-orange-200">
              {order.totalItems} Items
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Approved
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.orderItems.map((orderItem) => {
                const itemDetail = itemsData[orderItem.sku];
                const unitPrice = toNumber(orderItem.unitPrice);
                const totalPrice = toNumber(orderItem.totalPrice);
                const itemIssues = issuesByItem[orderItem.id] || [];
                const hasConversation = itemIssues.length > 0;
                return (
                  <React.Fragment key={orderItem.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 text-orange-400 via-amber-400 to-yellow-400 rounded-lg flex items-center justify-center mr-3">
                            <svg className="h-4 w-4 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {itemDetail ? itemDetail.name : (
                              <span className="text-gray-400 animate-pulse">Loading...</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {orderItem.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {itemDetail ? itemDetail.category : '...'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {itemDetail ? itemDetail.unit : '...'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          {orderItem.qtyRequested}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {orderItem.qtyApproved ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            {orderItem.qtyApproved}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Pending</span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${unitPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        ${totalPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasConversation && (
                          <button
                            onClick={() => setOpenItemChatId(openItemChatId === orderItem.id ? null : orderItem.id)}
                            className="inline-flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-200 transition-all shadow-sm hover:shadow"
                          >
                            {openItemChatId === orderItem.id ? 'Hide Reply' : 'View Reply'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Chat row for this item (only one open at a time) */}
                    {openItemChatId === orderItem.id && hasConversation && (
                      <tr>
                        <td colSpan={10} className="px-6 py-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-sm font-bold text-indigo-900 mb-3">
                                Conversation for "{itemDetail ? itemDetail.name : orderItem.sku}"
                              </label>
                              <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-inner max-h-96 overflow-y-auto space-y-3">
                                {itemIssues.map((msg: any) => {
                                  const isManager = msg.senderRole === 'MANAGER' || msg.senderRole === 'ADMIN';
                                  const isBranch = msg.senderRole === 'BRANCH_USER';
                                  return (
                                    <div key={msg.id} className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`px-4 py-3 rounded-2xl text-sm max-w-md shadow-md ${
                                        isManager
                                          ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-br-sm'
                                          : isBranch
                                          ? 'bg-gradient-to-br from-red-500 to-rose-500 text-white rounded-bl-sm'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
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
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end items-center space-x-8">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{order.totalItems}</p>
            </div>
            {order.totalValue && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-green-400 via-green-500 to-green-600 bg-clip-text text-transparent">
                  ${toNumber(order.totalValue).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Attachments & Documents</h2>
          </div>
        </div>
        <div className="px-6 py-6 space-y-6">
          {/* Arranging Stage Attachments */}
          <AttachmentViewer 
            attachments={order.arrangingMedia || []} 
            title="Arranging Stage" 
            stage="arranging" 
          />
          
          {/* Packaging Stage Attachments */}
          <AttachmentViewer 
            attachments={order.packagingMedia || []} 
            title="Packaging Stage" 
            stage="packaging" 
          />
          
          {/* Transit Stage Attachments */}
          <AttachmentViewer 
            attachments={order.transitMedia || []} 
            title="Transit Stage" 
            stage="transit" 
          />
          
          {/* Show message if no attachments */}
          {(!order.arrangingMedia?.length && !order.packagingMedia?.length && !order.transitMedia?.length) && (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No attachments uploaded yet</p>
              <p className="text-xs text-gray-400">Attachments will appear here as managers upload them during different stages</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {(order.status === 'CONFIRM_PENDING' || order.status === 'MANAGER_REPLIED' || order.status === 'IN_TRANSIT') && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Available Actions</h2>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {order.status === 'CONFIRM_PENDING' && 'Please review and confirm your order details'}
                {order.status === 'MANAGER_REPLIED' && 'Manager has responded to your query'}
                {order.status === 'IN_TRANSIT' && 'Confirm once you receive your order'}
              </p>
              <div className="flex space-x-3">
                {order.status === 'CONFIRM_PENDING' && (
                  <button
                    onClick={() => setShowConfirmationModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirm Order
                  </button>
                )}
                {order.status === 'MANAGER_REPLIED' && (
                  <button
                    onClick={() => setShowManagerReplyModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    View Manager Reply
                  </button>
                )}
                {order.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleConfirmOrderReceived(order.id)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg font-medium hover:from-sky-700 hover:to-sky-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Received
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <ConfirmationModal
          order={order}
          onConfirm={handleConfirmOrder}
          onRaiseIssue={handleRaiseIssue}
          onClose={() => setShowConfirmationModal(false)}
        />
      )}

      {/* Manager Reply Modal */}
      {showManagerReplyModal && (
        <ManagerReplyConfirmationModal
          order={order}
          onConfirm={handleConfirmManagerReply}
          onRaiseIssue={handleRaiseIssue}
          onClose={() => setShowManagerReplyModal(false)}
        />
      )}
    </div>
  );
}