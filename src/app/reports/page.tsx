'use client'

import { AppShell } from '@/components/layout/AppShell'
import Link from 'next/link'
import { Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import PriceCheckIcon from '@mui/icons-material/PriceCheck'

export default function ReportsPage() {
  return (
    <AppShell>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>Reports</Typography>

      <Stack spacing={2} sx={{ maxWidth: 500 }}>
        <Card elevation={2}>
          <CardActionArea component={Link} href="/reports/budget-vs-actual">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AssessmentIcon color="primary" />
              <div>
                <Typography sx={{ fontWeight: 600 }}>Budget vs. Actual</Typography>
                <Typography variant="body2" color="text.secondary">
                  Project budget summary with estimated, spent, and remaining by category.
                </Typography>
              </div>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card elevation={2}>
          <CardActionArea component={Link} href="/reports/funding-source">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AccountBalanceIcon color="primary" />
              <div>
                <Typography sx={{ fontWeight: 600 }}>Funding Source</Typography>
                <Typography variant="body2" color="text.secondary">
                  Allocation and spending detail for a specific funding source.
                </Typography>
              </div>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card elevation={2}>
          <CardActionArea component={Link} href="/reports/funding-gap">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PriceCheckIcon color="primary" />
              <div>
                <Typography sx={{ fontWeight: 600 }}>Funding Gap</Typography>
                <Typography variant="body2" color="text.secondary">
                  Line items whose estimated cost exceeds their allocated funding.
                </Typography>
              </div>
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>
    </AppShell>
  )
}
