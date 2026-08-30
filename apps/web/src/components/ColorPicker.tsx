import { TAG_COLOR_PALETTE } from '@tagledger/shared'
import { Overlay } from './Overlay'

type Props = {
  value: string
  onClose: () => void
  onPick: (color: string) => void
}

export function ColorPicker({ value, onClose, onPick }: Props) {
  return (
    <Overlay onClose={onClose} className="overlay-pad z-[60] items-center">
      {(close) => (
        <div className="anim-panel w-full max-w-xs rounded-xl border border-line bg-page p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">选择颜色</h2>
            <button type="button" className="rounded px-2 py-1 text-sm text-muted hover:bg-hover" onClick={close}>
              关闭
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
