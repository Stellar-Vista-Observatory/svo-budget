'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

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
      // degrade gracefully — base nav items shown
    }
  }, [])

  useEffect(() => { loadRole() }, [loadRole])

  const navItems = role === 'admin'
    ? [...baseNavItems.slice(0, 2), ...adminNavItems, baseNavItems[2]]
    : baseNavItems

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col h-full min-h-screen">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-lg font-bold text-slate-900">SVO Budget</span>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-700 text-xl" aria-label="Close menu">
            ✕
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onClose?.()}
            className={`flex items-center px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
