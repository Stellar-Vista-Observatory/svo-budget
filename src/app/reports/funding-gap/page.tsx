'use client'

import { AppShell } from '@/components/layout/AppShell'
import { computeFundingGap } from '@/lib/funding-gap'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'

interface AllocationItem {
  allocatedAmount: number
}

interface BudgetEntryItem {
  id: string
  name: string
  estimatedAmount: number
  allocations: AllocationItem[]
}

interface CategoryItem {
  id: string
  name: string
  budgetEntries: BudgetEntryItem[]
}

interface ProjectOption {
  id: string
  name: string
}

interface ProjectReport {
  id: string
  name: string
  totalEstimated: number
  totalSecured: number
  fundingGap: number
  categories: CategoryItem[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`)

export default function FundingGapReport() {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then((d) => {
      const list = d.projects ?? []
      setProjects(list)
      if (list.length > 0) setSelectedId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/projects/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d && Array.isArray(d.categories) ? d : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedId])

  const gap = useMemo(() => computeFundingGap(report?.categories ?? []), [report])

  return (
    <AppShell>
      <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Funding Gap</Typography>
          <Select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={!report}
            sx={{ ml: 'auto' }}
          >
            Export PDF
          </Button>
        </Stack>

        {loading && <CircularProgress />}

        {!loading && projects.length === 0 && (
          <Alert severity="info">No projects yet. Go to Settings to create a project and sync QBO data.</Alert>
        )}

        {report && !loading && gap.categories.length === 0 && (
          <Alert severity="success">
            No funding gap — every line item in this project is fully funded by its allocations.
          </Alert>
        )}

        {report && !loading && gap.categories.length > 0 && (
          <Box>
            {/* Print header */}
            <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>Stellar Vista Observatory</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{report.name} — Funding Gap</Typography>
              <Typography variant="body2" color="text.secondary">As of {new Date().toLocaleDateString()}</Typography>
            </Box>

            {/* Summary strip */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Underfunded Estimated</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(gap.totalEstimated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Allocated to Those Items</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(gap.totalAllocated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Funding Gap</Typography>
                  <Typography sx={{ fontWeight: 700, color: 'warning.main' }}>{fmt(gap.totalGap)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Contributing Line Items</Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {gap.categories.reduce((s, c) => s + c.entries.length, 0)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Reconciliation note — only when over-allocations make the gross
                gap shown here exceed the project's net funding gap. */}
            {gap.overAllocatedCount > 0 && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {gap.overAllocatedCount === 1
                  ? '1 line item is over-allocated by '
                  : `${gap.overAllocatedCount} line items are over-allocated by `}
                <strong>{fmt(gap.overAllocatedAmount)}</strong>, which offsets part of the shortfall above.
                Net project funding gap: <strong>{fmt(gap.netGap)}</strong>.
              </Alert>
            )}

            {/* Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1e3a5f', '& th': { color: 'white', fontWeight: 700 } }}>
                    <TableCell>Line Item</TableCell>
                    <TableCell align="right">Estimated</TableCell>
                    <TableCell align="right">Allocated</TableCell>
                    <TableCell align="right">Gap</TableCell>
                    <TableCell align="right">% Funded</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gap.categories.map((cat) => (
                    <Fragment key={cat.id}>
                      <TableRow sx={{ bgcolor: '#f5f7fa', '& td': { fontWeight: 600 } }}>
                        <TableCell>{cat.name}</TableCell>
                        <TableCell align="right">{fmt(cat.estimatedAmount)}</TableCell>
                        <TableCell align="right">{fmt(cat.allocated)}</TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main' }}>{fmt(cat.gap)}</TableCell>
                        <TableCell align="right">{pct(cat.allocated, cat.estimatedAmount)}</TableCell>
                      </TableRow>
                      {cat.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell sx={{ pl: 4 }}>{entry.name}</TableCell>
                          <TableCell align="right">{fmt(entry.estimatedAmount)}</TableCell>
                          <TableCell align="right">{fmt(entry.allocated)}</TableCell>
                          <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>{fmt(entry.gap)}</TableCell>
                          <TableCell align="right">{pct(entry.allocated, entry.estimatedAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {/* Total */}
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'primary.main' } }}>
                    <TableCell>TOTAL</TableCell>
                    <TableCell align="right">{fmt(gap.totalEstimated)}</TableCell>
                    <TableCell align="right">{fmt(gap.totalAllocated)}</TableCell>
                    <TableCell align="right" sx={{ color: 'warning.main' }}>{fmt(gap.totalGap)}</TableCell>
                    <TableCell align="right">{pct(gap.totalAllocated, gap.totalEstimated)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    </AppShell>
  )
}
