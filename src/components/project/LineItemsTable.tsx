'use client'

import React, { useState, useRef } from 'react'
import { useToast } from '@/components/ToastProvider'
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
  allocations: AllocationData[]
}

interface ActualData {
  id: string
  amount: number
  date: string
  vendor: string | null
  memo: string | null
  qboTransactionType: string
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
  color: string
  allocatedTotal: number
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

function fsLabel(name: string): string {
  if (/svo\s*funds?/i.test(name)) return 'SVO'
  return name.replace(/[^A-Z]/g, '')
}

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

// ── Budget Section ────────────────────────────────────────────────────────────

function BudgetSection({
  category,
  fundingSources,
  signal,
  onPatchEntry,
  onUpdateAllocation,
  onAddEntry,
  onDeleteEntry,
}: {
  category: CategoryData
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
  onPatchEntry: (id: string, patch: Record<string, unknown>) => void
  onUpdateAllocation: (entryId: string, fundingSourceId: string, existingAllocId: string | null, amount: number) => void
  onAddEntry: (categoryId: string, name: string) => void
  onDeleteEntry: (id: string) => void
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
          <TableCell sx={{ ...baseCellSx, pl: 4, p: 0 }} colSpan={fundingSources.length + 6}>
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
}: {
  actuals: ActualData[]
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
}) {
  const actualsInitialOpen = signal.action !== 'collapse-all' && signal.action !== 'focus-budget' && signal.action !== 'summary'
  const [open, setOpen] = useState(actualsInitialOpen)
  const [seenSignal, setSeenSignal] = useState(signal.count)

  if (signal.count !== seenSignal) {
    setSeenSignal(signal.count)
    if (signal.action === 'expand-all' || signal.action === 'focus-actuals') setOpen(true)
    else if (signal.action === 'collapse-all' || signal.action === 'focus-budget' || signal.action === 'summary') setOpen(false)
  }

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
            {actualBySourceId[fs.id] > 0 ? fmt(actualBySourceId[fs.id]) : <span style={{ color: '#ccc' }}>—</span>}
          </TableCell>
        ))}
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
        <TableCell align="right" sx={subHdrSx}>{fmt(totalActual)}</TableCell>
        <TableCell sx={subHdrSx} />
        <TableCell sx={subHdrSx} />
      </TableRow>

      {open && actuals.map((a) => (
        <TableRow key={a.id} sx={{ bgcolor: '#fafafa', '&:hover': { bgcolor: '#fffde7' } }}>
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
                ? <Typography sx={{ fontSize: '0.78rem', color: a.fundingSourceColor, fontWeight: 500 }}>{fmt(a.amount)}</Typography>
                : <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>—</Typography>
              }
            </TableCell>
          ))}
          <TableCell sx={baseCellSx} />
          <TableCell sx={baseCellSx} />
          <TableCell align="right" sx={baseCellSx}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{fmt(a.amount)}</Typography>
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
}: {
  category: CategoryData
  fundingSources: FundingSourceOption[]
  signal: { count: number; action: ViewAction }
  onPatchEntry: (id: string, patch: Record<string, unknown>) => void
  onUpdateAllocation: (entryId: string, fundingSourceId: string, existingAllocId: string | null, amount: number) => void
  onAddEntry: (categoryId: string, name: string) => void
  onDeleteEntry: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [seenSignal, setSeenSignal] = useState(signal.count)

  if (signal.count !== seenSignal) {
    setSeenSignal(signal.count)
    if (signal.action === 'collapse-all') setOpen(false)
    else setOpen(true)
  }

  const { totalBudget, totalSpent, totalAllocated } = category
  const coverageDelta = totalBudget - totalAllocated
  const remaining = totalBudget - totalSpent
  const spentPct = pct(totalSpent, totalBudget)

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
        {fundingSources.map((fs) => (
          <TableCell key={fs.id} sx={{ ...hdrSx, borderLeft: `2px solid ${fs.color}33` }} />
        ))}
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
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {totalSpent === 0 ? <span style={{ color: '#9e9e9e' }}>$0</span> : fmt(totalSpent)}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="right" sx={hdrSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: remaining < 0 ? '#c62828' : '#2e7d32' }}>
            {totalBudget === 0 && totalSpent === 0 ? <span style={{ color: '#9e9e9e' }}>—</span> : fmt(remaining)}
          </Typography>
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
          />
          <ActualsSection
            actuals={category.actuals}
            fundingSources={fundingSources}
            signal={signal}
          />
        </>
      )}
    </>
  )
}

// ── Totals Row ────────────────────────────────────────────────────────────────

function TotalsRow({ categories, fundingSources }: { categories: CategoryData[]; fundingSources: FundingSourceOption[] }) {
  const totalBudget = categories.reduce((s, c) => s + c.totalBudget, 0)
  const totalAllocated = categories.reduce((s, c) => s + c.totalAllocated, 0)
  const totalActual = categories.reduce((s, c) => s + c.totalSpent, 0)
  const coverageDelta = totalBudget - totalAllocated
  const remaining = totalBudget - totalActual

  const cellSx = {
    py: 1, fontWeight: 700, fontSize: '0.82rem', px: 1,
    bgcolor: '#e8eaf6', borderTop: '3px solid', borderColor: 'primary.main',
  }

  return (
    <TableRow>
      <TableCell sx={cellSx}>TOTAL</TableCell>
      <TableCell align="right" sx={cellSx}>{fmt(totalBudget)}</TableCell>
      {fundingSources.map((fs) => (
        <TableCell key={fs.id} sx={{ ...cellSx, borderLeft: `2px solid ${fs.color}44` }} />
      ))}
      <TableCell align="right" sx={cellSx}>{fmt(totalAllocated)}</TableCell>
      <TableCell align="right" sx={{ ...cellSx, color: coverageDelta === 0 ? '#2e7d32' : coverageDelta > 0 ? '#e65100' : '#1565c0' }}>
        {coverageDelta === 0 ? '—' : fmt(Math.abs(coverageDelta)) + (coverageDelta > 0 ? ' gap' : ' over')}
      </TableCell>
      <TableCell align="right" sx={cellSx}>{fmt(totalActual)}</TableCell>
      <TableCell align="right" sx={{ ...cellSx, color: remaining < 0 ? '#c62828' : '#2e7d32' }}>
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
  const { toast } = useToast()

  function dispatch(action: ViewAction) {
    setSignal((s) => ({ count: s.count + 1, action }))
  }

  function handleResponse(res: Response, successMsg: string) {
    if (res.ok) {
      toast(successMsg)
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.75 }}>
        <ButtonGroup size="small" variant="outlined">
          <Button onClick={() => dispatch('collapse-all')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Collapse All</Button>
          <Button onClick={() => dispatch('summary')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Summary</Button>
          <Button onClick={() => dispatch('expand-all')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Expand All</Button>
          <Button onClick={() => dispatch('focus-budget')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Budget</Button>
          <Button onClick={() => dispatch('focus-actuals')} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Actuals</Button>
        </ButtonGroup>
      </Box>

      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, maxHeight: 'calc(100vh - 300px)', overflow: 'auto', width: '100%' }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 220, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                Category / Item
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                Budget
              </TableCell>
              {fundingSources.map((fs) => (
                <TableCell key={fs.id} align="right" sx={{ fontWeight: 700, width: 80, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff', borderLeft: `3px solid ${fs.color}` }}>
                  <Tooltip title={fs.name}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{fsLabel(fs.name)}</Typography>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700, width: 90, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                Allocated
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.2 }}>Funding</Typography>
                <Typography sx={{ fontSize: '0.61rem', color: '#ffffffaa', lineHeight: 1.1 }}>Budget−Alloc</Typography>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 82, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                Actuals
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 90, py: 1, px: 1, bgcolor: 'primary.main', color: '#fff' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.2 }}>Remaining</Typography>
                <Typography sx={{ fontSize: '0.61rem', color: '#ffffffaa', lineHeight: 1.1 }}>Budget−Actuals</Typography>
              </TableCell>
              <TableCell sx={{ width: 32, py: 1, px: 0, bgcolor: 'primary.main' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                fundingSources={fundingSources}
                signal={signal}
                onPatchEntry={patchEntry}
                onUpdateAllocation={updateAllocation}
                onAddEntry={addEntry}
                onDeleteEntry={deleteEntry}
              />
            ))}
            <TotalsRow categories={categories} fundingSources={fundingSources} />
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
