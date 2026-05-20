import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }
}
