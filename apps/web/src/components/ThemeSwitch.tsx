import { useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from '../lib/theme'

const MODES: ThemeMode[] = ['light', 'dark', 'system']

export function ThemeSwitch() {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode, getThemeMode)
  const { t } = useI18n()

  return (
    <div className="inline-flex w-fit shrink-0 self-start flex-wrap gap-1 rounded-md bg-hover p-[3px]">
      {MODES.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => setThemeMode(id)}
          className={`min-w-[4.5rem] rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
            mode === id ? 'bg-page text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {t.settings.themeOptions[id]}
        </button>
      ))}
    </div>
  )
}
