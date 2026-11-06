import { TAG_COLOR_PALETTE } from '@tagledger/shared'
import { Overlay } from './Overlay'
import { useI18n } from '../i18n'

type Props = {
  value: string
  onClose: () => void
  onPick: (color: string) => void
}

export function ColorPicker({ value, onClose, onPick }: Props) {
  const { t } = useI18n()
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
          <div className="mt-4 flex flex-wrap gap-2">
            {TAG_COLOR_PALETTE.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onPick(item)
                  close()
                }}
                className={`size-7 rounded-full ${value === item ? 'outline-2 outline-offset-2 outline-ink' : ''}`}
                style={{ background: item }}
                aria-label={item}
              />
            ))}
          </div>
        </div>
      )}
    </Overlay>
  )
}
