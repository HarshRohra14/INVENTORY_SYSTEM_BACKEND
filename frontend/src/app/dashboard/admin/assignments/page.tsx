'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, Shield, Building2, UserCheck, Save, CheckCircle2, Circle, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Manager { id: string; firstName: string; lastName: string; email: string; }
interface Branch { id: string; name: string; }

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function AdminAssignmentsPage() {
  const { token, user } = useAuth();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [managers, setManagers] = useState<Manager[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [assignedBranchIds, setAssignedBranchIds] = useState<string[]>([]);
  const [originalAssignedBranchIds, setOriginalAssignedBranchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  // Toast Functions
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = toastId + 1;
    setToastId(id);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchLists = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [mRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/assignments/managers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/admin/assignments/branches`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const mData = await mRes.json();
      const bData = await bRes.json();
      if (mData.success) setManagers(mData.data);
      if (bData.success) setBranches(bData.data);
    } catch (e) { 
      setError('Failed to load data');
      showToast('error', 'Failed to load data');
    } finally { 
      setIsLoading(false); 
    }
  };

  const fetchAssignments = async (managerId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/assignments/manager/${managerId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      if (data.success) {
        setAssignedBranchIds(data.data);
        setOriginalAssignedBranchIds(data.data);
      } else {
        showToast('error', 'Failed to load manager assignments');
      }
    } catch (error) {
      showToast('error', 'An error occurred while loading assignments');
    }
  };

  useEffect(() => { if (user?.role === 'ADMIN') fetchLists(); }, [token, user]);
  useEffect(() => { if (selectedManager) fetchAssignments(selectedManager); }, [selectedManager]);

  const toggleBranch = (branchId: string) => {
    setAssignedBranchIds((ids) => ids.includes(branchId) ? ids.filter(id => id !== branchId) : [...ids, branchId]);
  };

  const saveAssignments = async () => {
    if (!selectedManager) {
      showToast('warning', 'Please select a manager first');
      return;
    }

    const selectedManagerData = managers.find(m => m.id === selectedManager);
    const managerName = selectedManagerData ? `${selectedManagerData.firstName} ${selectedManagerData.lastName}` : 'Manager';

    // Compute diffs
    const current = new Set(assignedBranchIds);
    const original = new Set(originalAssignedBranchIds);
    const toAssign: string[] = [];
    const toUnassign: string[] = [];
    
    for (const id of current) {
      if (!original.has(id)) toAssign.push(id);
    }
    for (const id of original) {
      if (!current.has(id)) toUnassign.push(id);
    }

    try {
      // Call APIs
      if (toAssign.length > 0) {
        const assignRes = await fetch(`${API_BASE_URL}/api/admin/assignments/manager/${selectedManager}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ branchIds: toAssign })
        });
        const assignData = await assignRes.json();
        if (!assignRes.ok || !assignData.success) {
          showToast('error', assignData.message || 'Failed to assign branches');
          return;
        }
      }

      if (toUnassign.length > 0) {
        const unassignRes = await fetch(`${API_BASE_URL}/api/admin/assignments/manager/${selectedManager}/unassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ branchIds: toUnassign })
        });
        const unassignData = await unassignRes.json();
        if (!unassignRes.ok || !unassignData.success) {
          showToast('error', unassignData.message || 'Failed to unassign branches');
          return;
        }
      }

      await fetchAssignments(selectedManager);
      
      // Show success message with details
      if (toAssign.length > 0 && toUnassign.length > 0) {
        showToast('success', `Assignments updated for ${managerName}: ${toAssign.length} assigned, ${toUnassign.length} unassigned`);
      } else if (toAssign.length > 0) {
        showToast('success', `Successfully assigned ${toAssign.length} ${toAssign.length === 1 ? 'branch' : 'branches'} to ${managerName}`);
      } else if (toUnassign.length > 0) {
        showToast('success', `Successfully unassigned ${toUnassign.length} ${toUnassign.length === 1 ? 'branch' : 'branches'} from ${managerName}`);
      } else {
        showToast('success', 'Assignments saved successfully');
      }
    } catch (error) {
      showToast('error', 'An error occurred while saving assignments');
      console.error('Save assignments error:', error);
    }
  };

  const hasChanges = JSON.stringify(assignedBranchIds.sort()) !== JSON.stringify(originalAssignedBranchIds.sort());
  const selectedManagerData = managers.find(m => m.id === selectedManager);

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
          <p className="text-gray-600 font-medium">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border-2 animate-slide-in-right ${
              toast.type === 'success' 
                ? 'bg-green-50 border-green-200' 
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className={`w-5 h-5 ${toast.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                toast.type === 'success' 
                  ? 'text-green-900' 
                  : toast.type === 'error'
                  ? 'text-red-900'
                  : 'text-yellow-900'
              }`}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className={`flex-shrink-0 ${
                toast.type === 'success' 
                  ? 'text-green-600 hover:text-green-800' 
                  : toast.type === 'error'
                  ? 'text-red-600 hover:text-red-800'
                  : 'text-yellow-600 hover:text-yellow-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center">
            <UserCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Manager Assignments</h1>
            <p className="text-sm text-gray-500 mt-0.5">Assign branches to Managers</p>
          </div>
        </div>
      

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <X className="w-3 h-3 text-white" />
          </div>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Manager Selection */}
        <div className="p-6 border-b border-orange-100 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400">
          <label className="block text-m font-semibold text-white mb-3">Select Manager</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none z-10" />
            <select 
              value={selectedManager} 
              onChange={(e) => setSelectedManager(e.target.value)} 
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900 bg-white cursor-pointer"
              style={{ 
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none'
              }}
            >
              <option value="">Choose a manager</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Branch Assignment Section */}
        {selectedManager ? (
          <div className="p-6">
            {/* Selected Manager Info */}
            {selectedManagerData && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {selectedManagerData.firstName.charAt(0)}{selectedManagerData.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedManagerData.firstName} {selectedManagerData.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{selectedManagerData.email}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                      {assignedBranchIds.length} {assignedBranchIds.length === 1 ? 'Branch' : 'Branches'} Assigned
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
                          ? 'border-orange-500 bg-orange-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={assignedBranchIds.includes(b.id)} 
                        onChange={() => toggleBranch(b.id)}
                        className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-2 focus:ring-orange-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {assignedBranchIds.includes(b.id) ? (
                            <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium truncate ${
                            assignedBranchIds.includes(b.id) ? 'text-orange-900' : 'text-gray-700'
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
                      ? 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 hover:shadow-md'
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
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">Select a Manager</p>
            <p className="text-gray-500 text-sm">Choose a manager from the dropdown above to assign branches</p>
          </div>
        )}
      </div>

      {/* Add CSS for animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}