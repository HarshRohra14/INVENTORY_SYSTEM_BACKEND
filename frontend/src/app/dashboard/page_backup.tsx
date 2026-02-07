'use client';

import React, { useState, useEffect } from 'react';
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
  const fetchManagerBranches = async () => {
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
  };

  useEffect(() => {
    if (token && user?.role === 'MANAGER') {
      fetchManagerBranches();
    } else {
      setIsLoading(false);
    }
  }, [token, user]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For MANAGER role: Show branches they manage
  if (user?.role === 'MANAGER') {
  return (
    <div className="space-y-6">
      {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Branches</h1>
          <p className="mt-1 text-sm text-gray-500">
            Branches you are managing
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Branches Grid */}
        {branches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-500">
              {error || 'No branches assigned to you'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <div key={branch.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      {branch.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Active
                    </span>
                          </div>
                  
                  <div className="mt-4 space-y-2 text-sm text-gray-500">
                    <div className="flex items-start">
                      <svg className="mt-1 h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{branch.address}</span>
                          </div>
                    <div className="flex items-start">
                      <svg className="mt-1 h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 7 3 7h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      <span>{branch.city}, {branch.state} {branch.zipCode}</span>
                        </div>
                    {branch.phone && (
                      <div className="flex items-start">
                        <svg className="mt-1 h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{branch.phone}</span>
                        </div>
                    )}
                    {branch.email && (
                      <div className="flex items-start">
                        <svg className="mt-1 h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{branch.email}</span>
          </div>
        )}
      </div>

                  {/* View Orders Button */}
                  <div className="mt-6">
                    <Link
                      href={`/dashboard/manage-orders?branchId=${branch.id}`}
                      className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Manage Orders
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
    <div className="text-center py-12">
      <div className="text-gray-500">Unauthorized access</div>
    </div>
  );
}
