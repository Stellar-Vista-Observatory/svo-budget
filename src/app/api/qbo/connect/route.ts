import { buildAuthUrl } from '@/lib/qbo/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const state = crypto.randomUUID()
  const authUrl = buildAuthUrl(state)
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('qbo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}
