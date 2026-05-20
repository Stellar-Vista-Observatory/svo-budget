'use client'

import { AppShell } from '@/components/layout/AppShell'
import { Fragment, useEffect, useState } from 'react'
import {
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

interface CategoryReport {
  id: string
  name: string
  totalBudget: number
  totalSpent: number
  totalAllocated: number
  budgetEntries: { id: string; name: string; estimatedAmount: number }[]
  actuals: { amount: number }[]
}

interface ProjectOption {
  id: string
  name: string
}

interface ProjectReport {
  id: string
  name: string
  description: string | null
  totalEstimated: number
  totalSecured: number
  totalSpent: number
  fundingGap: number
  categories: CategoryReport[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`)

export default function BudgetVsActualReport() {
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
    setLoading(true)
    fetch(`/api/projects/${selectedId}`).then((r) => r.json()).then((d) => {
      setReport(d)
      setLoading(false)
    })
  }, [selectedId])

  return (
    <AppShell>
      <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
        {/* Controls */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }} className="no-print">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Budget vs. Actual</Typography>
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

        {report && !loading && (
          <Box>
            {/* Print header */}
            <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>Stellar Vista Observatory</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{report.name} — Budget vs. Actual</Typography>
              <Typography variant="body2" color="text.secondary">As of {new Date().toLocaleDateString()}</Typography>
            </Box>

            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Estimated Costs</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalEstimated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Secured Funding</Typography>
                  <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(report.totalSecured)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Spent</Typography>
                  <Typography sx={{ fontWeight: 700, color: 'info.main' }}>{fmt(report.totalSpent)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {report.fundingGap > 0 ? 'Funding Gap' : 'Surplus'}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: report.fundingGap > 0 ? 'warning.main' : 'success.main' }}>
                    {fmt(Math.abs(report.fundingGap))}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Category / Line Item</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Estimated</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Spent</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>% Spent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.categories.map((cat) => {
                    const remaining = cat.totalBudget - cat.totalSpent
                    return (
                      <Fragment key={cat.id}>
                        <TableRow sx={{ bgcolor: '#f5f7fa', '& td': { fontWeight: 600 } }}>
                          <TableCell>{cat.name}</TableCell>
                          <TableCell align="right">{fmt(cat.totalBudget)}</TableCell>
                          <TableCell align="right">{fmt(cat.totalSpent)}</TableCell>
                          <TableCell align="right" sx={{ color: remaining < 0 ? 'error.main' : 'inherit' }}>
                            {fmt(remaining)}
                          </TableCell>
                          <TableCell align="right">{pct(cat.totalSpent, cat.totalBudget)}</TableCell>
                        </TableRow>
                        {cat.budgetEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell sx={{ pl: 4 }}>{entry.name}</TableCell>
                            <TableCell align="right">{fmt(entry.estimatedAmount)}</TableCell>
                            <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                            <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                            <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    )
                  })}
                  {/* Totals */}
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'primary.main' } }}>
                    <TableCell>TOTAL</TableCell>
                    <TableCell align="right">{fmt(report.totalEstimated)}</TableCell>
                    <TableCell align="right">{fmt(report.totalSpent)}</TableCell>
                    <TableCell align="right" sx={{ color: report.totalEstimated - report.totalSpent < 0 ? 'error.main' : 'inherit' }}>
                      {fmt(report.totalEstimated - report.totalSpent)}
                    </TableCell>
                    <TableCell align="right">{pct(report.totalSpent, report.totalEstimated)}</TableCell>
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
