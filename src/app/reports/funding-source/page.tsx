'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState } from 'react'
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

interface FundingSourceOption {
  id: string
  name: string
  color: string
}

interface ProjectOption {
  id: string
  name: string
}

interface CategoryRow {
  categoryName: string
  allocated: number
  spent: number
  entries: { name: string; allocatedAmount: number }[]
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

export default function FundingSourceReport() {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [fundingSources, setFundingSources] = useState<FundingSourceOption[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedFsId, setSelectedFsId] = useState('')
  const [report, setReport] = useState<FundingSourceReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/funding-sources').then((r) => r.json()),
    ]).then(([projData, fsData]) => {
      const projList = projData.projects ?? []
      setProjects(projList)
      setFundingSources(fsData ?? [])
      if (projList.length > 0) setSelectedProjectId(projList[0].id)
      if (fsData?.length > 0) setSelectedFsId(fsData[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedProjectId || !selectedFsId) return
    setLoading(true)
    fetch(`/api/projects/${selectedProjectId}`).then((r) => r.json()).then((project) => {
      const fs = fundingSources.find((f) => f.id === selectedFsId)
      if (!fs || !project.categories) { setReport(null); setLoading(false); return }

      const categories: CategoryRow[] = []
      let totalAllocated = 0
      let totalSpent = 0

      for (const cat of project.categories) {
        const entries: { name: string; allocatedAmount: number }[] = []
        let catAllocated = 0

        for (const entry of cat.budgetEntries) {
          const alloc = entry.allocations.find((a: { fundingSourceId: string }) => a.fundingSourceId === selectedFsId)
          if (alloc) {
            entries.push({ name: entry.name, allocatedAmount: alloc.allocatedAmount })
            catAllocated += alloc.allocatedAmount
          }
        }

        const catSpent = cat.actuals
          .filter((a: { fundingSourceId: string | null }) => a.fundingSourceId === selectedFsId)
          .reduce((s: number, a: { amount: number }) => s + a.amount, 0)

        if (catAllocated > 0 || catSpent > 0) {
          categories.push({ categoryName: cat.name, allocated: catAllocated, spent: catSpent, entries })
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
  }, [selectedProjectId, selectedFsId, fundingSources])

  return (
    <AppShell>
      <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
        {/* Controls */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Funding Source Report</Typography>
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
          <Select
            value={selectedFsId}
            onChange={(e) => setSelectedFsId(e.target.value)}
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

            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Funding Source</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{report.fundingSource.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Allocated</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{fmt(report.totalAllocated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Spent</Typography>
                  <Typography sx={{ fontWeight: 700, color: 'info.main' }}>{fmt(report.totalSpent)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Remaining</Typography>
                  <Typography sx={{ fontWeight: 700, color: report.remaining < 0 ? 'error.main' : 'success.main' }}>
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
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Category / Line Item</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Allocated</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Spent</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.categories.map((cat) => (
                      <>
                        <TableRow key={cat.categoryName} sx={{ bgcolor: '#f5f7fa', '& td': { fontWeight: 600 } }}>
                          <TableCell>{cat.categoryName}</TableCell>
                          <TableCell align="right">{fmt(cat.allocated)}</TableCell>
                          <TableCell align="right">{fmt(cat.spent)}</TableCell>
                          <TableCell align="right" sx={{ color: cat.allocated - cat.spent < 0 ? 'error.main' : 'inherit' }}>
                            {fmt(cat.allocated - cat.spent)}
                          </TableCell>
                        </TableRow>
                        {cat.entries.map((entry) => (
                          <TableRow key={`${cat.categoryName}-${entry.name}`}>
                            <TableCell sx={{ pl: 4 }}>{entry.name}</TableCell>
                            <TableCell align="right">{fmt(entry.allocatedAmount)}</TableCell>
                            <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                            <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                    <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'primary.main' } }}>
                      <TableCell>TOTAL</TableCell>
                      <TableCell align="right">{fmt(report.totalAllocated)}</TableCell>
                      <TableCell align="right">{fmt(report.totalSpent)}</TableCell>
                      <TableCell align="right" sx={{ color: report.remaining < 0 ? 'error.main' : 'inherit' }}>
                        {fmt(report.remaining)}
                      </TableCell>
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
