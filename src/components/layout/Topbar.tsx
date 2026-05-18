'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
        aria-label="Open menu"
      >
        ☰
      </button>
      <div className="hidden md:block" />
      <button
        onClick={handleSignOut}
        className="text-base text-slate-500 hover:text-slate-900"
      >
        Sign out
      </button>
    </header>
  )
}
