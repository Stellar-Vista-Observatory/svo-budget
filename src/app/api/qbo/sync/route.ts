import { syncAll } from '@/lib/qbo/sync'
import { requireWriteAccess } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST() {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error
  try {
    const result = await syncAll()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
