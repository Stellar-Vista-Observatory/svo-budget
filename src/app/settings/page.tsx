'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState, useCallback } from 'react'

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
      setSyncResult(`Sync complete — ${data.lineItemsUpserted} line items, ${data.actualsUpserted} actuals updated.`)
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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      <div className="max-w-2xl space-y-8">
        {/* Connection Section */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">QuickBooks Online</h2>

          {status === null ? (
            <p className="text-slate-500 text-base">Loading…</p>
          ) : status.connected && status.connection ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-base font-medium text-slate-900">
                  {status.connection.companyName}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-medium rounded-md transition-colors"
                >
                  {syncing ? 'Syncing…' : '↻ Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-base font-medium rounded-md transition-colors"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              {status.connection.lastSyncedAt && (
                <p className="text-base text-slate-500">
                  Last synced:{' '}
                  {new Date(status.connection.lastSyncedAt).toLocaleString()}
                </p>
              )}
              {!status.connection.lastSyncedAt && (
                <p className="text-base text-slate-500">Never synced — click Sync Now to import data.</p>
              )}

              {syncResult && (
                <p className={`text-base p-3 rounded-md ${syncResult.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {syncResult}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base text-slate-600">
                Connect your QuickBooks Online account to sync your chart of accounts and transactions.
              </p>
              <a
                href="/api/qbo/connect"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-md transition-colors"
              >
                Connect to QuickBooks
              </a>
              {syncResult && (
                <p className="text-base p-3 rounded-md bg-red-50 text-red-700">{syncResult}</p>
              )}
            </div>
          )}
        </section>

        {/* Projects Section */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Projects</h2>
          <p className="text-base text-slate-600 mb-4">
            Projects organize your budget. Each project can claim a QBO account to track its spending.
          </p>

          {/* Existing projects list */}
          {projects.filter(p => p.projectType === 'claimed').length > 0 && (
            <ul className="mb-4 space-y-1">
              {projects.filter(p => p.projectType === 'claimed').map(p => (
                <li key={p.id} className="text-base text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  {p.name}
                </li>
              ))}
            </ul>
          )}

          {/* Create form */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
              disabled={creatingProject}
              className="flex-1 max-w-xs border border-slate-300 rounded-md px-3 py-1.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-medium rounded-md transition-colors"
            >
              {creatingProject ? 'Creating…' : 'Create'}
            </button>
          </div>
          {projectCreateError && (
            <p className="text-base text-red-600 mt-2">{projectCreateError}</p>
          )}
        </section>

        {/* Account Claims Section */}
        {status?.connected && accounts.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Project Account Claims</h2>
            <p className="text-base text-slate-600 mb-4">
              Assign each top-level QBO account to a project. Unassigned accounts go into the catch-all project.
            </p>

            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-medium text-slate-600 pb-2">QBO Account</th>
                  <th className="text-left font-medium text-slate-600 pb-2">Claimed By</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const currentProjectId =
                    projects.find((p) => p.qboAccountId === account.id)?.id ?? ''
                  return (
                    <tr key={account.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 text-slate-900">{account.name}</td>
                      <td className="py-3">
                        <select
                          value={currentProjectId}
                          onChange={(e) => handleClaimChange(account.id, e.target.value)}
                          disabled={claimingAccount === account.id}
                          className="text-base border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 disabled:opacity-50"
                        >
                          <option value="">— None (catch-all) —</option>
                          {claimedProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  )
}
