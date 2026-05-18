interface FundingChipProps {
  color: string   // hex color
  label: string
  amount?: number
}

export function FundingChip({ color, label, amount }: FundingChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
      {amount !== undefined && (
        <span className="text-slate-500">${amount.toLocaleString()}</span>
      )}
    </span>
  )
}
