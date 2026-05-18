'use client'

import { AppShell } from '@/components/layout/AppShell'
import { FundingSourceCard } from '@/components/project/FundingSourceCard'
import { LineItemsTable } from '@/components/project/LineItemsTable'
import { SegmentedBar } from '@/components/SegmentedBar'
import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

interface ActualsBySource {
  fundingSourceId: string | null
  name: string
  color: string
  total: number
}

interface LineItemData {
  id: string
  name: string
  displayPath: string
  estimatedAmount: number
  isActive: boolean
  spent: number
  remaining: number
  allocationPct: number
  allocations: AllocationData[]
  actualsBySource: ActualsBySource[]
}

interface FundingSourceData {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
  remaining: number
  qboClassId: string
  qboClassName: string
}

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  projectType: string
  totalEstimated: number
  totalSecured: number
  totalSpent: number
  fundingGap: number
  fundingSources: FundingSourceData[]
  lineItems: LineItemData[]
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) { setError('Project not found'); return }
    setProject(await res.json())
  }, [id])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  if (error) return (
    <AppShell>
      <p className="text-red-600 text-base">{error}</p>
    </AppShell>
  )

  if (!project) return (
    <AppShell>
      <p className="text-slate-500 text-base">Loading…</p>
    </AppShell>
  )

  const barTotal = Math.max(project.totalEstimated, project.totalSecured)
  const securedUnspent = Math.max(0, project.totalSecured - project.totalSpent)

  return (
    <AppShell>
      <div className="mb-2">
        <nav className="text-sm text-slate-500 mb-4">
          <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="text-slate-900">{project.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.description && <p className="text-slate-500 text-base mt-1">{project.description}</p>}
      </div>

      <div className="mt-4 mb-6">
        <SegmentedBar
          total={barTotal}
          segments={[
            { value: project.totalSpent, color: '#3b82f6', label: 'Spent' },
            { value: securedUnspent, color: '#16a34a', label: 'Secured unspent' },
            { value: Math.max(0, project.fundingGap), color: '#f59e0b', label: 'Funding gap' },
          ]}
        />
        <div className="flex gap-6 mt-2 text-sm text-slate-600">
          <span>Estimated: <strong className="text-slate-900">${project.totalEstimated.toLocaleString()}</strong></span>
          <span>Secured: <strong className="text-green-700">${project.totalSecured.toLocaleString()}</strong></span>
          <span>Spent: <strong className="text-blue-700">${project.totalSpent.toLocaleString()}</strong></span>
          {project.fundingGap > 0
            ? <span>Gap: <strong className="text-amber-700">${project.fundingGap.toLocaleString()}</strong></span>
            : <span>Surplus: <strong className="text-green-700">${Math.abs(project.fundingGap).toLocaleString()}</strong></span>
          }
        </div>
      </div>

      {project.fundingSources.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Funding Sources</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.fundingSources.map((fs) => (
              <FundingSourceCard key={fs.id} {...fs} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Budget Line Items</h2>
        <LineItemsTable
          lineItems={project.lineItems}
          isCatchAll={project.projectType === 'catch_all'}
          projectId={id}
          fundingSources={project.fundingSources}
          onUpdate={loadProject}
        />
      </section>
    </AppShell>
  )
}
