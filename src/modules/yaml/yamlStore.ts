//import React from 'react'
import { create } from 'zustand'

export const useYamlStore = create<{ yaml: string; setYaml: (yaml: string) => void }>((set) => ({
  yaml: '# YAML will appear here. Use the Builder to generate, or edit directly.\n',
  setYaml: (yaml) => set({ yaml })
}))
