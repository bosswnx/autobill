import type { MergeChoice } from '@tagledger/shared'
import { Overlay } from '../components/Overlay'

export function MergeOverlay({
  busy,
  onPick,
  onClose,
}: {
  busy: boolean
  onPick: (choice: MergeChoice) => void
  onClose: () => void
}) {
  return (
    <Overlay onClose={onClose}>
      {() => (
        <div
          data-overlay-scroll
          className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
        >
          <h2 className="text-lg font-semibold">两边都有账本</h2>
          <p className="mt-1 text-sm text-muted">这台设备和云端都有数据。选一种处理方式，不会自动合并成一本乱账。</p>
          <div className="mt-4 flex flex-col gap-2">
            <MergeButton
              disabled={busy}
              title="用本机覆盖云端"
              detail="云端现有记录会清掉，换成这台设备上的账。"
              onClick={() => onPick('local')}
            />
            <MergeButton
              disabled={busy}
              title="用云端覆盖本机"
              detail="这台设备上的记录会清掉，换成云端那本账。"
              onClick={() => onPick('cloud')}
            />
            <MergeButton
              disabled={busy}
              title="两边都留"
              detail="流水和标签都会保留。同名标签可能出现两份，存款以较新的设置为准。"
              onClick={() => onPick('both')}
            />
          </div>
        </div>
      )}
    </Overlay>
  )
}

function MergeButton({
  title,
  detail,
  disabled,
  onClick,
}: {
  title: string
  detail: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-line px-3 py-3 text-left transition-colors duration-150 hover:bg-hover disabled:opacity-40"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-faint">{detail}</div>
    </button>
  )
}
