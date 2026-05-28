'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface UserPreferencesContextValue {
  showActualsAsNegative: boolean
  setShowActualsAsNegative: (value: boolean) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  showActualsAsNegative: true,
  setShowActualsAsNegative: async () => {},
})

export function useUserPreferences() {
  return useContext(UserPreferencesContext)
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [showActualsAsNegative, setShowActualsAsNegativeState] = useState(true)

  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.showActualsAsNegative === 'boolean') {
          setShowActualsAsNegativeState(d.showActualsAsNegative)
        }
      })
      .catch(() => {})
  }, [])

  async function setShowActualsAsNegative(value: boolean) {
    setShowActualsAsNegativeState(value)
    await fetch('/api/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showActualsAsNegative: value }),
    })
  }

  return (
    <UserPreferencesContext.Provider value={{ showActualsAsNegative, setShowActualsAsNegative }}>
      {children}
    </UserPreferencesContext.Provider>
  )
}
