import { exchangeCodeForTokens } from '@/lib/qbo/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('qbo_oauth_state')?.value

  if (!code || !realmId || !state || state !== storedState) {
    return NextResponse.redirect(`${origin}/settings?error=qbo_auth`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const apiBase = process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company'

    const companyRes = await fetch(
      `${apiBase}/${realmId}/companyinfo/${realmId}?minorversion=70`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      }
    )
    const companyData = await companyRes.json()
    const companyName: string = companyData?.CompanyInfo?.CompanyName ?? 'QuickBooks Company'

    await prisma.qboConnection.upsert({
      where: { realmId },
      update: {
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        realmId,
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })

    const response = NextResponse.redirect(`${origin}/settings?connected=true`)
    response.cookies.delete('qbo_oauth_state')
    return response
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=qbo_auth`)
  }
}
