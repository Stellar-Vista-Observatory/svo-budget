'use client'

import { AppShell } from '@/components/layout/AppShell'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material'

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
  estimated: number
  secured: number
  spent: number
  fundingGap: number
  lineItemCount: number
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
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {data === null && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {data && (
        <Stack spacing={3}>
          <SummaryStrip {...data.summary} />

          {data.projects.length === 0 ? (
            <Typography color="text.secondary">
              No projects yet. Sync QBO data from Settings to get started.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {data.projects.map((project) => (
                <ProjectCard key={project.id} {...project} />
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </AppShell>
  )
}
