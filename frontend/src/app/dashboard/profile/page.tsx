'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  User as UserIcon,
  Mail,
  Shield,
  Building2,
  CalendarDays,
  MapPin,
  ArrowLeft,
  Home,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  // Loading State (UI only)
  if (!user) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200" />
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0 left-0" />
        </div>
        <p className="text-gray-700 mt-4 font-medium">Loading profile...</p>
      </div>
    );
  }

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User';
  const role = (user.role || 'USER') as string;
  const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();

  const roleStyles: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border border-purple-200',
    MANAGER: 'bg-blue-100 text-blue-800 border border-blue-200',
    BRANCH_USER: 'bg-green-100 text-green-800 border border-green-200',
    ACCOUNTS: 'bg-amber-100 text-amber-800 border border-amber-200',
    DISPATCHER: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    PACKAGER: 'bg-pink-100 text-pink-800 border border-pink-200',
  };

  const RoleBadge = () => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${roleStyles[role] || 'bg-gray-100 text-gray-800 border border-gray-200'}`}
      title="User role"
    >
      <Shield className="w-3.5 h-3.5" />
      {role.replace(/_/g, ' ')}
    </span>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Your Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your personal information and view role-specific details.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-white text-orange-500 border border-orange-300 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Hero / Overview */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        {/* Cover */}
        <div className="h-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400" />
        {/* Profile Row */}
        <div className="px-9 pb-9 -mt-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white ring-4 ring-white -mt-0 shadow-md flex items-center justify-center">
                <div className="w-18 h-18 rounded-xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 flex items-center justify-center">
                  {initials ? (
                    <span className="text-xl font-bold text-white ">{initials}</span>
                  ) : (
                    <UserIcon className="w-7 h-7 text-white" />
                  )}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                  <RoleBadge />
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{user.email || 'No email on file'}</span>
                </div>
                {user.phoneNumber ? (
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{user.phoneNumber}</span>
                  </div>
                ) : null}
              </div>
            </div>
            {/* Small chips */}
            <div className="flex flex-wrap items-center gap-2">
              {user?.branch?.name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  <Building2 className="w-4 h-4" />
                  {user.branch.name}
                </span>
              )}
              {user?.createdAt && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                  <CalendarDays className="w-4 h-4" />
                  Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Account</h3>
          </div>
          <div className="px-6 py-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">User ID</span>
              <span className="text-gray-900 font-medium truncate max-w-[65%]">{user.id || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900 font-medium">{role.replace(/_/g, ' ')}</span>
            </div>
            {user?.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Joined</span>
                <span className="text-gray-900 font-medium">
                  {new Date(user.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Organization Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <Home className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Organization</h3>
          </div>
          <div className="px-6 py-5 space-y-3 text-sm">
            {user.branch ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Branch</span>
                  <span className="text-gray-900 font-medium">{user.branch.name || '—'}</span>
                </div>
                {(user.branch.city || user.branch.state) ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Location</span>
                    <span className="text-gray-900 font-medium inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      {user.branch.city || '—'}{user.branch.city && user.branch.state ? ', ' : ''}{user.branch.state || ''}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-gray-600">No branch details available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Role Specific Sections */}
      {role === 'ADMIN' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Admin Capabilities</h3>
          </div>
          <div className="px-6 py-5">
            <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li>Manage orders across all branches</li>
              <li>Broadcast system-wide announcements</li>
              <li>User, branch, and assignment management</li>
            </ul>
          </div>
        </div>
      )}

      {role === 'MANAGER' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Manager Overview</h3>
          </div>
          <div className="px-6 py-5">
            <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li>Review and approve branch orders</li>
              <li>Respond to raised issues and provide feedback</li>
              <li>Oversee packaging and dispatch workflows</li>
            </ul>
          </div>
        </div>
      )}

      {!['ADMIN', 'MANAGER'].includes(role) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Branch User Details</h3>
          </div>
          <div className="px-6 py-5">
            <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li>Create and track orders for your branch</li>
              <li>Receive notifications about order status</li>
              <li>Confirm receipt of dispatched orders</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}