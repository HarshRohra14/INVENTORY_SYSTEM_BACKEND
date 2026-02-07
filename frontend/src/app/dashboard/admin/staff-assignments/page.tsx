"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, Shield, Building2, UserCheck, Save, CheckCircle2, Circle, Package, Truck } from 'lucide-react';

interface User { id: string; firstName: string; lastName: string; email: string; }
interface Branch { id: string; name: string; }

export default function AdminStaffAssignmentsPage() {
  const { token, user } = useAuth();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [role, setRole] = useState<'PACKAGER' | 'DISPATCHER'>('DISPATCHER');
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [assignedBranchIds, setAssignedBranchIds] = useState<string[]>([]);
  const [originalAssignedBranchIds, setOriginalAssignedBranchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLists = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/staff-assignments/users/${role}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/admin/staff-assignments/branches`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const uData = await uRes.json();
      const bData = await bRes.json();
      if (uData.success) setUsers(uData.data);
      if (bData.success) setBranches(bData.data);
    } catch (e) { setError('Failed to load data'); } finally { setIsLoading(false); }
  };

  const fetchAssignments = async (userId: string) => {
    const res = await fetch(`${API_BASE_URL}/api/admin/staff-assignments/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      setAssignedBranchIds(data.data);
      setOriginalAssignedBranchIds(data.data);
    }
  };

  useEffect(() => { if (user?.role === 'ADMIN') fetchLists(); }, [token, user, role]);
  useEffect(() => { if (selectedUser) fetchAssignments(selectedUser); }, [selectedUser]);

  const toggleBranch = (branchId: string) => {
    setAssignedBranchIds((ids) => ids.includes(branchId) ? ids.filter(id => id !== branchId) : [...ids, branchId]);
  };

  const saveAssignments = async () => {
    if (!selectedUser) return;
    const current = new Set(assignedBranchIds);
    const original = new Set(originalAssignedBranchIds);
    const toAssign: string[] = [];
    const toUnassign: string[] = [];
    for (const id of current) if (!original.has(id)) toAssign.push(id);
    for (const id of original) if (!current.has(id)) toUnassign.push(id);

    if (toAssign.length > 0) {
      await fetch(`${API_BASE_URL}/api/admin/staff-assignments/user/${selectedUser}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchIds: toAssign })
      });
    }
    if (toUnassign.length > 0) {
      await fetch(`${API_BASE_URL}/api/admin/staff-assignments/user/${selectedUser}/unassign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchIds: toUnassign })
      });
    }

    await fetchAssignments(selectedUser);
    alert('Assignments saved');
  };

  const hasChanges = JSON.stringify(assignedBranchIds.sort()) !== JSON.stringify(originalAssignedBranchIds.sort());
  const selectedUserData = users.find(u => u.id === selectedUser);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading staff assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Staff Assignments</h1>
            <p className="text-sm text-gray-500 mt-0.5">Assign branches to packagers and dispatchers</p>
          </div>
        </div>
      

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs">✕</span>
          </div>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Role & User Selection */}
        <div className="p-6 border-b border-orange-100 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 to-white space-y-5">
          {/* Role Tabs */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">Select Role</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setRole('DISPATCHER'); setSelectedUser(''); setAssignedBranchIds([]); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  role === 'DISPATCHER'
                    ? 'bg-orange-100 text-orange-500 shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-700'
                }`}
              >
                <Truck className="w-5 h-5" />
                Dispatcher
              </button>
              <button
                onClick={() => { setRole('PACKAGER'); setSelectedUser(''); setAssignedBranchIds([]); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  role === 'PACKAGER'
                    ? 'bg-yellow-100 text-yellow-500 shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-700'
                }`}
              >
                <Package className="w-5 h-5" />
                Packager
              </button>
            </div>
          </div>

          {/* User Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Select {role === 'DISPATCHER' ? 'Dispatcher' : 'Packager'}
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none z-10" />
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)} 
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900 bg-white cursor-pointer"
                style={{ 
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none'
                }}
              >
                <option value="">Choose a user</option>
                {users.map(u => (<option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Branch Assignment Section */}
        {selectedUser ? (
          <div className="p-6">
            {/* Selected User Info */}
            {selectedUserData && (
              <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    role === 'DISPATCHER' 
                      ? 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400' 
                      : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400'
                  }`}>
                    <span className="text-white font-semibold text-sm">
                      {selectedUserData.firstName.charAt(0)}{selectedUserData.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedUserData.firstName} {selectedUserData.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{selectedUserData.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      role === 'DISPATCHER'
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}>
                      {role === 'DISPATCHER' ? <Truck className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                      {role}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      {assignedBranchIds.length} {assignedBranchIds.length === 1 ? 'Branch' : 'Branches'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Branches Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Building2 className="w-5 h-5 text-gray-600" />
                  Assign Branches
                </label>
                <span className="text-xs text-gray-500">
                  {branches.length} total branches
                </span>
              </div>

              {branches.length === 0 ? (
                <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No branches available</p>
                  <p className="text-gray-400 text-sm mt-1">Create branches first to assign them</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {branches.map(b => (
                    <label 
                      key={b.id} 
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        assignedBranchIds.includes(b.id)
                          ? role === 'DISPATCHER'
                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                            : 'border-yellow-500 bg-yellow-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={assignedBranchIds.includes(b.id)} 
                        onChange={() => toggleBranch(b.id)}
                        className={`w-5 h-5 border-gray-300 rounded focus:ring-2 cursor-pointer ${
                          role === 'DISPATCHER' ? 'text-orange-600 focus:ring-orange-600' : 'text-yellow-600 focus:ring-yellow-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {assignedBranchIds.includes(b.id) ? (
                            <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                              role === 'DISPATCHER' ? 'text-orange-600' : 'text-yellow-600'
                            }`} />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium truncate ${
                            assignedBranchIds.includes(b.id) 
                              ? role === 'DISPATCHER' ? 'text-orange-900' : 'text-yellow-900'
                              : 'text-gray-700'
                          }`}>
                            {b.name}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Save Button */}
            {branches.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {hasChanges ? (
                    <span className="flex items-center gap-2 text-orange-600 font-medium">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      All changes saved
                    </span>
                  )}
                </div>
                <button 
                  onClick={saveAssignments}
                  disabled={!hasChanges}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                    hasChanges
                      ? role === 'DISPATCHER'
                        ? 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 hover:shadow-md'
                        : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save Assignments
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="p-12 text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              role === 'DISPATCHER' ? 'bg-orange-100' : 'bg-yellow-100'
            }`}>
              {role === 'DISPATCHER' ? (
                <Truck className="w-8 h-8 text-orange-600" />
              ) : (
                <Package className="w-8 h-8 text-orange-600" />
              )}
            </div>
            <p className="text-gray-900 font-medium mb-1">Select a {role === 'DISPATCHER' ? 'Dispatcher' : 'Packager'}</p>
            <p className="text-gray-500 text-sm">Choose a user from the dropdown above to assign branches</p>
          </div>
        )}
      </div>
    </div>
  );
}