'use client'

import React, { useState, useRef } from 'react'
import { useToast } from '@/components/ToastProvider'
import { applyActualSign } from '@/lib/formatting'
import { type BidStatusValue, nextBidStatus, bidStatusLabel } from '@/lib/bid-status'
import { fundingSourceLabel } from '@/lib/funding-source-label'
import { computeFundingSourceTotals } from '@/lib/funding-source-summary'
import { applyLineItemFilter, type LineItemFilterMode } from '@/lib/line-item-filters'
import { roundDollars } from '@/lib/money'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Input,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import LockIcon from '@mui/icons-material/Lock'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import PriceCheckIcon from '@mui/icons-material/PriceCheck'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

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

interface FundingSourceOption {
  id: string
  name: string
  shortName: string | null
  color: string
  totalFunds: number
}

interface LineItemsTableProps {
  categories: CategoryData[]
  projectId: string
  fundingSources: FundingSourceOption[]
  onUpdate: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`
}

function sortFundingSources(sources: FundingSourceOption[]): FundingSourceOption[] {
  return [...sources].sort((a, b) => {
    const aOwn = /own\s*funds?|svo\s*funds?/i.test(a.name) ? 1 : 0
    const bOwn = /own\s*funds?|svo\s*funds?/i.test(b.name) ? 1 : 0
    return aOwn - bOwn
  })
}

type ViewAction = 'collapse-all' | 'expand-all' | 'focus-budget' | 'focus-actuals' | 'summary'

const baseCellSx = {
  fontSize: '0.78rem',
  py: 0.4,
  px: 1,
  borderBottom: '1px solid',
  borderColor: '#e8e8e8',
  whiteSpace: 'nowrap' as const,
}

// ── Editable Cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  align = 'right',
  onCommit,
  indent,
}: {
  value: string
  align?: 'left' | 'right'
  onCommit: (v: string) => void
  indent?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear optimistic value when parent provides updated value
  if (optimistic !== null && value !== optimistic) setOptimistic(null)

  const displayValue = optimistic ?? value

  function start() {
    setDraft(displayValue)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    setEditing(false)
    if (draft !== displayValue) {
      setOptimistic(draft)
      onCommit(draft)
    }
  }

  const extraSx = indent ? { pl: indent } : {}

  if (editing) {
    return (
      <TableCell align={align} sx={{ ...baseCellSx, p: 0, ...extraSx }}>
        <Input
          inputRef={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          disableUnderline
          sx={{
            width: '100%',
            fontSize: '0.78rem',
            px: 1,
            py: 0.4,
            bgcolor: '#fff',
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 0.5,
            '& input': { textAlign: align, p: 0 },
          }}
        />
      </TableCell>
    )
  }

  return (
    <TableCell
      align={align}
      onClick={start}
      sx={{
        ...baseCellSx,
        ...extraSx,
        cursor: 'text',
        '&:hover': {
          bgcolor: '#f0f7ff',
          outline: '1.5px dashed',
          outlineColor: 'primary.light',
          outlineOffset: '-2px',
        },
      }}
    >
      <Typography sx={{ fontSize: '0.78rem' }}>{displayValue}</Typography>
    </TableCell>
  )
}

// ── Allocation Bar ────────────────────────────────────────────────────────────

function AllocationBar({
  allocations,
  fundingSources,
  total,
}: {
  allocations: Record<string, number>
  fundingSources: FundingSourceOption[]
  total: number
}) {
  if (total === 0) return null
  return (
    <Tooltip
      title={
        <Box>
          {fundingSources.map((fs) => {
            const v = allocations[fs.id] ?? 0
            if (v === 0) return null
            return (
              <Box key={fs.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.3 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: fs.color, flexShrink: 0 }} />
                <Typography variant="caption">{fs.name}: {fmt(v)}</Typography>
              </Box>
            )
          })}
        </Box>
      }
    >
      <Box sx={{ display: 'flex', height: 5, borderRadius: 2, overflow: 'hidden', width: 36, flexShrink: 0, cursor: 'default' }}>
        {fundingSources.map((fs) => {
          const v = allocations[fs.id] ?? 0
          const w = pct(v, total)
          if (w === 0) return null
          return <Box key={fs.id} sx={{ width: `${w}%`, bgcolor: fs.color }} />
        })}
      </Box>
    </Tooltip>
  )
}

// ── Bid Status Chip ───────────────────────────────────────────────────────────

function BidChip({ status, onChange }: { status: BidStatusValue; onChange: (next: BidStatusValue) => void }) {
  // Optimistic value so the chip updates instantly on click instead of waiting
  // for the PATCH + project refetch to round-trip. `undefined` means "no pending
  // optimistic value"; `null` is a real, displayable status.
  const [optimistic, setOptimistic] = useState<BidStatusValue | undefined>(undefined)
  if (optimistic !== undefined && status === optimistic) setOptimistic(undefined)

  const displayed = optimistic !== undefined ? optimistic : status
  const cfg =
    displayed === 'bid'
      ? { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' }
      : displayed === 'not_bid'
        ? { bg: '#eceff1', color: '#546e7a', border: '#cfd8dc' }
        : { bg: 'transparent', color: '#bbb', border: '#e0e0e0' }

  return (
    <Tooltip title="Bid status — click to cycle (Bid → Not bid → unset)">
      <Chip
        size="small"
        label={bidStatusLabel(displayed)}
        onClick={(e) => {
          e.stopPropagation()
          const next = nextBidStatus(displayed)
          setOptimistic(next)
          onChange(next)
        }}
        sx={{
          height: 18,
          fontSize: '0.62rem',
          fontWeight: 600,
          cursor: 'pointer',
          bgcolor: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Tooltip>
  )
}

// ── Budget Section ────────────────────────────────────────────────────────────

function BudgetSection({
  category,
  fundingSources,
  signal,
  onPatchEntry,
  onUpdateAllocation,
  onAddEntry,
  onDeleteEntry,
  onSetEntryBid,
}: {
  category: CategoryData
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
  onPatchEntry: (id: string, patch: Record<string, unknown>) => void
  onUpdateAllocation: (entryId: string, fundingSourceId: string, existingAllocId: string | null, amount: number) => void
  onAddEntry: (categoryId: string, name: string) => void
  onDeleteEntry: (id: string) => void
  onSetEntryBid: (id: string, status: BidStatusValue) => void
}) {
  const budgetInitialOpen = signal.action !== 'collapse-all' && signal.action !== 'focus-actuals' && signal.action !== 'summary'
  const [open, setOpen] = useState(budgetInitialOpen)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const addRef = useRef<HTMLInputElement>(null)
  const [seenSignal, setSeenSignal] = useState(signal.count)

  if (signal.count !== seenSignal) {
    setSeenSignal(signal.count)
    if (signal.action === 'expand-all' || signal.action === 'focus-budget') setOpen(true)
    else if (signal.action === 'collapse-all' || signal.action === 'focus-actuals' || signal.action === 'summary') setOpen(false)
  }

  const { budgetEntries } = category
  const totalBudget = budgetEntries.reduce((s, e) => s + e.estimatedAmount, 0)
  const totalAllocated = budgetEntries.reduce(
    (s, e) => s + e.allocations.reduce((a, alloc) => a + alloc.allocatedAmount, 0), 0
  )
  const allocBySource: Record<string, number> = {}
  for (const fs of fundingSources) {
    allocBySource[fs.id] = budgetEntries.reduce(
      (s, e) => s + (e.allocations.find((a) => a.fundingSourceId === fs.id)?.allocatedAmount ?? 0), 0
    )
  }
  const coverageDelta = totalBudget - totalAllocated

  const subHdrSx = { ...baseCellSx, py: 0.35, bgcolor: '#f0f4f8', fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }

  function handleAddEntry() {
    if (newName.trim()) {
      onAddEntry(category.id, newName.trim())
      setNewName('')
      setAdding(false)
    }
  }

  return (
    <>
      <TableRow sx={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <TableCell sx={subHdrSx} />
        <TableCell sx={{ ...subHdrSx, pl: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" sx={{ p: 0.15 }}>
              {open ? <KeyboardArrowDownIcon sx={{ fontSize: 13 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 13 }} />}
            </IconButton>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Budgeted
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: '11px !important' }} />}
              onClick={(e) => { e.stopPropagation(); setAdding(true); setOpen(true); setTimeout(() => addRef.current?.focus(), 0) }}
              sx={{ fontSize: '0.68rem', color: 'primary.main', py: 0.15, px: 0.6, minWidth: 0, textTransform: 'none', '&:hover': { bgcolor: '#e3f2fd' } }}
            >
              Add line item
            </Button>
          </Box>
        </TableCell>
        <TableCell align="right" sx={{ ...subHdrSx, color: 'text.disabled', fontStyle: 'italic' }}>
          {fmt(totalBudget)}
        </TableCell>
        {fundingSources.map((fs) => (
          <TableCell key={fs.id} align="right" sx={{ ...subHdrSx, borderLeft: `2px solid ${fs.color}33` }}>
            {allocBySource[fs.id] > 0 ? fmt(allocBySource[fs.id]) : <span style={{ color: '#ccc' }}>—</span>}
          </TableCell>
        ))}
        <TableCell align="right" sx={subHdrSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <AllocationBar allocations={allocBySource} fundingSources={fundingSources} total={totalAllocated} />
            {fmt(totalAllocated)}
          </Box>
        </TableCell>
        <TableCell align="right" sx={{ ...subHdrSx, color: coverageDelta === 0 ? '#2e7d32' : coverageDelta > 0 ? '#e65100' : '#1565c0' }}>
          {coverageDelta === 0 ? '—' : fmt(Math.abs(coverageDelta)) + (coverageDelta > 0 ? ' gap' : ' over')}
        </TableCell>
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
      </TableRow>

      {open && budgetEntries.map((entry) => {
        const allocMap: Record<string, number> = {}
        const allocIdMap: Record<string, string> = {}
        for (const a of entry.allocations) {
          allocMap[a.fundingSourceId] = a.allocatedAmount
          allocIdMap[a.fundingSourceId] = a.id
        }
        const allocated = entry.allocations.reduce((s, a) => s + a.allocatedAmount, 0)
        const entryCoverage = entry.estimatedAmount - allocated

        return (
          <TableRow key={entry.id} sx={{ bgcolor: '#fafafa', '&:hover': { bgcolor: '#eef6ff' } }}>
            <TableCell align="center" sx={{ ...baseCellSx, px: 0.5 }}>
              <BidChip
                status={entry.bidStatus}
                onChange={(next) => onSetEntryBid(entry.id, next)}
              />
            </TableCell>
            <EditableCell
              value={entry.name}
              align="left"
              onCommit={(v) => { if (v.trim() && v.trim() !== entry.name) onPatchEntry(entry.id, { name: v.trim() }) }}
              indent={4}
            />
            <EditableCell
              value={fmt(entry.estimatedAmount)}
              align="right"
              onCommit={(v) => {
                const num = parseFloat(v.replace(/[^0-9.-]/g, ''))
                if (!isNaN(num)) onPatchEntry(entry.id, { estimatedAmount: num })
              }}
            />
            {fundingSources.map((fs) => (
              <EditableCell
                key={fs.id}
                value={allocMap[fs.id] ? fmt(allocMap[fs.id]) : '—'}
                align="right"
                onCommit={(v) => {
                  const num = parseFloat(v.replace(/[^0-9.-]/g, ''))
                  onUpdateAllocation(entry.id, fs.id, allocIdMap[fs.id] ?? null, isNaN(num) ? 0 : num)
                }}
              />
            ))}
            <TableCell align="right" sx={baseCellSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                <AllocationBar allocations={allocMap} fundingSources={fundingSources} total={allocated} />
                <Typography sx={{ fontSize: '0.78rem' }}>{allocated > 0 ? fmt(allocated) : <span style={{ color: '#bbb' }}>—</span>}</Typography>
              </Box>
            </TableCell>
            <TableCell align="right" sx={baseCellSx}>
              {entryCoverage === 0
                ? <Typography sx={{ fontSize: '0.78rem', color: '#2e7d32' }}>—</Typography>
                : <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: entryCoverage > 0 ? '#e65100' : '#1565c0' }}>
                    {fmt(Math.abs(entryCoverage))}{entryCoverage > 0 ? ' gap' : ' over'}
                  </Typography>
              }
            </TableCell>
            <TableCell sx={baseCellSx} />
            <TableCell sx={baseCellSx} />
            <TableCell sx={{ ...baseCellSx, px: 0.5 }}>
              <Tooltip title="Delete line item">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                  sx={{ p: 0.3, opacity: 0, color: 'text.secondary', 'tr:hover &': { opacity: 1 }, '&:hover': { color: 'error.main' } }}
                >
                  <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        )
      })}

      {open && adding && (
        <TableRow sx={{ bgcolor: '#fafafa' }}>
          <TableCell sx={baseCellSx} />
          <TableCell sx={{ ...baseCellSx, pl: 4, p: 0 }} colSpan={fundingSources.length + 7}>
            <Input
              inputRef={addRef}
              placeholder="New line item name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setAdding(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddEntry()
                if (e.key === 'Escape') { setAdding(false); setNewName('') }
              }}
              disableUnderline
              sx={{ width: '100%', fontSize: '0.78rem', px: 1, py: 0.4 }}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── Actuals Section ───────────────────────────────────────────────────────────

function ActualsSection({
  actuals,
  fundingSources,
  signal,
  onSetActualBid,
}: {
  actuals: ActualData[]
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
  onSetActualBid: (id: string, status: BidStatusValue) => void
}) {
  const actualsInitialOpen = signal.action !== 'collapse-all' && signal.action !== 'focus-budget' && signal.action !== 'summary'
  const [open, setOpen] = useState(actualsInitialOpen)
  const [seenSignal, setSeenSignal] = useState(signal.count)

  if (signal.count !== seenSignal) {
    setSeenSignal(signal.count)
    if (signal.action === 'expand-all' || signal.action === 'focus-actuals') setOpen(true)
    else if (signal.action === 'collapse-all' || signal.action === 'focus-budget' || signal.action === 'summary') setOpen(false)
  }

  const { showActualsAsNegative } = useUserPreferences()

  if (actuals.length === 0) return null

  const totalActual = actuals.reduce((s, a) => s + a.amount, 0)
  const actualBySourceId: Record<string, number> = {}
  for (const fs of fundingSources) {
    actualBySourceId[fs.id] = actuals
      .filter((a) => a.fundingSourceId === fs.id)
      .reduce((s, a) => s + a.amount, 0)
  }

  const subHdrSx = { ...baseCellSx, py: 0.35, bgcolor: '#f0f4f8', fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }

  return (
    <>
      <TableRow sx={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <TableCell sx={subHdrSx} />
        <TableCell sx={{ ...subHdrSx, pl: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" sx={{ p: 0.15 }}>
              {open ? <KeyboardArrowDownIcon sx={{ fontSize: 13 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 13 }} />}
            </IconButton>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Actuals
            </Typography>
            <Chip
              size="small"
              icon={<LockIcon sx={{ fontSize: '9px !important' }} />}
              label="QBO · Read only"
              sx={{ height: 16, fontSize: '0.62rem', bgcolor: '#f3e5f5', color: '#6a1b9a', border: '1px solid #ce93d8', '& .MuiChip-icon': { color: '#6a1b9a' } }}
            />
          </Box>
        </TableCell>
        <TableCell sx={subHdrSx} />
        {fundingSources.map((fs) => (
          <TableCell key={fs.id} align="right" sx={{ ...subHdrSx, borderLeft: `2px solid ${fs.color}33` }}>
            {actualBySourceId[fs.id] > 0
              ? <Typography component="span" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
                  {fmt(applyActualSign(actualBySourceId[fs.id], showActualsAsNegative))}
                </Typography>
              : <span style={{ color: '#ccc' }}>—</span>}
          </TableCell>
        ))}
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
        <TableCell align="right" sx={{ ...subHdrSx, color: showActualsAsNegative ? 'error.main' : undefined }}>
          {fmt(applyActualSign(totalActual, showActualsAsNegative))}
        </TableCell>
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
      </TableRow>

      {open && actuals.map((a) => (
        <TableRow key={a.id} sx={{ bgcolor: '#fafafa', '&:hover': { bgcolor: '#fffde7' } }}>
          <TableCell align="center" sx={{ ...baseCellSx, px: 0.5 }}>
            <BidChip status={a.bidStatus} onChange={(next) => onSetActualBid(a.id, next)} />
          </TableCell>
          <TableCell sx={{ ...baseCellSx, pl: 4 }}>
            <Tooltip title={a.memo || ''} disableHoverListener={!a.memo} arrow>
              <Typography sx={{ fontSize: '0.78rem' }}>
                <Box component="span" sx={{ color: 'text.disabled', fontSize: '0.72rem', mr: 0.75 }}>
                  {fmtDate(a.date)}
                </Box>
                {a.vendor ?? a.qboTransactionType}
              </Typography>
            </Tooltip>
          </TableCell>
          <TableCell sx={baseCellSx} />
          {fundingSources.map((fs) => (
            <TableCell key={fs.id} align="right" sx={{ ...baseCellSx, borderLeft: `2px solid ${fs.color}22` }}>
              {fs.id === a.fundingSourceId
                ? <Typography sx={{ fontSize: '0.78rem', color: showActualsAsNegative ? 'error.main' : a.fundingSourceColor, fontWeight: 500 }}>
                    {fmt(applyActualSign(a.amount, showActualsAsNegative))}
                  </Typography>
                : <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>—</Typography>
              }
            </TableCell>
          ))}
          <TableCell sx={baseCellSx} />
          <TableCell sx={baseCellSx} />
          <TableCell align="right" sx={baseCellSx}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: showActualsAsNegative ? 'error.main' : undefined }}>
              {fmt(applyActualSign(a.amount, showActualsAsNegative))}
            </Typography>
          </TableCell>
          <TableCell sx={baseCellSx} />
          <TableCell sx={baseCellSx} />
        </TableRow>
      ))}
    </>
  )
}

// ── Category Row ──────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  fundingSources,
  signal,
  onPatchEntry,
  onUpdateAllocation,
  onAddEntry,
  onDeleteEntry,
  onSetEntryBid,
  onSetActualBid,
}: {
  category: CategoryData
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
  onPatchEntry: (id: string, patch: Record<string, unknown>) => void
  onUpdateAllocation: (entryId: string, fundingSourceId: string, existingAllocId: string | null, amount: number) => void
  onAddEntry: (categoryId: string, name: string) => void
  onDeleteEntry: (id: string) => void
  onSetEntryBid: (id: string, status: BidStatusValue) => void
  onSetActualBid: (id: string, status: BidStatusValue) => void
}) {
  const [open, setOpen] = useState(true)
  const [seenSignal, setSeenSignal] = useState(signal.count)
  const { showActualsAsNegative } = useUserPreferences()

  if (signal.count !== seenSignal) {
    setSeenSignal(signal.count)
    if (signal.action === 'collapse-all') setOpen(false)
    else setOpen(true)
  }

  const { totalBudget, totalSpent, totalAllocated } = category
  const coverageDelta = totalBudget - totalAllocated
  const remaining = totalBudget - totalSpent
  const isOverspent = remaining < 0
  const spentPct = pct(totalSpent, totalBudget)

  const fsRemaining: Record<string, number> = {}
  for (const fs of fundingSources) {
    const allocated = category.budgetEntries.reduce(
      (s, e) => s + (e.allocations.find((a) => a.fundingSourceId === fs.id)?.allocatedAmount ?? 0), 0
    )
    const spent = category.actuals
      .filter((a) => a.fundingSourceId === fs.id)
      .reduce((s, a) => s + a.amount, 0)
    fsRemaining[fs.id] = roundDollars(allocated - spent)
  }

  const hdrSx = {
    py: 0.75,
    fontWeight: 700,
    fontSize: '0.82rem',
    px: 1,
    bgcolor: '#eef2f7',
    borderTop: '1px solid',
    borderTopColor: '#ddd',
    borderBottom: '1px solid',
    borderBottomColor: '#ddd',
  }

  return (
    <>
      <TableRow sx={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <TableCell sx={hdrSx} />
        <TableCell sx={hdrSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" sx={{ p: 0.2 }}>
              {open ? <KeyboardArrowDownIcon sx={{ fontSize: 14 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 14 }} />}
            </IconButton>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{category.name}</Typography>
            <Chip size="small" label={`${category.budgetEntries.length}`} sx={{ height: 16, fontSize: '0.6rem', ml: 0.25 }} />
            {category.actuals.length > 0 && (
              <Chip size="small" label={`${category.actuals.length} act.`} sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100' }} />
            )}
          </Box>
        </TableCell>
        <TableCell align="right" sx={hdrSx}>{fmt(totalBudget)}</TableCell>
        {fundingSources.map((fs) => {
          const rem = fsRemaining[fs.id]
          const fsOverspent = rem < 0
          const fsEmpty = rem === 0 && !category.actuals.some((a) => a.fundingSourceId === fs.id) && !category.budgetEntries.some((e) => e.allocations.some((a) => a.fundingSourceId === fs.id))
          return (
            <TableCell
              key={fs.id}
              align="right"
              sx={{
                ...hdrSx,
                borderLeft: `2px solid ${fs.color}33`,
                bgcolor: fsOverspent ? '#fef2f2' : hdrSx.bgcolor,
              }}
            >
              {fsEmpty ? null : fsOverspent ? (
                <Chip
                  label={`−${fmt(Math.abs(rem))}`}
                  size="small"
                  sx={{ bgcolor: '#dc2626', color: 'white', fontWeight: 700, height: 18, fontSize: '0.68rem' }}
                />
              ) : (
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: rem === 0 ? 'text.disabled' : 'inherit' }}>
                  {rem === 0 ? '—' : fmt(rem)}
                </Typography>
              )}
            </TableCell>
          )
        })}
        <TableCell align="right" sx={hdrSx}>{fmt(totalAllocated)}</TableCell>
        <TableCell align="right" sx={{ ...hdrSx, color: coverageDelta === 0 ? '#2e7d32' : coverageDelta > 0 ? '#e65100' : '#1565c0', fontSize: '0.78rem' }}>
          {coverageDelta === 0 ? '—' : fmt(Math.abs(coverageDelta)) + (coverageDelta > 0 ? ' gap' : ' over')}
        </TableCell>
        <TableCell align="right" sx={hdrSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            {totalBudget > 0 && (
              <Box sx={{ width: 44 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(spentPct, 100)}
                  sx={{
                    height: 4, borderRadius: 2, bgcolor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': { bgcolor: spentPct > 100 ? '#c62828' : spentPct > 85 ? '#f57c00' : '#388e3c' },
                  }}
                />
              </Box>
            )}
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: totalSpent === 0 ? undefined : showActualsAsNegative ? 'error.main' : undefined }}>
              {totalSpent === 0
                ? <span style={{ color: '#9e9e9e' }}>$0</span>
                : fmt(applyActualSign(totalSpent, showActualsAsNegative))}
            </Typography>
          </Box>
        </TableCell>
        <TableCell
          align="right"
          sx={{
            ...hdrSx,
            bgcolor: isOverspent ? '#fef2f2' : hdrSx.bgcolor,
            borderLeft: isOverspent ? '3px solid #dc2626' : undefined,
          }}
        >
          {isOverspent ? (
            <Chip
              label={`Overspent ${fmt(Math.abs(remaining))}`}
              size="small"
              sx={{ bgcolor: '#dc2626', color: 'white', fontWeight: 700 }}
            />
          ) : (
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: remaining === 0 && totalBudget === 0 ? 'text.disabled' : 'inherit' }}>
              {totalBudget === 0 && totalSpent === 0 ? <span style={{ color: '#9e9e9e' }}>—</span> : fmt(remaining)}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={hdrSx} />
      </TableRow>

      {open && (
        <>
          <BudgetSection
            category={category}
            fundingSources={fundingSources}
            signal={signal}
            onPatchEntry={onPatchEntry}
            onUpdateAllocation={onUpdateAllocation}
            onAddEntry={onAddEntry}
            onDeleteEntry={onDeleteEntry}
            onSetEntryBid={onSetEntryBid}
          />
          <ActualsSection
            actuals={category.actuals}
            fundingSources={fundingSources}
            signal={signal}
            onSetActualBid={onSetActualBid}
          />
        </>
      )}
    </>
  )
}

// ── Funding Sources Summary ───────────────────────────────────────────────────

function FundingSourceSummary({ categories, fundingSources }: { categories: CategoryData[]; fundingSources: FundingSourceOption[] }) {
  const { showActualsAsNegative } = useUserPreferences()
  const { rows, totals } = computeFundingSourceTotals(categories, fundingSources.map((fs) => fs.id))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const totalFundsAll = fundingSources.reduce((s, fs) => s + fs.totalFunds, 0)

  const headSx = { fontSize: '0.66rem', fontWeight: 700, color: 'text.secondary', py: 0.5, px: 1.25, textTransform: 'uppercase' as const, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }
  const cellSx = { fontSize: '0.78rem', py: 0.4, px: 1.25, whiteSpace: 'nowrap' as const }
  const dash = <span style={{ color: '#bbb' }}>—</span>
  const withdrawnText = (n: number) => (n > 0 ? fmt(applyActualSign(n, showActualsAsNegative)) : dash)

  return (
    <Box sx={{ mb: 1.5 }}>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f0f4f8' }}>
              <TableCell sx={headSx}>Funding Source</TableCell>
              <TableCell align="right" sx={headSx}>Total Funds</TableCell>
              <TableCell align="right" sx={headSx}>Allocated</TableCell>
              <TableCell align="right" sx={headSx}>Withdrawn</TableCell>
              <TableCell align="right" sx={headSx}>
                <Box>Remaining</Box>
                <Box sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.disabled', textTransform: 'none', letterSpacing: 0 }}>Funds−Withdrawn</Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fundingSources.map((fs) => {
              const row = byId.get(fs.id) ?? { allocated: 0, withdrawn: 0 }
              const hasFunds = fs.totalFunds > 0
              const remaining = roundDollars(fs.totalFunds - row.withdrawn)
              return (
                <TableRow key={fs.id}>
                  <TableCell sx={cellSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: fs.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{fundingSourceLabel(fs.name, fs.shortName)}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{fs.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>{hasFunds ? fmt(fs.totalFunds) : dash}</TableCell>
                  <TableCell align="right" sx={cellSx}>{row.allocated > 0 ? fmt(row.allocated) : dash}</TableCell>
                  <TableCell align="right" sx={{ ...cellSx, color: row.withdrawn > 0 && showActualsAsNegative ? 'error.main' : undefined }}>
                    {withdrawnText(row.withdrawn)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...cellSx, fontWeight: 600, color: hasFunds && remaining < 0 ? '#dc2626' : 'inherit' }}>
                    {hasFunds ? fmt(remaining) : dash}
                  </TableCell>
                </TableRow>
              )
            })}
            <TableRow sx={{ bgcolor: '#e8eaf6' }}>
              <TableCell sx={{ ...cellSx, fontWeight: 700 }}>TOTAL</TableCell>
              <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>{fmt(totalFundsAll)}</TableCell>
              <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>{fmt(totals.allocated)}</TableCell>
              <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, color: totals.withdrawn > 0 && showActualsAsNegative ? 'error.main' : undefined }}>
                {fmt(applyActualSign(totals.withdrawn, showActualsAsNegative))}
              </TableCell>
              <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, color: roundDollars(totalFundsAll - totals.withdrawn) < 0 ? '#dc2626' : 'inherit' }}>
                {fmt(roundDollars(totalFundsAll - totals.withdrawn))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

// ── Totals Row ────────────────────────────────────────────────────────────────

function TotalsRow({ categories, fundingSources }: { categories: CategoryData[]; fundingSources: FundingSourceOption[] }) {
  const { showActualsAsNegative } = useUserPreferences()
  const totalBudget = categories.reduce((s, c) => s + c.totalBudget, 0)
  const totalAllocated = categories.reduce((s, c) => s + c.totalAllocated, 0)
  const totalActual = categories.reduce((s, c) => s + c.totalSpent, 0)
  const coverageDelta = totalBudget - totalAllocated
  const remaining = totalBudget - totalActual

  // Per-source grand totals: net = allocated − withdrawn, matching the
  // allocated−spent figure shown in each category header row.
  const { rows: fsRows } = computeFundingSourceTotals(categories, fundingSources.map((fs) => fs.id))
  const fsNetById = new Map(fsRows.map((r) => [r.id, { net: roundDollars(r.allocated - r.withdrawn), active: r.allocated !== 0 || r.withdrawn !== 0 }]))

  const cellSx = {
    py: 1, fontWeight: 700, fontSize: '0.82rem', px: 1,
    bgcolor: '#e8eaf6', borderTop: '3px solid', borderColor: 'primary.main',
  }

  return (
    <TableRow>
      <TableCell sx={cellSx} />
      <TableCell sx={cellSx}>TOTAL</TableCell>
      <TableCell align="right" sx={cellSx}>{fmt(totalBudget)}</TableCell>
      {fundingSources.map((fs) => {
        const fsTotal = fsNetById.get(fs.id) ?? { net: 0, active: false }
        return (
          <TableCell
            key={fs.id}
            align="right"
            sx={{ ...cellSx, borderLeft: `2px solid ${fs.color}44`, color: fsTotal.net < 0 ? '#dc2626' : undefined }}
          >
            {fsTotal.active ? fmt(fsTotal.net) : <span style={{ color: '#bbb' }}>—</span>}
          </TableCell>
        )
      })}
      <TableCell align="right" sx={cellSx}>{fmt(totalAllocated)}</TableCell>
      <TableCell align="right" sx={{ ...cellSx, color: coverageDelta === 0 ? '#2e7d32' : coverageDelta > 0 ? '#e65100' : '#1565c0' }}>
        {coverageDelta === 0 ? '—' : fmt(Math.abs(coverageDelta)) + (coverageDelta > 0 ? ' gap' : ' over')}
      </TableCell>
      <TableCell align="right" sx={{ ...cellSx, color: showActualsAsNegative ? 'error.main' : undefined }}>
        {fmt(applyActualSign(totalActual, showActualsAsNegative))}
      </TableCell>
      <TableCell align="right" sx={{ ...cellSx, color: remaining < 0 ? '#dc2626' : '#2e7d32' }}>
        {fmt(remaining)}
      </TableCell>
      <TableCell sx={cellSx} />
    </TableRow>
  )
}

// ── Main Table ────────────────────────────────────────────────────────────────

export function LineItemsTable({ categories, fundingSources: rawFundingSources, onUpdate }: LineItemsTableProps) {
  const fundingSources = React.useMemo(() => sortFundingSources(rawFundingSources), [rawFundingSources])
  const [signal, setSignal] = useState<{ count: number; action: ViewAction }>({ count: 0, action: 'expand-all' })
  const [filterMode, setFilterMode] = useState<LineItemFilterMode>('none')
  const { toast } = useToast()

  // Momentary view filters ('gap' | 'bid' | 'not_bid') narrow the table to the
  // matching rows with category totals recomputed from what's left. The filter
  // is cleared by any of the view-action buttons (see `dispatch`), matching the
  // momentary feel of the other buttons.
  const displayCategories = React.useMemo(
    () => applyLineItemFilter(categories, filterMode),
    [categories, filterMode]
  )

  // View actions are momentary and also reset any active filter — clicking any
  // of them is the "off switch" for the filters.
  function dispatch(action: ViewAction) {
    setSignal((s) => ({ count: s.count + 1, action }))
    setFilterMode('none')
  }

  // Filter buttons apply their mode and expand everything so the matching rows
  // are immediately visible.
  function applyFilter(mode: LineItemFilterMode) {
    setFilterMode(mode)
    setSignal((s) => ({ count: s.count + 1, action: 'expand-all' }))
  }

  function handleResponse(res: Response, successMsg: string) {
    if (res.ok) {
      if (successMsg) toast(successMsg)
      onUpdate()
    } else {
      res.json().then((d) => toast(d.error ?? 'Operation failed', 'error')).catch(() => toast('Operation failed', 'error'))
    }
  }

  function patchEntry(id: string, patch: Record<string, unknown>) {
    fetch(`/api/line-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => handleResponse(r, 'Saved'))
      .catch(() => toast('Network error', 'error'))
  }

  function updateAllocation(entryId: string, fundingSourceId: string, existingAllocId: string | null, amount: number) {
    const req = amount <= 0 && existingAllocId
      ? fetch(`/api/funding-allocations/${existingAllocId}`, { method: 'DELETE' })
      : amount > 0 && existingAllocId
        ? fetch(`/api/funding-allocations/${existingAllocId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allocatedAmount: amount }) })
        : amount > 0
          ? fetch(`/api/line-items/${entryId}/allocations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fundingSourceId, allocatedAmount: amount }) })
          : null
    if (req) req.then((r) => handleResponse(r, 'Allocation updated')).catch(() => toast('Network error', 'error'))
  }

  function setEntryBid(id: string, status: BidStatusValue) {
    // No success toast: the chip already reflects the change optimistically.
    fetch(`/api/line-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidStatus: status }),
    }).then((r) => handleResponse(r, ''))
      .catch(() => toast('Network error', 'error'))
  }

  function setActualBid(id: string, status: BidStatusValue) {
    // No success toast: the chip already reflects the change optimistically.
    fetch(`/api/actuals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidStatus: status }),
    }).then((r) => handleResponse(r, ''))
      .catch(() => toast('Network error', 'error'))
  }

  function addEntry(categoryId: string, name: string) {
    fetch(`/api/categories/${categoryId}/budget-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => handleResponse(r, 'Line item added'))
      .catch(() => toast('Network error', 'error'))
  }

  function deleteEntry(id: string) {
    fetch(`/api/line-items/${id}`, { method: 'DELETE' })
      .then((r) => handleResponse(r, 'Deleted'))
      .catch(() => toast('Network error', 'error'))
  }

  if (categories.length === 0) {
    return (
      <Typography color="text.secondary">
        No categories yet. Run a QBO sync to import data.
      </Typography>
    )
  }

  return (
    <Box>
      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, maxHeight: 'calc(100vh - 220px)', overflow: 'auto', width: '100%' }}>
        {fundingSources.length > 0 && filterMode === 'none' && (
          <Box sx={{ p: 1.5, pb: 0 }}>
            <FundingSourceSummary categories={categories} fundingSources={fundingSources} />
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 1.5, py: 1, flexWrap: 'wrap' }}>
          <ButtonGroup size="small" variant="outlined">
            <Button onClick={() => dispatch('collapse-all')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Collapse All</Button>
            <Button onClick={() => dispatch('summary')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Summary</Button>
            <Button onClick={() => dispatch('expand-all')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Expand All</Button>
            <Button onClick={() => dispatch('focus-budget')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Budget</Button>
            <Button onClick={() => dispatch('focus-actuals')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Actuals</Button>
            <Button
              onClick={() => applyFilter('gap')}
              startIcon={<PriceCheckIcon sx={{ fontSize: '14px !important' }} />}
              sx={{ textTransform: 'none', fontSize: '0.72rem', ml: 1, borderLeftColor: 'divider' }}
            >
              Gap
            </Button>
            <Button onClick={() => applyFilter('bid')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Bid</Button>
            <Button onClick={() => applyFilter('not_bid')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Not bid</Button>
          </ButtonGroup>
        </Box>
        <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#1e3a5f', '& th': { color: 'white', fontWeight: 700 } }}>
              <TableCell align="center" sx={{ fontWeight: 700, width: 64, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                Bid
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 220, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                Category / Item
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                Budget
              </TableCell>
              {fundingSources.map((fs) => (
                <TableCell key={fs.id} align="right" sx={{ fontWeight: 700, width: 80, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff', borderLeft: `3px solid ${fs.color}` }}>
                  <Tooltip title={fs.name}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{fundingSourceLabel(fs.name, fs.shortName)}</Typography>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700, width: 90, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                Allocated
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.2 }}>Funding</Typography>
                <Typography sx={{ fontSize: '0.61rem', color: '#ffffffaa', lineHeight: 1.1 }}>Budget−Alloc</Typography>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                Actuals
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 90, py: 1, px: 1, bgcolor: '#1e3a5f', color: '#fff' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.2 }}>Remaining</Typography>
                <Typography sx={{ fontSize: '0.61rem', color: '#ffffffaa', lineHeight: 1.1 }}>Budget−Actuals</Typography>
              </TableCell>
              <TableCell sx={{ width: 32, py: 1, px: 0, bgcolor: '#1e3a5f' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filterMode !== 'none' && displayCategories.length === 0 && (
              <TableRow>
                <TableCell colSpan={fundingSources.length + 7} sx={{ ...baseCellSx, py: 2, textAlign: 'center', color: 'text.secondary' }}>
                  No line items match this filter.
                </TableCell>
              </TableRow>
            )}
            {displayCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                fundingSources={fundingSources}
                signal={signal}
                onPatchEntry={patchEntry}
                onUpdateAllocation={updateAllocation}
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
                onSetEntryBid={setEntryBid}
                onSetActualBid={setActualBid}
              />
            ))}
            {displayCategories.length > 0 && <TotalsRow categories={displayCategories} fundingSources={fundingSources} />}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
