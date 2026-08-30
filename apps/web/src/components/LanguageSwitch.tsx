import { LOCALES, useI18n } from '../i18n'

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n()

  return (
    <div className="inline-flex w-fit shrink-0 self-start flex-wrap gap-1 rounded-md bg-hover p-[3px]">
      {LOCALES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setLocale(item.id)}
          className={`min-w-[4.5rem] rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
            locale === item.id ? 'bg-page text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {item.nativeName}
        </button>
      ))}
    </div>
  )
}
