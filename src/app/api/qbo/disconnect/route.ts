import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  await prisma.qboConnection.deleteMany()
  return NextResponse.json({ ok: true })
}
