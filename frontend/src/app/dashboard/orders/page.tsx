"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ManagerReplyConfirmationModal from "../../../components/ManagerReplyConfirmationModal";
import ReceivedItemsModal from "../../../components/ReceivedItemsModal";
import ReceivedIssueModal from "../../../components/ReceivedIssueModal";

// Types
interface Order {
  id: string;
  orderNumber: string;
  status:
    | "UNDER_REVIEW"
    | "CONFIRM_PENDING"
    | "APPROVED_ORDER"
    | "RAISED_ISSUE"
    | "WAITING_FOR_MANAGER_REPLY"
    | "MANAGER_REPLIED"
    | "UNDER_PACKAGING"
    | "IN_TRANSIT"
    | "CONFIRM_ORDER_RECEIVED"
    | "CLOSED_ORDER";
  remarks: string | null;
  totalItems: number;
  totalValue: string | null;
  requestedAt: string;
  approvedAt: string | null;
  orderItems: {
    id: string;
    qtyRequested: number;
    qtyApproved: number | null;
    item: {
      name: string;
      sku: string;
      category: string;
      unit: string;
    };
  }[];
}

interface OrdersResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      limit: number;
    };
  };
}

// Toast Component
interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: {
      text: "text-green-700",
      border: "border-green-200",
      icon: (
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
      ),
    },
    error: {
      text: "text-red-700",
      border: "border-red-200",
      icon: (
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    info: {
      text: "text-orange-700",
      border: "border-orange-200",
      icon: (
        <svg
          className="w-6 h-6 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const currentStyle = styles[type];

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
      <div
        className={`bg-white ${currentStyle.text} px-6 py-4 rounded-lg shadow-2xl border-2 ${currentStyle.border} flex items-center gap-3 min-w-[320px] max-w-md`}
      >
        <div className="flex-shrink-0">{currentStyle.icon}</div>
        <p className="flex-1 font-medium text-sm">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:bg-gray-100 rounded-full p-1 transition-all"
        >
          <svg
            className={`w-5 h-5 ${currentStyle.text}`}
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
    </div>
  );
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showManagerReplyModal, setShowManagerReplyModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReceivedItemsModal, setShowReceivedItemsModal] = useState(false);
  const [showReceivedIssueModal, setShowReceivedIssueModal] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Toast helper functions
  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, show: false });
  };

  // Fetch user's orders
  useEffect(() => {
    if (authLoading || !token) return;

    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        setError("");
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "10",
        });

        const response = await fetch(
          `${API_BASE_URL}/api/orders/my-orders?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data: OrdersResponse = await response.json();

        if (data.success) {
          setOrders(data.data.orders);
          setTotalPages(data.data.pagination.totalPages);
          setTotalCount(data.data.pagination.totalCount);
        } else {
          setError("Failed to fetch orders.");
        }
      } catch (err) {
        setError("An error occurred while fetching orders.");
        console.error("Fetch orders error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [token, authLoading, currentPage, API_BASE_URL]);

  // Helper to get color-coded status badges
  const getStatusBadge = (status: Order["status"]) => {
    const statusConfig: Record<
      string,
      { bg: string; text: string; dot: string }
    > = {
      UNDER_REVIEW: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        dot: "bg-amber-500",
      },
      CONFIRM_PENDING: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        dot: "bg-orange-500",
      },
      APPROVED_ORDER: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        dot: "bg-blue-500",
      },
      RAISED_ISSUE: {
        bg: "bg-rose-50",
        text: "text-rose-700",
        dot: "bg-rose-500",
      },
      WAITING_FOR_MANAGER_REPLY: {
        bg: "bg-red-50",
        text: "text-red-700",
        dot: "bg-red-500",
      },
      MANAGER_REPLIED: {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        dot: "bg-indigo-500",
      },
      UNDER_PACKAGING: {
        bg: "bg-violet-50",
        text: "text-violet-700",
        dot: "bg-violet-500",
      },
      IN_TRANSIT: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
      CONFIRM_ORDER_RECEIVED: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
      },
      CLOSED_ORDER: {
        bg: "bg-slate-50",
        text: "text-slate-700",
        dot: "bg-slate-500",
      },
    };

    return (
      statusConfig[status] || {
        bg: "bg-gray-50",
        text: "text-gray-700",
        dot: "bg-gray-500",
      }
    );
  };

  // Format status text
  const formatStatusText = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Handle order confirmation
  const handleConfirmOrder = async (orderId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/confirm/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const order = orders.find((o) => o.id === orderId);
        showToast(
          `Order ${order?.orderNumber} confirmed successfully! 🎉`,
          "success"
        );
        setShowConfirmationModal(false);
        setSelectedOrder(null);
        // Refresh orders after a short delay to show toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(`Error confirming order: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error confirming order", "error");
      console.error("Confirm order error:", err);
    }
  };

  // Handle raising an issue
  const handleRaiseIssue = async (
    orderId: string,
    issues: Record<string, string>
  ) => {
    try {
      // Convert issues object to array format expected by API
      // issues is Record<itemId, reason> where itemId is OrderItem.id
      const issuesArray = Object.entries(issues)
        .filter(([itemId, reason]) => reason && reason.trim().length > 0)
        .map(([itemId, reason]) => ({
          itemId: itemId,
          reason: reason.trim(),
        }));

      if (issuesArray.length === 0) {
        showToast("Please add at least one issue before submitting.", "error");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/orders/raise-issue/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ issues: issuesArray }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const order = orders.find((o) => o.id === orderId);
        showToast(
          `Issue raised successfully for order ${order?.orderNumber}! The order has been sent back to the manager for re-evaluation. 📢`,
          "success"
        );
        setShowConfirmationModal(false);
        setSelectedOrder(null);
        // Refresh orders after a short delay to show toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(`Error raising issue: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error raising issue", "error");
      console.error("Raise issue error:", err);
    }
  };

  // Handle confirming manager reply
  const handleConfirmManagerReply = async (orderId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/confirm-manager-reply/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const order = orders.find((o) => o.id === orderId);
        showToast(
          `Manager reply confirmed successfully for order ${order?.orderNumber}! The order is now approved. ✅`,
          "success"
        );
        setShowManagerReplyModal(false);
        setSelectedOrder(null);
        // Refresh orders after a short delay to show toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(`Error confirming manager reply: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error confirming manager reply", "error");
      console.error("Confirm manager reply error:", err);
    }
  };

  // Handle confirming order received
  const handleConfirmOrderReceived = async (orderId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/confirm-received/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const order = orders.find((o) => o.id === orderId);
        showToast(
          `Order ${order?.orderNumber} received confirmed successfully! 📦`,
          "success"
        );
        // Refresh orders after a short delay to show toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(`Error confirming order received: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error confirming order received", "error");
      console.error("Confirm order received error:", err);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-gray-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-border mx-auto"
            style={{
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              padding: "3px",
            }}
          ></div>
          <p className="mt-4 text-gray-600 font-medium">
            Loading your orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      <div className="space-y-1 p-1 bg-gray-50 min-h-screen">
        {/* Header Section */}

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                  My Stock Requests
                </h1>
                <p className="mt-1 text-gray-600 text-base">
                  Track and manage your inventory orders in real-time
                </p>
              </div>
            </div>
          </div>
          {totalCount > 0 && (
            <div className="hidden md:flex items-center space-x-6 bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-400 via-amber-400 to-yellow-400">
                  {totalCount}
                </p>
                <p className="text-sm text-orange-400 via-amber-400 to-yellow-400">
                  Total Orders
                </p>
              </div>
              <div className="h-12 w-px bg-white/20"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-400 via-amber-400 to-yellow-400">
                  {
                    orders.filter(
                      (o) =>
                        o.status === "CONFIRM_PENDING" ||
                        o.status === "MANAGER_REPLIED" ||
                        o.status === "IN_TRANSIT"
                    ).length
                  }
                </p>
                <p className="text-sm text-orange-400 via-amber-400 to-yellow-400">
                  Action Needed
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-4 shadow-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full p-6">
                  <svg
                    className="h-16 w-16 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Orders Yet
              </h3>
              <p className="text-gray-500 mb-6">
                You haven't placed any stock requests yet.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create Your First Order
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Order Details
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => {
                    const statusStyle = getStatusBadge(order.status);
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="flex items-center group"
                          >
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg flex items-center justify-center group-hover:shadow-lg transition-all duration-200">
                              <svg
                                className="h-5 w-5 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                                />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent group-hover:from-yellow-400 group-hover:via-amber-400 group-hover:to-orange-400 transition-all">
                                {order.orderNumber}
                              </div>
                              <div className="text-xs text-gray-500">
                                Click to view details
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <svg
                              className="h-4 w-4 text-gray-400 mr-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            {new Date(order.requestedAt).toLocaleString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              }
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              statusStyle.bg
                            } ${
                              statusStyle.text
                            } border border-${statusStyle.text.replace(
                              "text-",
                              ""
                            )}/20`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-2`}
                            ></span>
                            {formatStatusText(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-gradient-to-r from-orange-100 via-amber-100 to-yellow-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center border border-indigo-200">
                              <svg
                                className="h-3 w-3 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                />
                              </svg>
                              {order.totalItems}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {order.totalValue != null ? (
                              <span className="flex items-center">
                                <svg
                                  className="h-4 w-4 text-green-600 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                ${parseFloat(order.totalValue).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">
                                Not calculated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {order.status === "CONFIRM_PENDING" ? (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowConfirmationModal(true);
                              }}
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg
                                className="h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Confirm Order
                            </button>
                          ) : order.status === "WAITING_FOR_MANAGER_REPLY" ? (
                            <div className="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium border border-orange-200">
                              <svg
                                className="animate-pulse h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Awaiting Reply
                            </div>
                          ) : order.status === "MANAGER_REPLIED" ? (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowManagerReplyModal(true);
                              }}
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white rounded-lg text-sm font-medium hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg
                                className="h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              View Reply
                            </button>
                          ) : order.status === "IN_TRANSIT" ? (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowReceivedItemsModal(true);
                              }}
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg
                                className="h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Confirm Received
                            </button>
                          ) : 
                           order.status === "CONFIRM_ORDER_RECEIVED" ? (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowReceivedIssueModal(true);
                              }}
                              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg
                                className="h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M18.364 5.636l-3.536 3.536m0 0L9.293 16.93a1 1 0 01-1.414 0l-4.95-4.95a1 1 0 010-1.414l11.314-11.314a1 1 0 011.414 0l4.95 4.95a1 1 0 010 1.414z"
                                />
                              </svg>
                              Report Issue
                            </button>
                          ) : 
                          (
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-lg text-sm font-semibold hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                            >
                              <svg
                                className="h-4 w-4 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              View Details
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="bg-white px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{" "}
                        <span className="font-semibold text-gray-900">
                          {(currentPage - 1) * 10 + 1}
                        </span>{" "}
                        -{" "}
                        <span className="font-semibold text-gray-900">
                          {Math.min(currentPage * 10, totalCount)}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-gray-900">
                          {totalCount}
                        </span>{" "}
                        orders
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 rounded-l-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <svg
                            className="h-5 w-5 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Previous
                        </button>
                        <div className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                          Page {currentPage} of {totalPages}
                        </div>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-4 py-2 rounded-r-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          Next
                          <svg
                            className="h-5 w-5 ml-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmationModal && selectedOrder && (
          <ConfirmationModal
            order={selectedOrder}
            onConfirm={handleConfirmOrder}
            onRaiseIssue={handleRaiseIssue}
            onClose={() => {
              setShowConfirmationModal(false);
              setSelectedOrder(null);
            }}
          />
        )}

        {/* Manager Reply Confirmation Modal */}
        {showManagerReplyModal && selectedOrder && (
          <ManagerReplyConfirmationModal
            order={selectedOrder}
            onConfirm={handleConfirmManagerReply}
            onRaiseIssue={handleRaiseIssue}
            onClose={() => {
              setShowManagerReplyModal(false);
              setSelectedOrder(null);
            }}
          />
        )}

        {showReceivedItemsModal && selectedOrder && (
          <ReceivedItemsModal
            order={selectedOrder}
            onClose={() => {
              setShowReceivedItemsModal(false);
              setSelectedOrder(null);
            }}
            onSuccess={() => window.location.reload()}
          />
        )}

        {/* Received Issue Modal */}
{showReceivedIssueModal && selectedOrder && (
  <ReceivedIssueModal
    order={selectedOrder}
    onClose={() => {
      setShowReceivedIssueModal(false);
      setSelectedOrder(null);
    }}
    onSuccess={() => window.location.reload()}
  />
)}

      </div>
    </>
  );
}
