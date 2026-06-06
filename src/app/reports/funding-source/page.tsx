'use client'

import { AppShell } from '@/components/layout/AppShell'
import { applyActualSign } from '@/lib/formatting'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
import { Fragment, useEffect, useState } from 'react'
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
import LockIcon from '@mui/icons-material/Lock'
import PrintIcon from '@mui/icons-material/Print'

interface FundingSourceOption {
  id: string
  name: string
  color: string
}

interface ProjectOption {
  id: string
  name: string
}

interface ActualItem {
  date: string
  vendor: string | null
  memo: string | null
  amount: number
}

interface CategoryRow {
  categoryName: string
  allocated: number
  spent: number
  entries: { name: string; allocatedAmount: number }[]
  actuals: ActualItem[]
}

interface FundingSourceReportData {
  fundingSource: FundingSourceOption
  projectName: string
  totalAllocated: number
  totalSpent: number
  remaining: number
  categories: CategoryRow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export const pctSpent = (spent: number, budgeted: number): string => {
  if (budgeted === 0) return '—'
  return `${Math.round((spent / budgeted) * 100)}%`
}

export default function FundingSourceReport() {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [fundingSources, setFundingSources] = useState<FundingSourceOption[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedFsId, setSelectedFsId] = useState('')
  const [report, setReport] = useState<FundingSourceReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [listsLoaded, setListsLoaded] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const {
    showActualsAsNegative,
    reportFsProjectId,
    reportFsFundingSourceId,
    loaded,
    updatePreferences,
  } = useUserPreferences()

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/funding-sources').then((r) => r.json()),
    ]).then(([projData, fsData]) => {
      setProjects(projData.projects ?? [])
      setFundingSources(fsData ?? [])
      setListsLoaded(true)
    })
  }, [])

  // Apply saved selections once prefs and lists are both available. Wait for
  // `loaded` so saved selections aren't clobbered by the default-first-item logic.
  useEffect(() => {
    if (!loaded || !listsLoaded || hydrated) return
    if (projects.length > 0) {
      const savedProj =
        reportFsProjectId && projects.some((p) => p.id === reportFsProjectId)
          ? reportFsProjectId
          : projects[0].id
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProjectId(savedProj)
    }
    if (fundingSources.length > 0) {
      const savedFs =
        reportFsFundingSourceId && fundingSources.some((f) => f.id === reportFsFundingSourceId)
          ? reportFsFundingSourceId
          : fundingSources[0].id
      setSelectedFsId(savedFs)
    }
    setHydrated(true)
  }, [loaded, listsLoaded, hydrated, projects, fundingSources, reportFsProjectId, reportFsFundingSourceId])

  function handleSelectProject(id: string) {
    setSelectedProjectId(id)
    updatePreferences({ reportFsProjectId: id })
  }

  function handleSelectFs(id: string) {
    setSelectedFsId(id)
    updatePreferences({ reportFsFundingSourceId: id })
  }

  useEffect(() => {
    if (!selectedProjectId || !selectedFsId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/projects/${selectedProjectId}`)
      .then((r) => r.json())
      .then((project) => {
        const fs = fundingSources.find((f) => f.id === selectedFsId)
        if (!fs || !Array.isArray(project.categories)) {
          setReport(null)
          setLoading(false)
          return
        }

        const categories: CategoryRow[] = []
        let totalAllocated = 0
        let totalSpent = 0

        for (const cat of project.categories) {
          const entries: { name: string; allocatedAmount: number }[] = []
          let catAllocated = 0

          for (const entry of cat.budgetEntries ?? []) {
            const alloc = entry.allocations.find((a: { fundingSourceId: string }) => a.fundingSourceId === selectedFsId)
            if (alloc) {
              entries.push({ name: entry.name, allocatedAmount: alloc.allocatedAmount })
              catAllocated += alloc.allocatedAmount
            }
          }

          const catActuals: ActualItem[] = (cat.actuals ?? [])
            .filter((a: { fundingSourceId: string | null }) => a.fundingSourceId === selectedFsId)
            .map((a: { date: string; vendor: string | null; memo: string | null; amount: number }) => ({
              date: a.date,
              vendor: a.vendor,
              memo: a.memo,
              amount: a.amount,
            }))

          const catSpent = catActuals.reduce((s: number, a: ActualItem) => s + a.amount, 0)

          if (catAllocated > 0 || catSpent > 0) {
            categories.push({ categoryName: cat.name, allocated: catAllocated, spent: catSpent, entries, actuals: catActuals })
            totalAllocated += catAllocated
            totalSpent += catSpent
          }
        }

        setReport({
          fundingSource: fs,
          projectName: project.name,
          totalAllocated,
          totalSpent,
          remaining: totalAllocated - totalSpent,
          categories,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedProjectId, selectedFsId, fundingSources])

  return (
    <AppShell>
      <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
        {/* Controls */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Funding Source Report</Typography>
          <Select
            value={selectedProjectId}
            onChange={(e) => handleSelectProject(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
          <Select
            value={selectedFsId}
            onChange={(e) => handleSelectFs(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            {fundingSources.map((fs) => (
              <MenuItem key={fs.id} value={fs.id}>{fs.name}</MenuItem>
            ))}
          </Select>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={!report}
          >
            Export PDF
          </Button>
        </Stack>

        {loading && <CircularProgress />}

        {!loading && (projects.length === 0 || fundingSources.length === 0) && (
          <Alert severity="info">
            {projects.length === 0
              ? 'No projects yet. Go to Settings to create a project and sync QBO data.'
              : 'No funding sources yet. Sync QBO data from Settings to import classes as funding sources.'}
          </Alert>
        )}

        {report && !loading && (
          <Box>
            {/* Print header */}
            <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>Stellar Vista Observatory</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {report.projectName} — {report.fundingSource.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">As of {new Date().toLocaleDateString()}</Typography>
            </Box>

            {/* Summary strip */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Funding Source</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{report.fundingSource.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Budgeted</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalAllocated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Actuals</Typography>
                  <Typography sx={{ fontWeight: 700, color: showActualsAsNegative ? 'error.main' : undefined }}>
                    {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Remaining</Typography>
                  <Typography sx={{ fontWeight: 700, color: report.remaining < 0 ? 'error.main' : 'inherit' }}>
                    {fmt(report.remaining)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Table */}
            {report.categories.length > 0 ? (
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
                    {report.categories.map((cat) => (
                      <Fragment key={cat.categoryName}>
                        <TableRow sx={{ bgcolor: '#f5f7fa', '& td': { fontWeight: 600 } }}>
                          <TableCell>{cat.categoryName}</TableCell>
                          <TableCell align="right">{fmt(cat.allocated)}</TableCell>
                          <TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
                            {fmt(applyActualSign(cat.spent, showActualsAsNegative))}
                          </TableCell>
                          <TableCell align="right" sx={{ color: cat.allocated - cat.spent < 0 ? 'error.main' : 'inherit' }}>
                            {fmt(cat.allocated - cat.spent)}
                          </TableCell>
                          <TableCell align="right">{pctSpent(cat.spent, cat.allocated)}</TableCell>
                        </TableRow>

                        {cat.entries.length > 0 && (
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
                            {cat.entries.map((entry) => (
                              <TableRow key={`${cat.categoryName}-${entry.name}`}>
                                <TableCell sx={{ pl: 5 }}>{entry.name}</TableCell>
                                <TableCell align="right">{fmt(entry.allocatedAmount)}</TableCell>
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
                            {cat.actuals.map((actual, i) => (
                              <TableRow key={`${cat.categoryName}-actual-${actual.date}-${actual.amount}-${i}`}>
                                <TableCell sx={{ pl: 5 }}>
                                  {actual.date} {actual.vendor ?? actual.memo ?? '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                <TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
                                  {fmt(applyActualSign(actual.amount, showActualsAsNegative))}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                                <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}
                      </Fragment>
                    ))}
                    <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'primary.main' } }}>
                      <TableCell>TOTAL</TableCell>
                      <TableCell align="right">{fmt(report.totalAllocated)}</TableCell>
                      <TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
                        {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
                      </TableCell>
                      <TableCell align="right" sx={{ color: report.remaining < 0 ? 'error.main' : 'inherit' }}>
                        {fmt(report.remaining)}
                      </TableCell>
                      <TableCell align="right">{pctSpent(report.totalSpent, report.totalAllocated)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">
                No allocations or spending from this funding source in this project.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </AppShell>
  )
}
