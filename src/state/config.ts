import { create } from 'zustand'
//import type { ApiConfig } from '../types'

export const useAppConfig = create<{
  baseUrl: string
  setBaseUrl: (url: string) => void
}>((set) => ({
  baseUrl: '',
  setBaseUrl: (baseUrl: string) => set({ baseUrl })
}))
