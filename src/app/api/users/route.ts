import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied.error

  const supabase = await createClient()
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const roles = await prisma.userRole.findMany()
  const roleMap = new Map(roles.map((r) => [r.userId, r.role]))

  const result = (users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) ?? 'viewer',
  }))

  return NextResponse.json({ users: result })
}
