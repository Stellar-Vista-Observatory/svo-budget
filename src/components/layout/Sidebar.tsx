'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Box, IconButton, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

const adminNavItems = [
  { href: '/admin/users', label: 'Users' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null)

  const loadRole = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setRole(data.role)
      }
    } catch {
      // degrade gracefully
    }
  }, [])

  useEffect(() => { loadRole() }, [loadRole])

  const navItems = role === 'admin'
    ? [...baseNavItems.slice(0, 2), ...adminNavItems, baseNavItems[2]]
    : baseNavItems

  return (
    <Box sx={{ width: 220, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>SVO Budget</Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small" sx={{ display: { md: 'none' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={() => onClose?.()}
              selected={active}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.main' },
                '&.Mui-selected:hover': { bgcolor: 'primary.100' },
              }}
            >
              <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: active ? 600 : 400 } } }} />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )
}
