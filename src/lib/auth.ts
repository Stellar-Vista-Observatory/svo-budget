import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Role } from '@prisma/client'

export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getRole(userId: string): Promise<Role> {
  const userRole = await prisma.userRole.findUnique({ where: { userId } })
  return userRole?.role ?? 'viewer'
}

export async function requireAuth(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getSession>>>; role: Role } |
  { error: NextResponse }
> {
  const user = await getSession()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const role = await getRole(user.id)
  return { user, role }
}

export async function requireAdmin(): Promise<{ error: NextResponse } | null> {
  const result = await requireAuth()
  if ('error' in result) return result
  if (result.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return null
}
