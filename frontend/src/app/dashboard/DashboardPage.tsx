'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import ItemListPage from './ItemListPage';

// Types
interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  email: string | null;
}

interface BranchesResponse {
  success: boolean;
  data: Branch[];
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Fetch branches for manager
  const fetchManagerBranches = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/branches/manager`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: BranchesResponse = await response.json();

      if (data.success) {
        setBranches(data.data);
      } else {
        setError('Failed to fetch branches');
      }
    } catch (err) {
      setError('Error fetching branches');
      console.error('Fetch branches error:', err);
    } finally {
      setIsLoading(false);
    }
  },[token]);

  useEffect(() => {
    if (token && user?.role === 'MANAGER') {
      fetchManagerBranches();
    } else {
      setIsLoading(false);
    }
  }, [token, user?.role, fetchManagerBranches]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 mx-auto"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 animate-spin rounded-full h-20 w-20 border-4 border-transparent border-t-orange-600 border-r-indigo-600"></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium text-lg">Loading your branches...</p>
        </div>
      </div>
    );
  }

  // For MANAGER role: Show branches they manage
  if (user?.role === 'MANAGER') {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                Assigned Branches
              </h1>
              <p className="mt-1 text-gray-600">
                Branches you are managing
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-orange-400 shadow-sm">
            <div className="text-center">
              <p className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                {branches.length}
              </p>
              <p className="text-sm text-gray-900">Total Branches</p>
            </div>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-red-800">Error</h3>
                <p className="mt-1 text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Branches Grid */}
        {branches.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md border border-gray-200">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Branches Found</h3>
              <p className="text-gray-500">
                {error || 'No branches have been assigned to you yet. Please contact your administrator.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <div 
                key={branch.id} 
                className="group bg-white overflow-hidden rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all duration-300"
              >
                <div className="p-6">
                  {/* Branch Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                          {branch.name}
                        </h3>
                        <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Branch Details */}
                  <div className="space-y-3 text-sm">
                    {/* Address */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg group-hover:bg-orange-50 transition-colors">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{branch.address}</p>
                        <p className="text-gray-600 mt-1">{branch.city}, {branch.state} {branch.zipCode}</p>
                      </div>
                    </div>

                    {/* Phone */}
                    {branch.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900">{branch.phone}</span>
                      </div>
                    )}

                    {/* Email */}
                    {branch.email && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group-hover:bg-purple-50 transition-colors">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900 truncate">{branch.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Manage Orders Button */}
                  <div className="mt-6">
                    <Link
                      href={`/dashboard/manage-orders?branchId=${branch.id}`}
                      className="group/btn relative block w-full overflow-hidden rounded-xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-4 py-3 text-center text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Manage Orders
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // For BRANCH_USER role: Show item list page
  if (user?.role === 'BRANCH_USER') {
    return <ItemListPage />;
  }

  // For ADMIN role: Show item list page
  if (user?.role === 'ADMIN') {
    return <ItemListPage />;
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-[600px] bg-gray-50">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Unauthorized Access</h3>
        <p className="text-gray-500">You don't have permission to access this page.</p>
      </div>
    </div>
  );
}