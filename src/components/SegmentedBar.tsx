interface Segment {
  value: number   // dollar amount
  color: string   // tailwind bg class or hex
  label: string
}

interface SegmentedBarProps {
  segments: Segment[]
  total: number   // denominator for width calculation
  height?: string // tailwind height class, default 'h-3'
}

export function SegmentedBar({ segments, total, height = 'h-3' }: SegmentedBarProps) {
  if (total <= 0) {
    return <div className={`w-full ${height} bg-slate-100 rounded-full`} />
  }

  return (
    <div className={`w-full ${height} bg-slate-100 rounded-full overflow-hidden flex`}>
      {segments.map((seg, i) => {
        const pct = Math.min(100, Math.max(0, (seg.value / total) * 100))
        if (pct === 0) return null
        return (
          <div
            key={i}
            style={{ width: `${pct}%`, backgroundColor: seg.color }}
            title={`${seg.label}: $${seg.value.toLocaleString()}`}
            className="h-full transition-all"
          />
        )
      })}
    </div>
  )
}
