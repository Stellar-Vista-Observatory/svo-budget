import Link from 'next/link'
import { SegmentedBar } from '@/components/SegmentedBar'
import { FundingChip } from '@/components/FundingChip'

interface FundingSourceSummary {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
}

interface ProjectCardProps {
  id: string
  name: string
  estimated: number
  secured: number
  spent: number
  fundingGap: number
  lineItemCount: number
  fundingSources: FundingSourceSummary[]
}

export function ProjectCard({
  id,
  name,
  estimated,
  secured,
  spent,
  fundingGap,
  lineItemCount,
  fundingSources,
}: ProjectCardProps) {
  const barTotal = Math.max(estimated, secured)
  const securedUnspent = Math.max(0, secured - spent)

  return (
    <Link
      href={`/projects/${id}`}
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {fundingSources.length} funding source{fundingSources.length !== 1 ? 's' : ''} · {lineItemCount} line item{lineItemCount !== 1 ? 's' : ''}
          </p>
        </div>
        {fundingGap > 0 ? (
          <span className="text-sm font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full shrink-0 ml-3">
            ${fundingGap.toLocaleString()} gap
          </span>
        ) : (
          <span className="text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full shrink-0 ml-3">
            ${Math.abs(fundingGap).toLocaleString()} surplus
          </span>
        )}
      </div>

      <SegmentedBar
        total={barTotal}
        segments={[
          { value: spent, color: '#3b82f6', label: 'Spent' },
          { value: securedUnspent, color: '#16a34a', label: 'Secured unspent' },
          { value: Math.max(0, fundingGap), color: '#f59e0b', label: 'Funding gap' },
        ]}
      />

      {fundingSources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {fundingSources.map((fs) => (
            <FundingChip
              key={fs.id}
              color={fs.color}
              label={fs.name}
              amount={fs.allocatedTotal}
            />
          ))}
        </div>
      )}
    </Link>
  )
}
