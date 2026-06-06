'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface UserPreferences {
  showActualsAsNegative: boolean
  reportBvaProjectId: string | null
  reportBvaShowDetail: boolean
  reportFsProjectId: string | null
  reportFsFundingSourceId: string | null
}

const DEFAULT_PREFERENCES: UserPreferences = {
  showActualsAsNegative: true,
  reportBvaProjectId: null,
  reportBvaShowDetail: false,
  reportFsProjectId: null,
  reportFsFundingSourceId: null,
}

interface UserPreferencesContextValue extends UserPreferences {
  loaded: boolean
  setShowActualsAsNegative: (value: boolean) => Promise<void>
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  ...DEFAULT_PREFERENCES,
  loaded: false,
  setShowActualsAsNegative: async () => {},
  updatePreferences: async () => {},
})

export function useUserPreferences() {
  return useContext(UserPreferencesContext)
}

function sanitize(data: unknown): Partial<UserPreferences> {
  if (typeof data !== 'object' || data === null) return {}
  const d = data as Record<string, unknown>
  const next: Partial<UserPreferences> = {}
  if (typeof d.showActualsAsNegative === 'boolean') next.showActualsAsNegative = d.showActualsAsNegative
  if (typeof d.reportBvaShowDetail === 'boolean') next.reportBvaShowDetail = d.reportBvaShowDetail
  if (typeof d.reportBvaProjectId === 'string' || d.reportBvaProjectId === null) next.reportBvaProjectId = d.reportBvaProjectId
  if (typeof d.reportFsProjectId === 'string' || d.reportFsProjectId === null) next.reportFsProjectId = d.reportFsProjectId
  if (typeof d.reportFsFundingSourceId === 'string' || d.reportFsFundingSourceId === null) next.reportFsFundingSourceId = d.reportFsFundingSourceId
  return next
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => r.json())
      .then((d) => {
        setPrefs((prev) => ({ ...prev, ...sanitize(d) }))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function updatePreferences(patch: Partial<UserPreferences>) {
    setPrefs((prev) => ({ ...prev, ...patch }))
    await fetch('/api/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async function setShowActualsAsNegative(value: boolean) {
    await updatePreferences({ showActualsAsNegative: value })
  }

  return (
    <UserPreferencesContext.Provider
      value={{ ...prefs, loaded, setShowActualsAsNegative, updatePreferences }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}
