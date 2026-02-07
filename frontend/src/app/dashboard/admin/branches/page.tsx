'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Building2, MapPin, Edit2, Trash2, X, Plus, Shield, Map, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface BranchTL { id: string; location: string; }
interface Branch { id: string; name: string; address: string; city: string; state: string; zipCode: string; phone?: string; email?: string; isActive: boolean; targetLocations: BranchTL[] }

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function AdminBranchesPage() {
  const { token, user } = useAuth();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zipCode: '', phone: '', email: '', targetLocations: [] as string[] });

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

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

  const fetchAll = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/branches`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/products/target-locations`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const bData = await bRes.json();
      const lData = await lRes.json();
      if (bData.success) setBranches(bData.data);
      if (lData.success) {
        // Ensure allLocations is an array of valid strings
        const validLocations = Array.isArray(lData.data) 
          ? lData.data.filter((loc: any) => loc && typeof loc === 'string' && loc.trim().length > 0).map((loc: string) => loc.trim())
          : [];
        setAllLocations(validLocations);
      }
    } catch (e) { 
      setError('Failed to load branches');
      showToast('error', 'Failed to load branches');
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { if (user?.role === 'ADMIN') fetchAll(); }, [token, user]);

  const openCreate = () => { 
    setEditing(null); 
    setForm({ name: '', address: '', city: '', state: '', zipCode: '', phone: '', email: '', targetLocations: [] }); 
    setShowModal(true); 
  };

  const openEdit = (b: Branch) => { 
    setEditing(b); 
    setForm({ 
      name: b.name, 
      address: b.address, 
      city: b.city, 
      state: b.state, 
      zipCode: b.zipCode, 
      phone: b.phone || '', 
      email: b.email || '', 
      targetLocations: b.targetLocations.map(t => t.location) 
    }); 
    setShowModal(true); 
  };

  // Open Delete Confirmation Modal
  const openDeleteModal = (b: Branch) => {
    setBranchToDelete(b);
    setShowDeleteModal(true);
  };

  const toggleLocation = (loc: string) => {
    if (!loc || typeof loc !== 'string' || loc.trim().length === 0) return;
    setForm((f) => {
      const trimmedLoc = loc.trim();
      const isSelected = f.targetLocations.some(l => l && l.trim() === trimmedLoc);
      if (isSelected) {
        return { ...f, targetLocations: f.targetLocations.filter(l => l && l.trim() !== trimmedLoc) };
      } else {
        return { ...f, targetLocations: [...f.targetLocations, trimmedLoc] };
      }
    });
  };

  // NEW: Select All / Deselect All Function
  const toggleSelectAll = () => {
    setForm((f) => {
      // Normalize both arrays for comparison (trim and lowercase for case-insensitive)
      const normalizedSelected = new Set(f.targetLocations.map(l => l?.trim().toLowerCase()).filter(Boolean));
      const normalizedAll = new Set(allLocations.map(l => l?.trim().toLowerCase()).filter(Boolean));
      
      // Check if all locations are selected (comparing sets)
      const allSelected = normalizedAll.size > 0 && 
        normalizedSelected.size === normalizedAll.size &&
        Array.from(normalizedAll).every(loc => normalizedSelected.has(loc));
      
      if (allSelected) {
        // If all are selected, deselect all
        return { ...f, targetLocations: [] };
      } else {
        // Select all - ensure we're using a fresh copy of allLocations, filtered and trimmed
        const allLocs = allLocations
          .filter(loc => loc && typeof loc === 'string' && loc.trim().length > 0)
          .map(loc => loc.trim());
        return { ...f, targetLocations: allLocs };
      }
    });
  };

  const save = async () => {
    // Basic validation
    if (!form.name.trim()) {
      showToast('error', 'Branch name is required');
      return;
    }
    if (!form.address.trim()) {
      showToast('error', 'Address is required');
      return;
    }
    if (!form.city.trim()) {
      showToast('error', 'City is required');
      return;
    }
    if (!form.state.trim()) {
      showToast('error', 'State is required');
      return;
    }
    if (!form.zipCode.trim()) {
      showToast('error', 'Zip code is required');
      return;
    }

    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${API_BASE_URL}/api/admin/branches/${editing.id}` : `${API_BASE_URL}/api/admin/branches`;
      
      // Filter and validate targetLocations - remove empty strings, duplicates, and ensure all are valid strings
      const validTargetLocations = Array.from(new Set(
        form.targetLocations
          .filter((loc): loc is string => typeof loc === 'string' && loc.trim().length > 0)
          .map(loc => loc.trim())
      ));

      // Build payload properly - only include non-empty fields
      const payload: any = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        targetLocations: validTargetLocations // Always send array, even if empty
      };

      // Only add phone and email if they have values
      if (form.phone && form.phone.trim()) {
        payload.phone = form.phone.trim();
      }
      if (form.email && form.email.trim()) {
        payload.email = form.email.trim();
      }

      console.log('Sending payload:', JSON.stringify(payload, null, 2)); // Debug log
      console.log('Target locations count:', validTargetLocations.length); // Debug log

      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify(payload) 
      });

      const data = await res.json();
      
      console.log('Response status:', res.status); // Debug log
      console.log('Response data:', JSON.stringify(data, null, 2)); // Debug log
      
      if (!res.ok || !data.success) {
        console.error('Save failed - Status:', res.status, 'Data:', data); // Debug log
        // Show more detailed error message
        let errorMessage = 'Failed to save branch';
        if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.errors) {
          if (Array.isArray(data.errors)) {
            errorMessage = data.errors.join(', ');
          } else if (typeof data.errors === 'object') {
            errorMessage = Object.values(data.errors).flat().join(', ');
          }
        } else if (res.status === 400) {
          errorMessage = 'Validation error: Please check all required fields';
        } else if (res.status === 500) {
          errorMessage = 'Server error: Please try again later';
        }
        showToast('error', errorMessage);
        return;
      }
      
      // Success
      setShowModal(false); 
      await fetchAll();
      if (editing) {
        showToast('success', `Branch "${form.name}" updated successfully!`);
      } else {
        showToast('success', `Branch "${form.name}" created successfully!`);
      }
    } catch (error: any) {
      console.error('Save error:', error); // Debug log
      const errorMessage = error?.message || 'An error occurred while saving the branch';
      showToast('error', errorMessage);
    }
  };

  const hardDelete = async () => {
    if (!branchToDelete) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/branches/${branchToDelete.id}/hard`, { 
        method: 'DELETE', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.success) {
        // Close modal first
        setShowDeleteModal(false);
        setBranchToDelete(null);
        
        // Then fetch and show success
        await fetchAll();
        showToast('success', `Branch "${branchToDelete.name}" deleted permanently`);
      } else {
        // Close modal and show error toast
        setShowDeleteModal(false);
        setBranchToDelete(null);
        showToast('error', data.message || 'Failed to delete branch. The branch may have associated records.');
      }
    } catch (error) {
      // Close modal and show error toast
      setShowDeleteModal(false);
      setBranchToDelete(null);
      showToast('error', 'An error occurred while deleting the branch');
    }
  };

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
          <p className="text-gray-600 font-medium">Loading branches...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Branch Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">{branches.length} total branches</p>
          </div>
        </div>
        <button 
          onClick={openCreate} 
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create Branch
        </button>
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

      {/* Branches Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400">
              <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Branch</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Target Areas</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No branches found</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first branch to get started</p>
                  </td>
                </tr>
              ) : (
                branches.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                          <p className="text-xs text-gray-500">ID: {b.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2 text-sm text-gray-900">
                        <MapPin className="w-4 h-4 text-gray-900 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>{b.address}</p>
                          <p className="text-xs text-gray-900">{b.city}, {b.state} {b.zipCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {b.targetLocations.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {b.targetLocations.map(t => (
                            <span key={t.id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              {t.location}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEdit(b)} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button 
                          onClick={() => openDeleteModal(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Inactive Branch
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setShowModal(false)} />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {editing ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                  <h3 className="text-xl font-bold text-white">
                    {editing ? 'Edit Branch' : 'Create New Branch'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Branch Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Branch Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="Main Branch"
                        required
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        value={form.address} 
                        onChange={(e) => setForm({ ...form, address: e.target.value })} 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="123 Main Street"
                        required
                      />
                    </div>
                  </div>

                  {/* City, State, Zip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input 
                        value={form.city} 
                        onChange={(e) => setForm({ ...form, city: e.target.value })} 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="New York"
                        required
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input 
                        value={form.state} 
                        onChange={(e) => setForm({ ...form, state: e.target.value })} 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="NY"
                        required
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Zip Code <span className="text-red-500">*</span>
                      </label>
                      <input 
                        value={form.zipCode} 
                        onChange={(e) => setForm({ ...form, zipCode: e.target.value })} 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="10001"
                        required
                      />
                    </div>
                  </div>

                  {/* Target Locations - WITH SELECT ALL BUTTON */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Map className="w-5 h-5 text-gray-700" />
                        <label className="block text-sm font-semibold text-gray-700">Target Locations</label>
                      </div>
                      
                      {/* SELECT ALL BUTTON */}
                      {allLocations.length > 0 && (() => {
                        // Check if all are selected (normalized comparison)
                        const normalizedSelected = new Set(form.targetLocations.map(l => l?.trim().toLowerCase()).filter(Boolean));
                        const normalizedAll = new Set(allLocations.map(l => l?.trim().toLowerCase()).filter(Boolean));
                        const allSelected = normalizedAll.size > 0 && 
                          normalizedSelected.size === normalizedAll.size &&
                          Array.from(normalizedAll).every(loc => normalizedSelected.has(loc));
                        
                        return (
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            {allSelected ? (
                              <>
                                <X className="w-3.5 h-3.5" />
                                Deselect All
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Select All
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                    
                    {allLocations.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        {allLocations.map(loc => {
                          // Normalized check for selected state
                          const trimmedLoc = loc?.trim();
                          const isSelected = form.targetLocations.some(l => l && l.trim() === trimmedLoc);
                          return (
                            <label 
                              key={loc} 
                              className="inline-flex items-center gap-2 cursor-pointer hover:bg-white px-3 py-2 rounded-md transition-colors"
                            >
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => toggleLocation(loc)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-2 focus:ring-orange-600"
                              />
                              <span className="text-sm text-gray-700">{loc}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border border-gray-200">
                        <Map className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No target locations available</p>
                      </div>
                    )}
                    {form.targetLocations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-xs text-gray-600 font-medium">Selected ({form.targetLocations.length}):</span>
                        {form.targetLocations.map(loc => (
                          <span key={loc} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">
                            {loc}
                            <button 
                              type="button"
                              onClick={() => toggleLocation(loc)}
                              className="hover:bg-orange-200 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={save} 
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white font-semibold hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 transition-all shadow-sm hover:shadow-md"
                >
                  {editing ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && branchToDelete && (
        <>
          {/* Backdrop - Light */}
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40" onClick={() => setShowDeleteModal(false)} />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
              {/* Modal Header */}
              <div className="bg-red-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Delete Branch</h3>
                </div>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 text-center mb-2">
                    Permanently Delete Inactive Branch?
                  </h4>
                  <p className="text-gray-600 text-center text-sm mb-4">
                    You are about to permanently delete:
                  </p>
                  
                  {/* Branch Info Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{branchToDelete.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{branchToDelete.address}</p>
                        <p className="text-xs text-gray-500">{branchToDelete.city}, {branchToDelete.state} {branchToDelete.zipCode}</p>
                      </div>
                    </div>
                    {branchToDelete.targetLocations.length > 0 && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Target Locations:</p>
                        <div className="flex flex-wrap gap-1">
                          {branchToDelete.targetLocations.slice(0, 3).map(t => (
                            <span key={t.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">
                              {t.location}
                            </span>
                          ))}
                          {branchToDelete.targetLocations.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{branchToDelete.targetLocations.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warning Message */}
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-red-900 mb-1">Warning: This action cannot be undone!</h5>
                        <p className="text-xs text-red-800">
                          All branch data, associated users, and records will be permanently deleted from the system.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={hardDelete} 
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-400 to-red-500 text-white font-semibold hover:from-red-600 hover:to-red-600 transition-all shadow-sm hover:shadow-md"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
        
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}