'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState } from 'react'
import {
  Alert,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

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
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>User Management</Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <CircularProgress />}

      {!loading && !error && (
        <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 600 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'viewer')}
                      disabled={updating === user.id}
                      size="small"
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value="viewer">Viewer</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  )
}
