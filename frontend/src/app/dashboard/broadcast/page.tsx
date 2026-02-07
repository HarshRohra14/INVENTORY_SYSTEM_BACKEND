'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Send,
} from 'lucide-react';

interface Branch { id: string; name: string; }

export default function BroadcastPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [branchUsers, setBranchUsers] = useState<{ id: string; name: string; email: string; branchId: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!token) return;
    if (!(user?.role === 'MANAGER' || user?.role === 'ADMIN')) {
      router.push('/dashboard');
      return;
    }
    (async () => {
      try {
        // Admins fetch all branches; Managers fetch assigned branches
        const endpoint = user?.role === 'ADMIN' ? '/api/admin/branches' : '/api/branches/manager';
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          // admin listBranches returns { data: branches[] } too
          const list = Array.isArray(data.data) ? data.data : [];
          setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
        }
      } catch (e) {
        console.error('Fetch branches error:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, API_BASE_URL, user?.role]);

  // Load users when branches selection changes
  useEffect(() => {
    if (!token) return;
    if (selected.length === 0) { setBranchUsers([]); setSelectedUsers([]); return; }
    (async () => {
      try {
        const params = new URLSearchParams();
        selected.forEach(id => params.append('branchIds', id));
        const res = await fetch(`${API_BASE_URL}/api/notifications/branch-users?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBranchUsers((data.data || []).map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, branchId: u.branchId })));
          setSelectedUsers([]);
        }
      } catch (e) {
        console.error('Fetch branch users error:', e);
      }
    })();
  }, [selected, token, API_BASE_URL]);

  const toggleBranch = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, branchIds: selected, userIds: selectedUsers })
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Broadcast sent successfully');
        setSubject('');
        setMessage('');
        setSelected([]);
        setSelectedUsers([]);
      } else {
        setStatus(data.message || 'Broadcast failed');
      }
    } catch (e) {
      setStatus('Broadcast failed');
      console.error('Broadcast error:', e);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = status.toLowerCase().includes('success');
  const isError = status.toLowerCase().includes('fail') || status.toLowerCase().includes('error');

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Header - UPDATED WITH MEGAPHONE ICON */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Broadcast Message</h1>
          <p className="text-gray-600 text-sm">Send alerts to selected branches' users.</p>
        </div>
      </div>
        
      {/* Quick Stats */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div className="text-sm">
              <div className="text-gray-500">Branches selected</div>
              <div className="font-semibold text-gray-900">{selected.length}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50">
            <Users className="w-5 h-5 text-indigo-600" />
            <div className="text-sm">
              <div className="text-gray-500">Users loaded</div>
              <div className="font-semibold text-gray-900">{branchUsers.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50">
            <Mail className="w-5 h-5 text-purple-600" />
            <div className="text-sm">
              <div className="text-gray-500">Will receive</div>
              <div className="font-semibold text-gray-900">
                {selectedUsers.length > 0 ? selectedUsers.length : (selected.length > 0 ? 'All in branches' : '—')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {status && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-start gap-3 shadow-sm ${
            isSuccess ? 'bg-green-50 border-green-200' :
            isError ? 'bg-red-50 border-red-200' :
            'bg-orange-50 border-orange-200'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
          )}
          <p className={`text-sm ${
            isSuccess ? 'text-green-900' : isError ? 'text-red-900' : 'text-orange-900'
          }`}>{status}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-800">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              maxLength={200}
              placeholder="Enter a concise subject"
              className="mt-2 block w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition"
            />
            <div className="text-xs text-gray-400 mt-1">{subject.length}/200</div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-800">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Write the details you want to broadcast…"
              className="mt-2 block w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition resize-y"
            />
          </div>

          {/* Branches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-800">Select Branches</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {selected.length === 0 ? 'None selected' : `${selected.length} selected`}
                </span>
                <button
                  type="button"
                  className="text-xs text-orange-600 hover:underline"
                  onClick={() => setSelected(branches.map(b => b.id))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {branches.map(b => {
                const isChecked = selected.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`rounded-xl border-2 px-4 py-3 cursor-pointer flex items-center gap-3 transition-all ${
                      isChecked ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleBranch(b.id)}
                      className="h-4 w-4 text-orange-600 rounded border-gray-300 focus:ring-orange-600"
                    />
                    <span className="text-sm font-semibold text-gray-900">{b.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Users */}
          {branchUsers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-800">
                  Select Users (within chosen branches)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs text-orange-600 hover:underline"
                    onClick={() => setSelectedUsers(branchUsers.map(u => u.id))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:underline"
                    onClick={() => setSelectedUsers([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto border-2 border-gray-200 rounded-xl p-3">
                {branchUsers.map(u => {
                  const checked = selectedUsers.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`rounded-xl border-2 px-4 py-3 cursor-pointer flex items-start gap-3 transition-all ${
                        checked ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedUsers(prev =>
                            prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]
                          )
                        }
                        className="h-4 w-4 mt-0.5 text-orange-600 rounded border-gray-300 focus:ring-orange-600"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{u.name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                If you leave this empty, everyone in the selected branches will be included.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <button
              type="submit"
              disabled={loading || selected.length === 0}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white shadow-sm transition-all
                ${loading || selected.length === 0 ? 'bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300 cursor-not-allowed' : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400'}`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Broadcast
                </>
              )}
            </button>

            <div className="text-xs text-gray-500">
              Tip: Choose branches first, then optionally select specific users.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}