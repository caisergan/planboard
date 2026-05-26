import { createContext } from 'preact'
import { useContext, useState, useCallback } from 'preact/hooks'

export interface Theme {
  name: string
  label: string
  isDark: boolean
  bg: { base: string; surface: string; card: string; cardHover: string; input: string }
  border: { default: string; light: string }
  text: { primary: string; secondary: string; muted: string }
  accent: { main: string; dim: string; text: string; glow: string }
  status: {
    done: { bg: string; text: string }
    'in-progress': { bg: string; text: string }
    pending: { bg: string; text: string }
  }
  header: { bg: string; border: string }
  ring: { track: string }
  checkmark: string
}

export const ember: Theme = {
  name: 'ember',
  label: 'Ember',
  isDark: true,
  bg: {
    base: '#1a1714',
    surface: '#211e1b',
    card: '#2a2623',
    cardHover: '#332f2b',
    input: '#1f1c18',
  },
  border: { default: '#3a3532', light: '#4a4540' },
  text: { primary: '#ede9e4', secondary: '#a8a29e', muted: '#78716c' },
  accent: {
    main: '#e8923a',
    dim: 'rgba(232,146,58,0.13)',
    text: '#f5b06a',
    glow: 'rgba(232,146,58,0.25)',
  },
  status: {
    done: { bg: 'rgba(74,222,128,0.12)', text: '#4ade80' },
    'in-progress': { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
    pending: { bg: 'rgba(161,161,170,0.12)', text: '#a1a1aa' },
  },
  header: { bg: 'rgba(26,23,20,0.85)', border: '#3a3532' },
  ring: { track: 'rgba(255,255,255,0.06)' },
  checkmark: '#1a1714',
}

export const navyGold: Theme = {
  name: 'navy-gold',
  label: 'Navy & Gold',
  isDark: false,
  bg: {
    base: '#F5F0E8',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#faf7f2',
    input: '#FFFFFF',
  },
  border: { default: '#E5DFD5', light: '#d5cfc5' },
  text: { primary: '#2C3E50', secondary: '#5a6a78', muted: '#8a9aa8' },
  accent: {
    main: '#C9A96E',
    dim: 'rgba(201,169,110,0.12)',
    text: '#b89456',
    glow: 'rgba(201,169,110,0.25)',
  },
  status: {
    done: { bg: 'rgba(22,163,74,0.10)', text: '#16a34a' },
    'in-progress': { bg: 'rgba(217,119,6,0.10)', text: '#d97706' },
    pending: { bg: 'rgba(138,154,168,0.12)', text: '#8a9aa8' },
  },
  header: { bg: 'rgba(10,22,40,0.97)', border: '#142a44' },
  ring: { track: 'rgba(0,0,0,0.06)' },
  checkmark: '#FFFFFF',
}

export const themes: Theme[] = [ember, navyGold]

const STORAGE_KEY = 'planboard-theme'

function loadSaved(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const found = themes.find(t => t.name === saved)
      if (found) return found
    }
  } catch {}
  return ember
}

interface ThemeContext {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const ThemeCtx = createContext<ThemeContext>({ theme: ember, setTheme: () => {} })

export function useTheme(): ThemeContext {
  return useContext(ThemeCtx)
}

export function useThemeState(): ThemeContext {
  const [theme, setThemeRaw] = useState<Theme>(loadSaved)

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t)
    try { localStorage.setItem(STORAGE_KEY, t.name) } catch {}
  }, [])

  return { theme, setTheme }
}

export const fonts = {
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const
