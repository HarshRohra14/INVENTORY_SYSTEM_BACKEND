"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import ApprovalModal from "../../../components/ApprovalModal";
import DispatchModal from "../../../components/DispatchModal";
import StatusUpdateModal from "../../../components/StatusUpdateModal";
import ReplyModal from "../../../components/ReplyModal";
import ManagerReplyModal from "../../../components/ManagerReplyModal";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

// Types
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
  adminReply?: string | null;
  totalItems: number;
  totalValue: number | null;
  requestedAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  arrangingStage?: "ARRANGING" | "ARRANGED" | "SENT_FOR_PACKAGING" | null;
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
    address: string;
    city: string;
    state: string;
  };
  orderItems: OrderItem[];
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

// Branch type
interface Branch {
  id: string;
  name: string;
}

interface BranchesResponse {
  success: boolean;
  data: Branch[];
}

// Toast types
interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

// Toast Component
function ToastNotification({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: {
      textColor: "text-green-600",
      iconColor: "text-green-600",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    error: {
      textColor: "text-red-600",
      iconColor: "text-red-600",
      icon: <AlertCircle className="w-5 h-5" />,
    },
    info: {
      textColor: "text-blue-600",
      iconColor: "text-blue-600",
      icon: <Info className="w-5 h-5" />,
    },
  };

  const style = config[toast.type];

  return (
    <div className="animate-slideIn pointer-events-auto">
      <div className="bg-white/10 backdrop-blur-sm border border-gray-200 rounded-lg shadow-xl px-4 py-5 flex items-center gap-3 min-w-[300px] max-w-[500px]">
        <div className={style.iconColor}>{style.icon}</div>
        <p className={`${style.textColor} text-sm font-medium flex-1`}>
          {toast.message}
        </p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ManageOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 20,
  });

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
   const [showReplyModal, setShowReplyModal] = useState(false);
  const [showManagerReplyModal, setShowManagerReplyModal] = useState(false);
  // Manual close removed (auto-close). Use branch ReceivedItems flow instead.

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { token, user } = useAuth();

  // Toast functions
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Check if user has manager permissions
  useEffect(() => {
    if (
      user &&
      !["MANAGER", "ADMIN", "DISPATCHER", "PACKAGER"].includes(user.role)
    ) {
      setError("Access denied. Manager role required.");
      setIsLoading(false);
    }
  }, [user]);

  // Redirect managers to manage-orders if they try to access other pages
  useEffect(() => {
    if (user?.role === "MANAGER" && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath === "/dashboard" || currentPath === "/dashboard/orders") {
        window.location.href = "/dashboard/manage-orders";
      }
    }
  }, [user]);

  // Fetch branches for manager
  const fetchBranches = async () => {
    try {
      const endpoint =
        user?.role === "ADMIN"
          ? `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
            }/api/admin/branches`
          : `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
            }/api/branches/manager`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: BranchesResponse = await response.json();

      if (data.success) {
        setBranches(data.data);
      }
    } catch (err) {
      console.error("Fetch branches error:", err);
    }
  };

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(selectedBranch && { branchId: selectedBranch }),
        ...(selectedStatus && { status: selectedStatus }),
      });

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/orders/manager/pending?${params}`,
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
        setPagination(data.data.pagination);
      } else {
        setError("Failed to fetch pending orders");
      }
    } catch (err) {
      setError("Error fetching pending orders");
      console.error("Fetch pending orders error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and when page changes
  useEffect(() => {
    if (
      token &&
      user &&
      ["MANAGER", "ADMIN", "PACKAGER", "DISPATCHER"].includes(user.role)
    ) {
      fetchBranches();
    }
  }, [token, user]);

  // Fetch orders when filters or page changes
  useEffect(() => {
    if (
      token &&
      user &&
      ["MANAGER", "ADMIN", "PACKAGER", "DISPATCHER"].includes(user.role)
    ) {
      fetchPendingOrders();
    }
  }, [token, user, currentPage, selectedBranch, selectedStatus]);

  // Handle approval
  const handleApprove = async (
    orderId: string,
    approvedItems: Array<{ sku: string; qtyApproved: number }>
  ) => {
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/orders/approve/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approvedItems }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Order approved successfully!", "success");
        setShowApprovalModal(false);
        setSelectedOrder(null);
        fetchPendingOrders();
      } else {
        showToast(`Failed to approve order: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error approving order", "error");
      console.error("Approve order error:", err);
    }
  };

  // Handle dispatch
  const handleDispatch = async (
    orderId: string,
    dispatchData: { trackingId: string; courierLink: string } | FormData
  ) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/orders/dispatch/${orderId}`;
      let response;
      if ((dispatchData as FormData) instanceof FormData) {
        response = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: dispatchData as FormData
        });
      } else {
        response = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dispatchData),
        });
      }

      const data = await response.json();

      if (data.success) {
        showToast("Order dispatched successfully!", "success");
        setShowDispatchModal(false);
        setSelectedOrder(null);
        fetchPendingOrders();
      } else {
        showToast(`Failed to dispatch order: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error dispatching order", "error");
      console.error("Dispatch order error:", err);
    }
  };

  // Handle status update
  // place this inside ManageOrdersPage (same scope as token, user, showToast, fetchPendingOrders, etc.)
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: string | FormData,
    trackingDetails?: { trackingId?: string; trackingLink?: string }
  ) => {
    try {
      setIsLoading(true); // optional: show global loading while updating
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/orders/update-status/${orderId}`;
      let resp;
      if ((newStatus as FormData) instanceof FormData) {
        resp = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: newStatus as FormData
        });
      } else {
        resp = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newStatus: newStatus as string,
            trackingDetails: trackingDetails || undefined,
          }),
        });
      }

      // try to parse JSON; handle empty body gracefully
      const body = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg =
          body?.message || `Request failed with status ${resp.status}`;
        showToast(`Error updating status: ${msg}`, "error");
        throw new Error(msg);
      }

      if (body?.success) {
        const newStatusStr = typeof newStatus === 'string' ? newStatus : ((newStatus as FormData).get('newStatus') as string) || 'status';
        showToast(
          `Order status updated to ${newStatusStr} successfully!`,
          "success"
        );
        setShowStatusUpdateModal(false);
        setSelectedOrder(null);
        // refresh list
        await fetchPendingOrders();
        return body.data;
      } else {
        const msg = body?.message || "Unknown error";
        showToast(`Error updating status: ${msg}`, "error");
        return body;
      }
    } catch (err: any) {
      console.error("Update status error:", err);
      showToast(
        `Error updating order status: ${err?.message || String(err)}`,
        "error"
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle raising an issue
  const handleReply = async (orderId: string, reply: string) => {
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/orders/raise-issue/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ issueReason: reply }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Issue raised successfully!", "success");
        setShowReplyModal(false);
        setSelectedOrder(null);
        fetchPendingOrders();
      } else {
        showToast(`Error raising issue: ${data.message}`, "error");
      }
    } catch (err) {
      showToast("Error raising issue", "error");
      console.error("Raise issue error:", err);
    }
  };

  // Handle manager reply
  // ✅ Corrected Manager Reply Function
  const handleManagerReply = async (
    orderId: string,
    replies: {
      itemId: string;
      reply: string;
      qtyApproved: number;
      issueIds?: string[];
    }[]
  ) => {
    try {
      console.log(
        "🧩 Sending to backend:",
        JSON.stringify({ replies }, null, 2)
      );

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/orders/reply/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          // ✅ Send directly — no renaming or reformatting
          body: JSON.stringify({ replies }),
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("✅ Backend success:", data);
        showToast("Reply sent successfully!", "success");
        setShowManagerReplyModal(false);
        setSelectedOrder(null);
        fetchPendingOrders(); // refresh updated orders
      } else {
        console.error("❌ Backend validation error:", data);
        showToast(
          `Error sending reply: ${data.errors?.[0] || data.message}`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Network/logic error:", err);
      showToast("Error sending reply", "error");
    }
  };

  // Manual close removed: auto-close runs in background

  // Get status badge color
  const getStatusBadge = (status: string) => {
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
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
      },
      ARRANGING: {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        dot: "bg-yellow-500",
      },
      ARRANGED: { bg: "bg-lime-50", text: "text-lime-700", dot: "bg-lime-500" },
      SENT_FOR_PACKAGING: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        dot: "bg-teal-500",
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
        bg: "bg-blue-50",
        text: "text-blue-700",
        dot: "bg-blue-500",
      },
      UNDER_PACKAGING: {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        dot: "bg-indigo-500",
      },
      PACKAGING_COMPLETED: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        dot: "bg-teal-500",
      },
      IN_TRANSIT: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
      CONFIRM_ORDER_RECEIVED: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        dot: "bg-purple-500",
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

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-orange-400 border-r-amber-400"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 bg-gray-50">
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-500"
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
              <h3 className="text-lg font-semibold text-red-800">
                Access Denied
              </h3>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-gray-50 min-h-screen">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Header Section */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
              Order Management
            </span>
          </h1>
          <p className="mt-2 text-gray-600 text-lg">
            {user?.role === "ADMIN"
              ? "Oversee and manage all branch stock requests"
              : `Manage stock requests for your ${
                  user?.role === "MANAGER" ? "assigned branches" : "department"
                }`}
          </p>
        </div>
        <div className="hidden md:flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4">
          <div className="text-center">
            <p className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
              {pagination.totalCount}
            </p>
            <p className="text-sm bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
              Total Orders
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl shadow-md border border-gray-200">
        <div className="p-3">
          <div className="flex items-center mb-4">
            <svg
              className="h-5 w-5 text-gray-400 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch Filter */}
            <div>
              <label
                htmlFor="branchFilter"
                className="block text-s font-medium text-white mb-2"
              >
                Branch
              </label>
              <select
                id="branchFilter"
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 text-black bg-orange-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-400"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label
                htmlFor="statusFilter"
                className="block text-s font-medium text-white mb-2"
              >
                Order Status
              </label>
              <select
                id="statusFilter"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 text-black bg-orange-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-400"
              >
                <option value="">All Statuses</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="CONFIRM_PENDING">Confirm Pending</option>
                <option value="APPROVED_ORDER">Approved Order</option>
                <option value="ARRANGING">Arranging</option>
                <option value="ARRANGED">Arranged</option>
                <option value="SENT_FOR_PACKAGING">Sent for Packaging</option>
                <option value="RAISED_ISSUE">Raised Issue</option>
                <option value="WAITING_FOR_MANAGER_REPLY">
                  Waiting for Manager Reply
                </option>
                <option value="MANAGER_REPLIED">Manager Replied</option>
                <option value="UNDER_PACKAGING">Under Packaging</option>
                <option value="PACKAGING_COMPLETED">Packaging Completed</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="CONFIRM_ORDER_RECEIVED">
                  Confirm Order Received
                </option>
                <option value="CLOSED_ORDER">Closed Order</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedBranch("");
                  setSelectedStatus("");
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 bg-orange-50 text-black rounded-lg font-medium hover:bg-orange-100 transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm border border-gray-300"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span>Clear Filters</span>
              </button>
            </div>
          </div>

          {(selectedBranch || selectedStatus) && (
            <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Active filters applied</span>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full p-2 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No orders found
            </h3>
            <p className="mt-2 text-gray-500">
              {selectedBranch || selectedStatus
                ? "Try adjusting your filters to see more results"
                : "No pending orders at the moment"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-orange-400 to-amber-400 ">
                <tr>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Branch & Requester
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const statusStyle = getStatusBadge(order.status);
                  // Determine whether the Update Status button should be shown for this user and order status
                  const role = user?.role || "";
                  const canUpdateStatus = (() => {
                    // Admin and Manager can work on arranging + packaging steps
                    if (["MANAGER", "ADMIN"].includes(role)) {
                      return [
                        "APPROVED_ORDER",
                        "ARRANGING", // NEW
                        "ARRANGED", // NEW
                        "SENT_FOR_PACKAGING", // NEW
                        "UNDER_PACKAGING",
                        "PACKAGING_COMPLETED",
                      ].includes(order.status);
                    }

                    // Packager can update packaging-related steps only
                    if (role === "PACKAGER") {
                      return [
                        "SENT_FOR_PACKAGING",
                        "UNDER_PACKAGING",
                        // "PACKAGING_COMPLETED",
                      ].includes(order.status);
                    }
                    // Dispatcher can only move PACKAGING_COMPLETED -> IN_TRANSIT
                    if (role === "DISPATCHER") {
                      return order.status === "PACKAGING_COMPLETED";
                    }
                    return false;
                  })();
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400  rounded-lg flex items-center justify-center">
                            <svg
                              className="h-6 w-6 text-white"
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
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {order.orderNumber}
                            </div>
                            <div className="text-xs text-gray-500">
                              Order ID
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {order.branch.name}
                          </div>
                          <div className="text-gray-500 flex items-center mt-1">
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            {order.requester.firstName}{" "}
                            {order.requester.lastName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(order.requestedAt)}
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
                        {/* Arranging badge removed per request */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {order.totalItems}{" "}
                            {order.totalItems === 1 ? "item" : "items"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          {/* Review & Approve */}
                          {["MANAGER", "ADMIN"].includes(user?.role || "") &&
                            order.status === "UNDER_REVIEW" && (
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowApprovalModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700   text-transparent text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow"
                              >
                                <svg
                                  className="h-4 w-4 mr-1"
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
                                Review & Approve
                              </button>
                            )}

                          {/* Waiting for confirmation */}
                          {order.status === "CONFIRM_PENDING" && (
                            <div className="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium border border-orange-200">
                              <svg
                                className="animate-pulse h-4 w-4 mr-1"
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
                              Awaiting Confirmation
                            </div>
                          )}

                          {/* Update Status */}
                          {canUpdateStatus && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowStatusUpdateModal(true);
                              }}
                              className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-sm hover:shadow"
                            >
                              <svg
                                className="h-4 w-4 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              Update Status
                            </button>
                          )}

                          {/* Manager Reply */}
                          {["MANAGER", "ADMIN"].includes(user?.role || "") &&
                            order.status === "WAITING_FOR_MANAGER_REPLY" && (
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowManagerReplyModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg text-xs font-medium hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-sm hover:shadow"
                              >
                                <svg
                                  className="h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                  />
                                </svg>
                                Reply to Issue
                              </button>
                            )}

                          {/* Manual Close removed — auto-close will handle CONFIRM_ORDER_RECEIVED */}

                          {/* Status indicators */}
                          {order.status === "UNDER_PACKAGING" && (
                            <div className="inline-flex items-center px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium border border-violet-200">
                              <svg
                                className="h-4 w-4 mr-1"
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
                              Under Packaging
                            </div>
                          )}
                          {order.status === "IN_TRANSIT" && (
                            <>
                              {/* Raise Issue Button */}
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowReplyModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg text-xs font-medium hover:from-rose-700 hover:to-rose-800 transition-all duration-200 shadow-sm hover:shadow mr-2"
                              >
                                <svg
                                  className="h-4 w-4 mr-1"
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
                                Raise Issue
                              </button>
                              
                              {/* Status Indicator */}
                              <div className="inline-flex items-center px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg text-xs font-medium border border-sky-200">
                                <svg
                                  className="h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                  />
                                </svg>
                                In Transit
                              </div>
                            </>
                          )}
                          {order.status === "CLOSED_ORDER" && (
                            <div className="inline-flex items-center px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">
                              <svg
                                className="h-4 w-4 mr-1"
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
                              Completed
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!pagination.hasPrevPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(pagination.totalPages, prev + 1)
                  )
                }
                disabled={!pagination.hasNextPage}
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
                    {(pagination.currentPage - 1) * pagination.limit + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-gray-900">
                    {Math.min(
                      pagination.currentPage * pagination.limit,
                      pagination.totalCount
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-900">
                    {pagination.totalCount}
                  </span>{" "}
                  orders
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={!pagination.hasPrevPage}
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
                  <div className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-sm font-medium">
                    <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text to-purple-600 bg-clip-text text-transparent font-semibold">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(pagination.totalPages, prev + 1)
                      )
                    }
                    disabled={!pagination.hasNextPage}
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
      )}

      {/* Modals */}
      {showApprovalModal && selectedOrder && (
        <ApprovalModal
          order={selectedOrder}
          onApprove={handleApprove}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {showDispatchModal && selectedOrder && (
        <DispatchModal
          order={selectedOrder}
          onDispatch={handleDispatch}
          onClose={() => {
            setShowDispatchModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {showStatusUpdateModal && selectedOrder && (
        <StatusUpdateModal
          order={selectedOrder}
          userRole={user?.role}
          onUpdateStatus={handleUpdateStatus}
          onRefresh={fetchPendingOrders}
          onClose={() => {
            setShowStatusUpdateModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {showReplyModal && selectedOrder && (
        <ReplyModal
          order={selectedOrder}
          onReply={handleReply}
          onClose={() => {
            setShowReplyModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {showManagerReplyModal && selectedOrder && (
        <ManagerReplyModal
          order={selectedOrder}
          onSubmitReplies={handleManagerReply}
          onClose={() => {
            setShowManagerReplyModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Manual Close UI removed (auto-close handles closing) */}

      {/* Toast Animation Styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
