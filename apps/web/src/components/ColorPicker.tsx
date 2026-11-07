import { TAG_COLOR_PALETTE } from '@autobill/shared'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Overlay } from './Overlay'
import { useI18n } from '../i18n'

type Props = {
  value: string
  onClose: () => void
  onPick: (color: string) => void
}

const PRESET = new Set<string>(TAG_COLOR_PALETTE)

function normalize(color: string): string {
  return color.trim().toLowerCase()
}

export function ColorPicker({ value, onClose, onPick }: Props) {
  const { t } = useI18n()
  const inputId = useId()
  const [custom, setCustom] = useState(() =>
    PRESET.has(normalize(value)) ? '' : value,
  )
  const active = normalize(value)
  const customActive = custom !== '' && active === normalize(custom)

  return (
    <Overlay onClose={onClose} className="overlay-pad z-[60] items-center">
      {(close) => (
        <div className="anim-panel w-full max-w-xs rounded-xl border border-line bg-page p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t.colorPicker.title}</h2>
            <button
              type="button"
              className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
              onClick={close}
            >
              {t.common.close}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-8 justify-items-center gap-2">
            {TAG_COLOR_PALETTE.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onPick(item)
                  close()
                }}
                className={`size-7 rounded-full transition-transform duration-150 hover:scale-110 ${
                  active === normalize(item) ? 'outline-2 outline-offset-2 outline-ink' : ''
                }`}
                style={{ background: item }}
                aria-label={item}
              />
            ))}

            <label
              htmlFor={inputId}
              role="button"
              tabIndex={0}
              title={t.colorPicker.custom}
              aria-label={t.colorPicker.custom}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                document.getElementById(inputId)?.click()
              }}
              className={`relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                customActive ? 'outline-2 outline-offset-2 outline-ink' : ''
              } ${custom ? 'border-transparent' : 'border-faint text-muted hover:border-ink hover:text-ink'}`}
              style={custom ? { background: custom } : undefined}
            >
              <Plus
                size={14}
                strokeWidth={2}
                className={custom ? 'text-white mix-blend-difference' : ''}
              />
              <input
                id={inputId}
                type="color"
                value={custom || '#c05a3e'}
                onChange={(event) => {
                  const next = event.target.value
                  setCustom(next)
                  onPick(next)
                }}
                className="sr-only"
                tabIndex={-1}
              />
            </label>
          </div>
        </div>
      )}
    </Overlay>
  )
}
