import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
export type ThemePalette = 'default' | 'dhbw' | 'emerald' | 'purple'

interface ThemeContextType {
  mode: ThemeMode
  palette: ThemePalette
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: ThemePalette) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const MODE_STORAGE_KEY = 'gta_theme_mode'
const PALETTE_STORAGE_KEY = 'gta_theme_palette'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode) || 'dark'
  })

  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    return (localStorage.getItem(PALETTE_STORAGE_KEY) as ThemePalette) || 'default'
  })

  const isDark =
    mode === 'system'
      ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      : mode === 'dark'

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.setAttribute('data-theme', palette)
  }, [isDark, palette])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(MODE_STORAGE_KEY, newMode)
  }

  const setPalette = (newPalette: ThemePalette) => {
    setPaletteState(newPalette)
    localStorage.setItem(PALETTE_STORAGE_KEY, newPalette)
  }

  return (
    <ThemeContext.Provider value={{ mode, palette, setMode, setPalette, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
