'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Topbar() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div />
      <button
        onClick={handleSignOut}
        className="text-base text-slate-500 hover:text-slate-900"
      >
        Sign out
      </button>
    </header>
  )
}
