'use client'

import Link from 'next/link'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'

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

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

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
  const spentPct = pct(spent, estimated)

  return (
    <Card elevation={2}>
      <CardActionArea component={Link} href={`/projects/${id}`}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 0.25 }}>{name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {fundingSources.length} funding source{fundingSources.length !== 1 ? 's' : ''} · {lineItemCount} line item{lineItemCount !== 1 ? 's' : ''}
              </Typography>
              {fundingSources.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {fundingSources.map((fs) => (
                    <Chip
                      key={fs.id}
                      size="small"
                      label={fs.name}
                      sx={{
                        bgcolor: fs.color + '22',
                        color: fs.color,
                        border: `1px solid ${fs.color}55`,
                        fontWeight: 600,
                        fontSize: '0.72rem',
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Stack spacing={1.5} sx={{ minWidth: 220 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">Spent vs Budget</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{spentPct}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(spentPct, 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: spentPct > 100 ? 'error.main' : spentPct > 80 ? 'warning.main' : 'success.main',
                    },
                  }}
                />
              </Box>
              <Stack direction="row" spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Budget</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(estimated)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Secured</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(secured)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Spent</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(spent)}</Typography>
                </Box>
              </Stack>
              {fundingGap > 0 && (
                <Chip
                  size="small"
                  label={`${fmt(fundingGap)} gap`}
                  color="warning"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </Stack>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
