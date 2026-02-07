'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardPageComponent from './DashboardPage';
import ItemListPage from './ItemListPage';

export default function DashboardPage() {
  const { user } = useAuth();

  // For MANAGER role: Show branch management dashboard
  if (user?.role === 'MANAGER') {
    return <DashboardPageComponent />;
  }

  // For BRANCH_USER and ADMIN: Show item list page
  if (user?.role === 'BRANCH_USER') {
    return <ItemListPage />;
  }

  // Fallback
  return (
    <div className="text-center py-12">
      <div className="text-gray-500">Unauthorized access</div>
    </div>
  );
}
