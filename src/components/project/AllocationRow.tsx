'use client'

import { useState } from 'react'

interface AllocationRowProps {
  allocationId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
  onUpdate: (newAmount: number) => Promise<void>
  onDelete: () => Promise<void>
}

export function AllocationRow({
  allocationId: _allocationId,
  fundingSourceName,
  fundingSourceColor,
  allocatedAmount,
  onUpdate,
  onDelete,
}: AllocationRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(allocatedAmount))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setSaving(true)
    await onUpdate(num)
    setEditing(false)
    setSaving(false)
  }

  return (
    <tr className="bg-slate-50 border-b border-slate-100">
      <td className="pl-10 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fundingSourceColor }} />
          <span className="text-base text-slate-700">{fundingSourceName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right" colSpan={2}>
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-slate-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-28 border border-blue-400 rounded px-2 py-1 text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            <button onClick={handleSave} disabled={saving} className="text-sm text-blue-700 font-medium hover:text-blue-900 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-base tabular-nums text-slate-900 border-b border-dashed border-blue-400 hover:border-blue-600 pr-0.5"
            title="Click to edit"
          >
            ${allocatedAmount.toLocaleString()}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          onClick={onDelete}
          className="text-sm text-slate-400 hover:text-red-600 transition-colors"
          title="Remove allocation"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}
