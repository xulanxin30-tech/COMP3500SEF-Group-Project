/** Persist the current session so route guards survive browser reloads. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'lms-auth', version: 1, migrate: () => ({ token: null, user: null }) },
  ),
)

export const useIsAuthed = () => useAuthStore((s) => Boolean(s.token))
