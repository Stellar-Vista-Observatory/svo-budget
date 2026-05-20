'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState } from 'react'
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

interface FundingSourceOption {
  id: string
  name: string
  color: string
}

interface ProjectOption {
  id: string
  name: string
}

interface AllocationRow {
  budgetEntryId: string
  budgetEntryName: string
  categoryName: string
  allocatedAmount: number
  spent: number
}

interface FundingSourceReport {
  fundingSource: FundingSourceOption
  projectName: string
  totalAllocated: number
  totalSpent: number
  remaining: number
  allocations: AllocationRow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function FundingSourceReport() {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [fundingSources, setFundingSources] = useState<FundingSourceOption[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedFsId, setSelectedFsId] = useState('')
  const [report, setReport] = useState<FundingSourceReport | null>(null)
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

      const allocations: AllocationRow[] = []
      let totalAllocated = 0
      let totalSpent = 0

      for (const cat of project.categories) {
        for (const entry of cat.budgetEntries) {
          const alloc = entry.allocations.find((a: { fundingSourceId: string }) => a.fundingSourceId === selectedFsId)
          if (alloc) {
            const entrySpent = cat.actuals
              .filter((a: { fundingSourceId: string | null }) => a.fundingSourceId === selectedFsId)
              .reduce((s: number, a: { amount: number }) => s + a.amount, 0)

            allocations.push({
              budgetEntryId: entry.id,
              budgetEntryName: entry.name,
              categoryName: cat.name,
              allocatedAmount: alloc.allocatedAmount,
              spent: entrySpent,
            })
            totalAllocated += alloc.allocatedAmount
          }
        }

        // Also count spent from this source even if no budget entry allocation
        const catSpentFromSource = cat.actuals
          .filter((a: { fundingSourceId: string | null }) => a.fundingSourceId === selectedFsId)
          .reduce((s: number, a: { amount: number }) => s + a.amount, 0)
        totalSpent += catSpentFromSource
      }

      setReport({
        fundingSource: fs,
        projectName: project.name,
        totalAllocated,
        totalSpent,
        remaining: totalAllocated - totalSpent,
        allocations,
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
            {report.allocations.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Line Item</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Allocated</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Spent</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.allocations.map((row) => (
                      <TableRow key={row.budgetEntryId}>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>{row.budgetEntryName}</TableCell>
                        <TableCell align="right">{fmt(row.allocatedAmount)}</TableCell>
                        <TableCell align="right">{fmt(row.spent)}</TableCell>
                        <TableCell align="right" sx={{ color: row.allocatedAmount - row.spent < 0 ? 'error.main' : 'inherit' }}>
                          {fmt(row.allocatedAmount - row.spent)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'primary.main' } }}>
                      <TableCell colSpan={2}>TOTAL</TableCell>
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
                No allocations from this funding source in this project.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </AppShell>
  )
}
