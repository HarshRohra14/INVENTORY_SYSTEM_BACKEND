'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, UserPlus, Edit2, Trash2, X, Mail, Lock, User, Building2, Shield, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface Branch { id: string; name: string; }
interface User { id: string; email: string; firstName: string; lastName: string; phoneNumber?: string | null; role: string; branchId?: string | null; isActive: boolean; }

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function AdminUsersPage() {
  const { token, user } = useAuth();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phoneNumber: '', role: 'BRANCH_USER', branchId: '' });
  
  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
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
      const [uRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/admin/branches`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const uData = await uRes.json();
      const bData = await bRes.json();
      if (uData.success) setUsers(uData.data);
      if (bData.success) setBranches(bData.data.filter((b: any) => b.isActive !== false));
    } catch (e) {
      setError('Failed to load admin data');
      showToast('error', 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user?.role === 'ADMIN') fetchAll(); }, [token, user]);

  const openCreate = () => { 
    setEditing(null); 
    setForm({ email: '', password: '', firstName: '', lastName: '', role: 'BRANCH_USER', branchId: '' }); 
    setShowModal(true); 
  };

  const openEdit = (u: User) => { 
    setEditing(u); 
    setForm({ email: u.email, password: '', firstName: u.firstName, lastName: u.lastName, phoneNumber: u.phoneNumber || '', role: u.role, branchId: u.branchId || '' }); 
    setShowModal(true); 
  };

  // Open Delete Confirmation Modal
  const openDeleteModal = (u: User) => {
    setUserToDelete(u);
    setShowDeleteModal(true);
  };

  // Form Validation
  const validateForm = () => {
    // Check required fields
    if (!form.firstName.trim()) {
      showToast('error', 'First name is required');
      return false;
    }
    if (!form.lastName.trim()) {
      showToast('error', 'Last name is required');
      return false;
    }

    // Phone validation (mandatory)
    if (!form.phoneNumber || !form.phoneNumber.trim()) {
      showToast('error', 'Phone number is required');
      return false;
    }
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!phoneRegex.test(form.phoneNumber)) {
      showToast('error', 'Please enter a valid phone number');
      return false;
    }

    // For new users, validate email and password
    if (!editing) {
      if (!form.email.trim()) {
        showToast('error', 'Email is required');
        return false;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        showToast('error', 'Please enter a valid email address');
        return false;
      }

      if (!form.password) {
        showToast('error', 'Password is required');
        return false;
      }

      // Password validation
      if (form.password.length < 8) {
        showToast('error', 'Password must be at least 8 characters long');
        return false;
      }

      if (!/(?=.*[a-z])/.test(form.password)) {
        showToast('error', 'Password must contain at least one lowercase letter');
        return false;
      }

      if (!/(?=.*[A-Z])/.test(form.password)) {
        showToast('error', 'Password must contain at least one uppercase letter');
        return false;
      }

      if (!/(?=.*\d)/.test(form.password)) {
        showToast('error', 'Password must contain at least one number');
        return false;
      }

      if (!/(?=.*[@$!%*?&])/.test(form.password)) {
        showToast('error', 'Password must contain at least one special character (@$!%*?&)');
        return false;
      }
    }

    return true;
  };

  const save = async () => {
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${API_BASE_URL}/api/admin/users/${editing.id}` : `${API_BASE_URL}/api/admin/users`;
    const body: any = { 
      firstName: form.firstName, 
      lastName: form.lastName, 
      phoneNumber: form.phoneNumber || null,
      role: form.role, 
      branchId: form.role === 'BRANCH_USER' ? form.branchId : null 
    };
    
    if (!editing) Object.assign(body, { email: form.email, password: form.password });
    
    try {
      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify(body) 
      });
      const data = await res.json();
      
      if (data.success) { 
        setShowModal(false); 
        await fetchAll();
        if (editing) {
          showToast('success', `User ${form.firstName} ${form.lastName} updated successfully!`);
        } else {
          showToast('success', `User ${form.firstName} ${form.lastName} created successfully!`);
        }
      } else {
        // Don't close modal on error, just show toast
        // Check for specific error messages
        if (data.message?.toLowerCase().includes('email') && (data.message?.toLowerCase().includes('already') || data.message?.toLowerCase().includes('exists') || data.message?.toLowerCase().includes('registered'))) {
          showToast('error', 'This email is already registered. Please use a different email address.');
        } else {
          showToast('error', data.message || 'Failed to save user');
        }
      }
    } catch (error) {
      showToast('error', 'An error occurred while saving the user');
    }
  };

  const hardDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userToDelete.id}/hard`, { 
        method: 'DELETE', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.success) {
        // Close modal first
        setShowDeleteModal(false);
        setUserToDelete(null);
        
        // Then fetch and show success
        await fetchAll();
        showToast('success', `User ${userToDelete.firstName} ${userToDelete.lastName} deleted permanently`);
      } else {
        // Close modal and show error toast
        setShowDeleteModal(false);
        setUserToDelete(null);
        showToast('error', data.message || 'Failed to delete user. The user may have associated records.');
      }
    } catch (error) {
      // Close modal and show error toast
      setShowDeleteModal(false);
      setUserToDelete(null);
      showToast('error', 'An error occurred while deleting the user');
    }
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
      MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
      BRANCH_USER: 'bg-green-100 text-green-800 border-green-200',
      ACCOUNTS: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-200';
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading users...</p>
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
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">User Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">{users.length} total users</p>
            </div>
          </div>
          <button 
            onClick={openCreate} 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400  transition-all shadow-sm hover:shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            Create User
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

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-orange-400 to-amber-400">
                <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Branch</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No users found</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first user to get started</p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-500">ID: {u.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {u.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-sm text-gray-600">{u.phoneNumber || <span className="text-gray-400">—</span>}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadge(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {branches.find(b => b.id === u.branchId)?.name || <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEdit(u)} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button 
                          onClick={() => openDeleteModal(u)} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Inactive User
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
          {/* Backdrop - Made lighter */}
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setShowModal(false)} />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {editing ? <Edit2 className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
                  <h3 className="text-xl font-bold text-white">
                    {editing ? 'Edit User' : 'Create New User'}
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
                <div className="space-y-5">
                  

                  {/* Name Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          value={form.firstName} 
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900"
                          placeholder="John"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          value={form.lastName} 
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900"
                          placeholder="Doe"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        required
                        className="w-full pl-3 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900"
                        placeholder="+919876543210"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Include country code (e.g. +91).</p>
                  </div>

                  {/* Email & Password (Only for Create) */}
                  {!editing && (
                    <div className="space-y-5 pb-5 border-b border-gray-200">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input 
                            type="email"
                            value={form.email} 
                            onChange={(e) => setForm({ ...form, email: e.target.value })} 
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900"
                            placeholder="user@example.com"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input 
                            type="password" 
                            value={form.password} 
                            onChange={(e) => setForm({ ...form, password: e.target.value })} 
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)
                        </p>
                      </div>
                    </div>
                  )}


                  {/* Role */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select 
                        value={form.role} 
                        onChange={(e) => setForm({ ...form, role: e.target.value })} 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900 appearance-none bg-white"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="BRANCH_USER">Branch User</option>
                        <option value="PACKAGER">Packager</option>
                        <option value="DISPATCHER">Dispatcher</option>
                        <option value="ACCOUNTS">Accounts</option>
                      </select>
                    </div>
                  </div>

                  {/* Branch (Only for BRANCH_USER) */}
                  {form.role === 'BRANCH_USER' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Branch</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select 
                          value={form.branchId} 
                          onChange={(e) => setForm({ ...form, branchId: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-gray-900 appearance-none bg-white"
                        >
                          <option value="">Select a branch</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
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
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white font-semibold hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 transition-all shadow-sm hover:shadow-m"
                >
                  {editing ? 'Update User' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <>
          {/* Backdrop - Made much lighter */}
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
                  <h3 className="text-xl font-bold text-white">Delete User</h3>
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
                      <Trash2 className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 text-center mb-2">
                    Permanently Delete Inactive User?
                  </h4>
                  <p className="text-gray-600 text-center text-sm mb-4">
                    You are about to permanently delete:
                  </p>
                  
                  {/* User Info Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold">
                          {userToDelete.firstName.charAt(0)}{userToDelete.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {userToDelete.firstName} {userToDelete.lastName}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{userToDelete.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Role:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadge(userToDelete.role)}`}>
                        {userToDelete.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Warning Message */}
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-red-900 mb-1">Warning: This action cannot be undone!</h5>
                        <p className="text-xs text-red-800">
                          All user data, permissions, and associated records will be permanently deleted from the system.
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
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-400 to-red-500 text-white font-semibold hover:from-red-500 hover:to-red-600 transition-all shadow-sm hover:shadow-md"
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