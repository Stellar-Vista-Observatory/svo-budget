'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AppBar, Box, Button, IconButton, Toolbar } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar variant="dense" sx={{ minHeight: 56 }}>
        <IconButton
          onClick={onMenuClick}
          edge="start"
          sx={{ display: { md: 'none' }, mr: 1 }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleSignOut} color="inherit" size="small">
          Sign out
        </Button>
      </Toolbar>
    </AppBar>
  )
}
