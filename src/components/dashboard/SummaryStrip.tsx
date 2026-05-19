'use client'

import { Box, Paper, Typography } from '@mui/material'

interface SummaryStripProps {
  estimatedCosts: number
  securedFunding: number
  spentToDate: number
  remaining: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ color: color ?? 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(value)}
      </Typography>
    </Paper>
  )
}

export function SummaryStrip({ estimatedCosts, securedFunding, spentToDate, remaining }: SummaryStripProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
      <StatBox label="Estimated Costs" value={estimatedCosts} />
      <StatBox label="Secured Funding" value={securedFunding} color="success.main" />
      <StatBox label="Spent to Date" value={spentToDate} color="info.main" />
      <StatBox label="Remaining" value={remaining} color={remaining >= 0 ? 'success.main' : 'error.main'} />
    </Box>
  )
}
