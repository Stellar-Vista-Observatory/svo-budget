'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  email: string
  role: 'admin' | 'viewer'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (!res.ok) { setError('Access denied or failed to load users'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleRoleChange(userId: string, role: 'admin' | 'viewer') {
    setUpdating(userId)
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await loadUsers()
    setUpdating(null)
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">User Management</h1>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-4 text-base mb-6">{error}</div>}
      {loading && <p className="text-slate-500 text-base">Loading…</p>}

      {!loading && !error && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-2xl">
          <table className="w-full text-base">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Email</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'viewer')}
                      disabled={updating === user.id}
                      className="text-base border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 disabled:opacity-50"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
