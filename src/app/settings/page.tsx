'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'

interface QboStatus {
  connected: boolean
  connection: { realmId: string; companyName: string; lastSyncedAt: string | null } | null
}

interface QboAccount {
  id: string
  name: string
  claimedByProject: { id: string; name: string; qboAccountId: string } | null
}

interface Project {
  id: string
  name: string
  projectType: string
  qboAccountId: string | null
}

export default function SettingsPage() {
  const [status, setStatus] = useState<QboStatus | null>(null)
  const [accounts, setAccounts] = useState<QboAccount[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [claimingAccount, setClaimingAccount] = useState<string | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/qbo/status')
    const data = await res.json()
    setStatus(data)
  }, [])

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (res.ok) {
      const data = await res.json()
      setProjects(data.projects ?? [])
    }
  }, [])

  const loadAccountsAndProjects = useCallback(async () => {
    const [accountsRes, projectsRes] = await Promise.all([
      fetch('/api/qbo/accounts'),
      fetch('/api/projects'),
    ])
    if (accountsRes.ok) {
      const data = await accountsRes.json()
      setAccounts(data.accounts ?? [])
    }
    if (projectsRes.ok) {
      const data = await projectsRes.json()
      setProjects(data.projects ?? [])
    }
  }, [])

  useEffect(() => {
    loadStatus()
    loadProjects()
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setSyncResult('Connected to QuickBooks successfully.')
      window.history.replaceState({}, '', '/settings')
    }
    if (params.get('error') === 'qbo_auth') {
      setSyncResult('QuickBooks connection failed. Please try again.')
      window.history.replaceState({}, '', '/settings')
    }
  }, [loadStatus, loadProjects])

  useEffect(() => {
    if (status?.connected) {
      loadAccountsAndProjects()
    }
  }, [status?.connected, loadAccountsAndProjects])

  async function handleRenameProject(id: string) {
    if (!editingName.trim()) return
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName.trim() }),
    })
    setEditingProjectId(null)
    await loadAccountsAndProjects()
  }

  async function handleDeleteProject(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This will remove all its categories, budget entries, and actuals.`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    await loadAccountsAndProjects()
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    setProjectCreateError(null)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName.trim() }),
    })
    if (res.ok) {
      setNewProjectName('')
      await loadAccountsAndProjects()
    } else {
      const data = await res.json()
      setProjectCreateError(data.error ?? 'Failed to create project')
    }
    setCreatingProject(false)
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect from QuickBooks? Existing synced data will be kept.')) return
    setDisconnecting(true)
    await fetch('/api/qbo/disconnect', { method: 'POST' })
    await loadStatus()
    setAccounts([])
    setProjects([])
    setSyncResult(null)
    setDisconnecting(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/qbo/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`Sync complete — ${data.categoriesSynced} categories, ${data.actualsUpserted} actuals updated.`)
      await loadStatus()
      await loadAccountsAndProjects()
    } else {
      setSyncResult(`Sync failed: ${data.error}`)
    }
    setSyncing(false)
  }

  async function handleClaimChange(accountId: string, projectId: string) {
    setClaimingAccount(accountId)
    if (projectId === '') {
      const currentProject = projects.find((p) => p.qboAccountId === accountId)
      if (currentProject) {
        await fetch(`/api/projects/${currentProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qboAccountId: null }),
        })
      }
    } else {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qboAccountId: accountId }),
      })
    }
    await loadAccountsAndProjects()
    setClaimingAccount(null)
  }

  const claimedProjects = projects.filter((p) => p.projectType === 'claimed')

  return (
    <AppShell>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>Settings</Typography>

      <Stack spacing={4} sx={{ maxWidth: 700 }}>
        {/* Connection Section */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>QuickBooks Online</Typography>

          {status === null ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : status.connected && status.connection ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
                <Typography sx={{ fontWeight: 500 }}>{status.connection.companyName}</Typography>
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" onClick={handleSync} disabled={syncing}>
                  {syncing ? 'Syncing…' : '↻ Sync Now'}
                </Button>
                <Button variant="outlined" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </Stack>

              {status.connection.lastSyncedAt && (
                <Typography variant="body2" color="text.secondary">
                  Last synced: {new Date(status.connection.lastSyncedAt).toLocaleString()}
                </Typography>
              )}
              {!status.connection.lastSyncedAt && (
                <Typography variant="body2" color="text.secondary">
                  Never synced — click Sync Now to import data.
                </Typography>
              )}

              {syncResult && (
                <Alert severity={syncResult.includes('failed') ? 'error' : 'success'}>
                  {syncResult}
                </Alert>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Connect your QuickBooks Online account to sync your chart of accounts and transactions.
              </Typography>
              <Box>
                <Button variant="contained" href="/api/qbo/connect">
                  Connect to QuickBooks
                </Button>
              </Box>
              {syncResult && <Alert severity="error">{syncResult}</Alert>}
            </Stack>
          )}
        </Paper>

        {/* Projects Section */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Projects</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Projects organize your budget. Each project can claim a QBO account to track its spending.
          </Typography>

          {claimedProjects.length > 0 && (
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {claimedProjects.map((p) => (
                <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'grey.400', flexShrink: 0 }} />
                  {editingProjectId === p.id ? (
                    <>
                      <TextField
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id); if (e.key === 'Escape') setEditingProjectId(null) }}
                        size="small"
                        autoFocus
                        sx={{ flex: 1, maxWidth: 200 }}
                      />
                      <IconButton size="small" onClick={() => handleRenameProject(p.id)}><CheckIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setEditingProjectId(null)}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
                      <Tooltip title="Rename">
                        <IconButton size="small" onClick={() => { setEditingProjectId(p.id); setEditingName(p.name) }}>
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteProject(p.id, p.name)} sx={{ '&:hover': { color: 'error.main' } }}>
                          <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
              disabled={creatingProject}
              size="small"
              sx={{ maxWidth: 250 }}
            />
            <Button
              variant="contained"
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
            >
              {creatingProject ? 'Creating…' : 'Create'}
            </Button>
          </Stack>
          {projectCreateError && (
            <Alert severity="error" sx={{ mt: 1 }}>{projectCreateError}</Alert>
          )}
        </Paper>

        {/* Account Claims Section */}
        {status?.connected && accounts.length > 0 && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Project Account Claims</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Assign each top-level QBO account to a project. Unassigned accounts go into the catch-all project.
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>QBO Account</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Claimed By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.map((account) => {
                    const currentProjectId = projects.find((p) => p.qboAccountId === account.id)?.id ?? ''
                    return (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <Select
                            value={currentProjectId}
                            onChange={(e) => handleClaimChange(account.id, e.target.value)}
                            disabled={claimingAccount === account.id}
                            size="small"
                            displayEmpty
                            sx={{ minWidth: 180 }}
                          >
                            <MenuItem value="">— None (catch-all) —</MenuItem>
                            {claimedProjects.map((p) => (
                              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Stack>
    </AppShell>
  )
}
