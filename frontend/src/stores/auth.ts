/**
 * 全局状态管理（zustand）
 * 当前承载登录态；后续迭代的筛选条件、用户偏好等也收敛到 store 层。
 */
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
    { name: 'lms-auth' },
  ),
)

export const useIsAuthed = () => useAuthStore((s) => Boolean(s.token))
