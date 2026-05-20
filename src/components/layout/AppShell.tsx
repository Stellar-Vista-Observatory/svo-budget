'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

const adminNavItems = [
  { href: '/admin/users', label: 'Users' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null)

  const loadRole = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setRole(data.role)
      }
    } catch { /* degrade gracefully */ }
  }, [])

  useEffect(() => { loadRole() }, [loadRole])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = role === 'admin'
    ? [...baseNavItems.slice(0, 2), ...adminNavItems, baseNavItems[2]]
    : baseNavItems

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'primary.main' }}>
        <Toolbar sx={{ gap: 1 }}>
          {/* Mobile hamburger */}
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Typography
            component={Link}
            href="/dashboard"
            sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'inherit', textDecoration: 'none', mr: 4 }}
          >
            SVO Budget
          </Typography>

          {/* Desktop nav links */}
          <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' }, flex: 1 }}>
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  color="inherit"
                  sx={{
                    textTransform: 'none',
                    fontWeight: active ? 700 : 400,
                    bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    borderRadius: 1,
                    px: 1.5,
                  }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Stack>

          {/* Sign out */}
          <Button
            color="inherit"
            onClick={handleSignOut}
            size="small"
            sx={{ textTransform: 'none', ml: 'auto' }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 240, pt: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', px: 2, mb: 1 }}>SVO Budget</Typography>
          <List>
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  selected={active}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        {children}
      </Box>
    </Box>
  )
}
