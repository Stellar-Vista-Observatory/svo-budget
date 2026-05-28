import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'
import { UserPreferencesProvider } from '@/lib/UserPreferencesProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SVO Budget',
  description: 'Project budget tracking for SVO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <UserPreferencesProvider>
            {children}
          </UserPreferencesProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
