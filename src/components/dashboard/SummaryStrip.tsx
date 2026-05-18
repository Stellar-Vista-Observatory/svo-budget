interface SummaryStripProps {
  estimatedCosts: number
  securedFunding: number
  spentToDate: number
  remaining: number
}

function StatBox({ label, value, valueColor }: { label: string; value: number; valueColor?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-0">
      <p className="text-sm text-slate-500 font-medium mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueColor ?? 'text-slate-900'}`}>
        ${value.toLocaleString()}
      </p>
    </div>
  )
}

export function SummaryStrip({ estimatedCosts, securedFunding, spentToDate, remaining }: SummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap sm:gap-4">
      <StatBox label="Estimated Costs" value={estimatedCosts} />
      <StatBox label="Secured Funding" value={securedFunding} valueColor="text-green-700" />
      <StatBox label="Spent to Date" value={spentToDate} valueColor="text-blue-700" />
      <StatBox label="Remaining" value={remaining} valueColor={remaining >= 0 ? 'text-green-700' : 'text-red-600'} />
    </div>
  )
}
