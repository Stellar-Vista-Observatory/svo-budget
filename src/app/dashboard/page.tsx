'use client'

import { AppShell } from '@/components/layout/AppShell'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { useEffect, useState } from 'react'

interface FundingSourceSummary {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
}

interface ProjectCardData {
  id: string
  name: string
  projectType: string
  estimated: number
  secured: number
  spent: number
  fundingGap: number
  lineItemCount: number
  fundingSourceCount: number
  fundingSources: FundingSourceSummary[]
}

interface DashboardData {
  summary: {
    estimatedCosts: number
    securedFunding: number
    spentToDate: number
    remaining: number
  }
  projects: ProjectCardData[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Failed to load dashboard data'))
  }, [])

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-4 text-base mb-6">{error}</div>
      )}

      {data === null && !error && (
        <div className="text-slate-500 text-base">Loading…</div>
      )}

      {data && (
        <div className="space-y-6">
          <SummaryStrip {...data.summary} />

          {data.projects.length === 0 ? (
            <p className="text-slate-500 text-base">No projects yet. Sync QBO data from Settings to get started.</p>
          ) : (
            <div className="space-y-4">
              {data.projects.map((project) => (
                <ProjectCard key={project.id} {...project} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
