import { create } from 'zustand'

interface AppState {
  isAuthenticated: boolean
  userId: string | null
  isOnline: boolean

  setAuth: (userId: string) => void
  clearAuth: () => void
  setOnline: (online: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  userId: null,
  isOnline: true,

  setAuth: (userId) => set({ isAuthenticated: true, userId }),
  clearAuth: () => set({ isAuthenticated: false, userId: null }),
  setOnline: (online) => set({ isOnline: online }),
}))
