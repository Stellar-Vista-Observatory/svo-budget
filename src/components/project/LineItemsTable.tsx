interface LineItemData {
  id: string
  name: string
  displayPath: string
  category: string | null
  estimatedAmount: number
  spent: number
  remaining: number
  allocationPct: number
  allocations: {
    id: string
    fundingSourceId: string
    fundingSourceName: string
    fundingSourceColor: string
    allocatedAmount: number
  }[]
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

export function LineItemsTable({ lineItems }: LineItemsTableProps) {
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
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 text-slate-900">{li.name}</td>
              <td className="px-4 py-3 text-slate-500">{li.category ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">${li.estimatedAmount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-blue-700">${li.spent.toLocaleString()}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${li.remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                ${li.remaining.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
