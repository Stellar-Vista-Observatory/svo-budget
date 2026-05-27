'use client'

import { AppShell } from '@/components/layout/AppShell'
import { Fragment, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import PrintIcon from '@mui/icons-material/Print'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ActualItem {
  id: string
  amount: number
  date: string
  vendor: string | null
  memo: string | null
}

interface CategoryReport {
  id: string
  name: string
  totalBudget: number
  totalSpent: number
  totalAllocated: number
  budgetEntries: { id: string; name: string; estimatedAmount: number }[]
  actuals: ActualItem[]
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
  const [showDetail, setShowDetail] = useState(false)

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
        if (d && Array.isArray(d.categories)) {
          setReport(d)
        } else {
          setReport(null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedId])

  const chartData = report?.categories.map((cat) => {
    const remaining = cat.totalBudget - cat.totalSpent
    const isOverspent = remaining < 0
    return {
      name: cat.name.length > 15 ? cat.name.slice(0, 14) + '…' : cat.name,
      Actuals: cat.totalSpent,
      Remaining: isOverspent ? 0 : remaining,
      overspent: isOverspent,
    }
  }) ?? []

  return (
    <AppShell>
      <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
        {/* Controls */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
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
          <FormControlLabel
            control={<Switch checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} />}
            label="Show detail"
          />
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

        {report && !loading && report.categories.length === 0 && (
          <Alert severity="info">No budget data for this project. Sync QBO data from Settings, then add budget entries.</Alert>
        )}

        {report && !loading && report.categories.length > 0 && (
          <Box>
            {/* Print header */}
            <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>Stellar Vista Observatory</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{report.name} — Budget vs. Actual</Typography>
              <Typography variant="body2" color="text.secondary">As of {new Date().toLocaleDateString()}</Typography>
            </Box>

            {/* Summary strip */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Budgeted Costs</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalEstimated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Secured Funding</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalSecured)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Actuals</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalSpent)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {report.fundingGap > 0 ? 'Funding Gap' : 'Surplus'}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: report.fundingGap > 0 ? 'warning.main' : 'inherit' }}>
                    {fmt(Math.abs(report.fundingGap))}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Chart */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Budget Consumed by Category</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Legend />
                  <Bar dataKey="Actuals" stackId="a">
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.overspent ? '#dc2626' : '#3b82f6'} />
                    ))}
                  </Bar>
                  <Bar dataKey="Remaining" stackId="a" fill="#e2e8f0" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1e3a5f', '& th': { color: 'white', fontWeight: 700 } }}>
                    <TableCell>Expense</TableCell>
                    <TableCell align="right">Budgeted</TableCell>
                    <TableCell align="right">Actuals</TableCell>
                    <TableCell align="right">Remaining</TableCell>
                    <TableCell align="right">% Spent</TableCell>
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

                        {showDetail && (
                          <>
                            {cat.budgetEntries.length > 0 && (
                              <>
                                {/* BUDGETED sub-header */}
                                <TableRow>
                                  <TableCell
                                    colSpan={5}
                                    sx={{ pl: 3, py: 0.5, bgcolor: '#f8fafc', color: 'text.secondary',
                                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                                          textTransform: 'uppercase' }}
                                  >
                                    Budgeted
                                  </TableCell>
                                </TableRow>
                                {cat.budgetEntries.map((entry) => (
                                  <TableRow key={entry.id}>
                                    <TableCell sx={{ pl: 5 }}>{entry.name}</TableCell>
                                    <TableCell align="right">{fmt(entry.estimatedAmount)}</TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                  </TableRow>
                                ))}
                              </>
                            )}

                            {cat.actuals.length > 0 && (
                              <>
                                {/* ACTUALS sub-header */}
                                <TableRow>
                                  <TableCell
                                    colSpan={5}
                                    sx={{ pl: 3, py: 0.5, bgcolor: '#f8fafc', color: 'text.secondary',
                                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                                          textTransform: 'uppercase' }}
                                  >
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                      <LockIcon sx={{ fontSize: 11 }} />
                                      <span>Actuals · QBO Read only</span>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                                {cat.actuals.map((actual) => (
                                  <TableRow key={actual.id}>
                                    <TableCell sx={{ pl: 5 }}>
                                      {actual.date} {actual.vendor ?? actual.memo ?? '—'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                    <TableCell align="right">{fmt(actual.amount)}</TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                  </TableRow>
                                ))}
                              </>
                            )}
                          </>
                        )}
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
