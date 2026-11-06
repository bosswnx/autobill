import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { iconsInCategory, LUCIDE_CATEGORY_IDS, searchLucideIcons } from '../lib/lucideCategories'
import { Overlay } from './Overlay'
import { TagIcon } from './TagIcon'

function categoryFor(value: string | null) {
  if (value) {
    const found = LUCIDE_CATEGORY_IDS.find((id) => iconsInCategory(id).includes(value as never))
    if (found) return found
  }
  return LUCIDE_CATEGORY_IDS.includes('food-beverage') ? 'food-beverage' : LUCIDE_CATEGORY_IDS[0]
}

type Props = {
  value: string | null
  onClose: () => void
  onPick: (icon: string | null) => void
}

export function IconPicker({ value, onClose, onPick }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => categoryFor(value))
  const [picked, setPicked] = useState<string | null>(value)
  const searching = query.trim().length > 0

  const icons = useMemo(() => {
    if (searching) return searchLucideIcons(query)
    return iconsInCategory(category)
  }, [query, category, searching])

  return (
    <Overlay onClose={onClose} className="overlay-pad z-[60] items-center">
      {(close) => (
        <div className="anim-panel flex max-h-[min(80%,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-page">
          <div className="px-4 pt-4">
            <h2 className="text-base font-semibold">{t.iconPicker.title}</h2>
          </div>
          <div className="px-4 pt-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.iconPicker.searchPlaceholder}
              className="w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
            />
          </div>
          {!searching && (
            <div className="flex flex-wrap gap-1 px-4 pt-3">
              {LUCIDE_CATEGORY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors duration-150 ${
                    category === id ? 'bg-active text-ink' : 'text-muted hover:bg-hover hover:text-ink'
                  }`}
                >
                  {t.iconCategory[id] ?? id}
                </button>
              ))}
            </div>
          )}
          <div data-overlay-scroll className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
            <div className="grid grid-cols-8 gap-1">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className={`flex size-8 items-center justify-center rounded text-[10px] font-normal leading-none ${
                  picked === null ? 'bg-active text-ink' : 'text-muted hover:bg-hover'
                }`}
              >
                {t.common.none}
              </button>
              {icons.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setPicked(name)}
                  className={`flex size-8 items-center justify-center rounded ${
                    picked === name ? 'bg-active text-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  <TagIcon name={name} size={16} />
                </button>
              ))}
            </div>
            {icons.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">{t.iconPicker.empty}</p>
            )}
          </div>
          <div className="flex justify-end gap-1 px-4 py-3">
            <button
              type="button"
              className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
              onClick={close}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink"
              onClick={() => {
                onPick(picked)
                close()
              }}
            >
              {t.common.save}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}
