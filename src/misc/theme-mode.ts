export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'bookmame-theme-mode'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function normalizeThemeMode(value: unknown): ThemeMode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'dark') return 'dark'
  if (normalized === 'light') return 'light'
  return null
}

function readUserThemePreference(userRef: unknown): ThemeMode | null {
  if (!userRef || typeof userRef !== 'object') return null
  const holder = userRef as Record<string, unknown>

  return (
    normalizeThemeMode(holder.themeMode) ||
    normalizeThemeMode(holder.theme) ||
    normalizeThemeMode((holder.preferences as Record<string, unknown> | undefined)?.themeMode) ||
    normalizeThemeMode((holder.preferences as Record<string, unknown> | undefined)?.theme) ||
    normalizeThemeMode(
      ((holder.user as Record<string, unknown> | undefined)?.preferences as Record<string, unknown> | undefined)
        ?.themeMode,
    ) ||
    normalizeThemeMode(
      ((holder.user as Record<string, unknown> | undefined)?.preferences as Record<string, unknown> | undefined)
        ?.theme,
    ) ||
    normalizeThemeMode((holder.user as Record<string, unknown> | undefined)?.themeMode) ||
    null
  )
}

function readStoredThemeMode(): ThemeMode | null {
  try {
    return normalizeThemeMode(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function readSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function resolveThemeMode(userRef: unknown): ThemeMode {
  return readUserThemePreference(userRef) || readStoredThemeMode() || readSystemThemeMode()
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // no-op
  }
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
  document.body?.setAttribute('data-theme', mode)
}

export function watchSystemThemeMode(onChange: (mode: ThemeMode) => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY)
  const listener = (event: MediaQueryListEvent) => {
    onChange(event.matches ? 'dark' : 'light')
  }

  mediaQuery.addEventListener('change', listener)
  return () => mediaQuery.removeEventListener('change', listener)
}
