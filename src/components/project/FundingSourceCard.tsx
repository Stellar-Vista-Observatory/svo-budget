import { SegmentedBar } from '@/components/SegmentedBar'

interface FundingSourceCardProps {
  name: string
  color: string
  allocatedTotal: number
  spent: number
  remaining: number
}

export function FundingSourceCard({ name, color, allocatedTotal, spent, remaining }: FundingSourceCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-slate-900">{name}</span>
        <span className="text-sm text-slate-500">${allocatedTotal.toLocaleString()} total</span>
      </div>

      <SegmentedBar
        height="h-2"
        total={allocatedTotal}
        segments={[
          { value: spent, color: '#3b82f6', label: 'Spent' },
          { value: Math.max(0, remaining), color: '#16a34a', label: 'Remaining' },
        ]}
      />

      <div className="flex gap-4 text-sm">
        <span className="text-blue-700 font-medium">${spent.toLocaleString()} spent</span>
        <span className={remaining >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
          ${Math.abs(remaining).toLocaleString()} {remaining >= 0 ? 'remaining' : 'over'}
        </span>
      </div>
    </div>
  )
}
