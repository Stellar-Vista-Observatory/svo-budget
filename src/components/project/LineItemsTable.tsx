'use client'

import React, { useState } from 'react'
import { AllocationRow } from './AllocationRow'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

interface LineItemData {
  id: string
  name: string
  displayPath: string
  category: string | null
  estimatedAmount: number
  spent: number
  remaining: number
  allocationPct: number
  allocations: AllocationData[]
}

interface FundingSourceOption {
  id: string
  name: string
  color: string
  allocatedTotal: number
}

interface LineItemsTableProps {
  lineItems: LineItemData[]
  isCatchAll: boolean
  projectId: string
  fundingSources: FundingSourceOption[]
  onUpdate: () => void
}

function EditableCell({
  value,
  onSave,
  type = 'text',
}: {
  value: string
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving || draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setEditing(false)
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        disabled={saving}
        className="w-full border border-blue-400 rounded px-2 py-0.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="text-left w-full border-b border-dashed border-blue-300 hover:border-blue-500 pb-0.5 group"
      title="Click to edit"
    >
      {value || <span className="text-slate-400 italic">—</span>}
      <span className="ml-1 text-slate-400 opacity-0 group-hover:opacity-100 text-xs">✎</span>
    </button>
  )
}

export function LineItemsTable({ lineItems, isCatchAll, fundingSources, onUpdate }: LineItemsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingSourceFor, setAddingSourceFor] = useState<string | null>(null)
  const [selectedFsId, setSelectedFsId] = useState('')
  const [newAllocationAmount, setNewAllocationAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function patchLineItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/line-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onUpdate()
  }

  async function patchAllocation(id: string, amount: number) {
    await fetch(`/api/funding-allocations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocatedAmount: amount }),
    })
    onUpdate()
  }

  async function deleteAllocation(id: string) {
    await fetch(`/api/funding-allocations/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  async function addAllocation(lineItemId: string) {
    if (!selectedFsId || !newAllocationAmount) return
    setSaving(true)
    await fetch(`/api/line-items/${lineItemId}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fundingSourceId: selectedFsId, allocatedAmount: parseFloat(newAllocationAmount) }),
    })
    setAddingSourceFor(null)
    setSelectedFsId('')
    setNewAllocationAmount('')
    setSaving(false)
    onUpdate()
  }

  if (lineItems.length === 0) {
    return <p className="text-slate-500 text-base">No line items yet. Run a QBO sync to import data.</p>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-base">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Line Item</th>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Category</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Estimated</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Spent</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => {
            const isExpanded = expandedId === li.id
            return (
              <React.Fragment key={li.id}>
                <tr
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : li.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                      <span className="text-slate-900">
                        {isCatchAll ? li.displayPath : li.name}
                      </span>
                      {li.allocationPct < 100 && li.estimatedAmount > 0 && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded ml-1">
                          {li.allocationPct}% allocated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{li.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">${li.estimatedAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">${li.spent.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${li.remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    ${li.remaining.toLocaleString()}
                  </td>
                </tr>

                {isExpanded && (
                  <>
                    <tr className="bg-blue-50/20 border-b border-slate-100">
                      <td className="pl-10 pr-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={li.name}
                          onSave={(v) => patchLineItem(li.id, { name: v })}
                        />
                      </td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={li.category ?? ''}
                          onSave={(v) => patchLineItem(li.id, { category: v || null })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={String(li.estimatedAmount)}
                          type="number"
                          onSave={(v) => patchLineItem(li.id, { estimatedAmount: parseFloat(v) })}
                        />
                      </td>
                      <td colSpan={2} />
                    </tr>

                    {li.allocations.map((alloc) => (
                      <AllocationRow
                        key={alloc.id}
                        allocationId={alloc.id}
                        fundingSourceName={alloc.fundingSourceName}
                        fundingSourceColor={alloc.fundingSourceColor}
                        allocatedAmount={alloc.allocatedAmount}
                        onUpdate={(amount) => patchAllocation(alloc.id, amount)}
                        onDelete={() => deleteAllocation(alloc.id)}
                      />
                    ))}

                    {addingSourceFor === li.id ? (
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <td className="pl-10 pr-4 py-2" colSpan={2} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={selectedFsId}
                            onChange={(e) => setSelectedFsId(e.target.value)}
                            className="text-base border border-slate-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="">Select funding source…</option>
                            {fundingSources
                              .filter((fs) => !li.allocations.some((a) => a.fundingSourceId === fs.id))
                              .map((fs) => (
                                <option key={fs.id} value={fs.id}>{fs.name}</option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={newAllocationAmount}
                              onChange={(e) => setNewAllocationAmount(e.target.value)}
                              className="w-28 border border-slate-300 rounded px-2 py-1 text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right" colSpan={2} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => addAllocation(li.id)}
                              disabled={saving || !selectedFsId || !newAllocationAmount}
                              className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                            >
                              {saving ? 'Adding…' : 'Add'}
                            </button>
                            <button
                              onClick={() => { setAddingSourceFor(null); setSelectedFsId(''); setNewAllocationAmount('') }}
                              className="text-sm text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <td className="pl-10 pr-4 py-2" colSpan={5} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setAddingSourceFor(li.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            + Add source
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
