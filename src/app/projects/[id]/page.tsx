'use client'

import { AppShell } from '@/components/layout/AppShell'
import { LineItemsTable } from '@/components/project/LineItemsTable'
import { applyActualSign } from '@/lib/formatting'
import { totalFundsAvailable } from '@/lib/computed'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

type BidStatusValue = 'bid' | 'not_bid' | null

interface BudgetEntryData {
  id: string
  name: string
  estimatedAmount: number
  bidStatus: BidStatusValue
  allocations: AllocationData[]
}

interface ActualData {
  id: string
  amount: number
  date: string
  vendor: string | null
  memo: string | null
  qboTransactionType: string
  bidStatus: BidStatusValue
  fundingSourceId: string | null
  fundingSourceName: string | null
  fundingSourceColor: string | null
}

interface CategoryData {
  id: string
  name: string
  qboAccountId: string | null
  sortOrder: number
  totalBudget: number
  totalSpent: number
  totalAllocated: number
  budgetEntries: BudgetEntryData[]
  actuals: ActualData[]
}

interface FundingSourceData {
  id: string
  name: string
  shortName: string | null
  color: string
  totalFunds: number
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
  categories: CategoryData[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: 'warn' | 'bad' | 'good' }) {
  const c = highlight === 'warn' ? { bg: '#fff3e0', border: '#ffb74d', text: '#e65100' }
          : highlight === 'bad'  ? { bg: '#fbe9e7', border: '#ef9a9a', text: '#c62828' }
          : highlight === 'good' ? { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' }
          : null
  return (
    <Box sx={{
      px: 1.5, py: 0.75, borderRadius: 1.5, minWidth: 110, textAlign: 'right',
      bgcolor: c ? c.bg : 'background.paper', border: '1px solid', borderColor: c ? c.border : 'divider',
    }}>
      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2, color: c ? c.text : 'text.secondary' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: c ? c.text : 'text.primary' }}>{value}</Typography>
    </Box>
  )
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [allFundingSources, setAllFundingSources] = useState<FundingSourceData[]>([])
  const [error, setError] = useState<string | null>(null)
  const { showActualsAsNegative } = useUserPreferences()

  const loadProject = useCallback(async () => {
    const [projRes, fsRes] = await Promise.all([
      fetch(`/api/projects/${id}`),
      fetch('/api/funding-sources'),
    ])
    if (!projRes.ok) { setError('Project not found'); return }
    const [proj, fs] = await Promise.all([projRes.json(), fsRes.json()])
    setProject(proj)
    setAllFundingSources(fs)
  }, [id])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  if (error) return (
    <AppShell>
      <Alert severity="error">{error}</Alert>
    </AppShell>
  )

  if (!project) return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    </AppShell>
  )

  const spentPct = pct(project.totalSpent, project.totalEstimated)
  const fundingGap = project.fundingGap
  const remaining = project.totalEstimated - project.totalSpent
  const totalFunds = totalFundsAvailable(allFundingSources)

  return (
    <AppShell>
      <Box sx={{ py: 2.5 }}>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 0.75 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography sx={{ fontSize: '0.875rem', '&:hover': { color: 'text.primary' } }} color="text.secondary">
              Projects
            </Typography>
          </Link>
          <Typography sx={{ fontSize: '0.875rem' }} color="text.primary">{project.name}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ mb: 0.25 }}>{project.name}</Typography>
            {project.description && (
              <Typography color="text.secondary" variant="body2">{project.description}</Typography>
            )}
          </Box>
          {project.fundingSources.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {project.fundingSources.map((fs) => (
                <Chip
                  key={fs.id}
                  size="small"
                  label={fs.name}
                  sx={{
                    bgcolor: fs.color + '22',
                    color: fs.color,
                    border: `1px solid ${fs.color}55`,
                    fontWeight: 600,
                    fontSize: '0.72rem',
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          <StatBox label="Total Funds Available" value={fmt(totalFunds)} />
          <StatBox label="Total Budget" value={fmt(project.totalEstimated)} />
          <StatBox label="Allocated" value={fmt(project.totalSecured)} highlight={fundingGap <= 0 ? 'good' : undefined} />
          {fundingGap > 0 && <StatBox label="Funding Gap" value={fmt(fundingGap)} highlight="warn" />}
          <StatBox
            label="Actuals To Date"
            value={fmt(applyActualSign(project.totalSpent, showActualsAsNegative))}
            highlight={showActualsAsNegative && project.totalSpent > 0 ? 'bad' : undefined}
          />
          <StatBox
            label="Remaining"
            value={fmt(remaining)}
            highlight={project.totalSpent === 0 ? undefined : remaining < 0 ? 'bad' : 'good'}
          />
          <Box sx={{
            display: 'flex', alignItems: 'center', flex: 1, minWidth: 150, px: 1.5, py: 0.75,
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
          }}>
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography variant="caption" color="text.secondary">Spent vs Budget</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{spentPct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(spentPct, 100)}
                sx={{
                  height: 5, borderRadius: 3, bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': { bgcolor: spentPct > 100 ? '#c62828' : spentPct > 85 ? '#f57c00' : '#388e3c' },
                }}
              />
            </Box>
          </Box>
        </Stack>

        <LineItemsTable
          categories={project.categories}
          projectId={id}
          fundingSources={allFundingSources}
          onUpdate={loadProject}
        />
      </Box>
    </AppShell>
  )
}
