import type { MergeChoice } from '@tagledger/shared'
import { Overlay } from '../components/Overlay'
import { useI18n } from '../i18n'

export function MergeOverlay({
  busy,
  onPick,
  onClose,
}: {
  busy: boolean
  onPick: (choice: MergeChoice) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Overlay onClose={onClose}>
      {() => (
        <div
          data-overlay-scroll
          className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
        >
          <h2 className="text-lg font-semibold">{t.merge.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.merge.hint}</p>
          <div className="mt-4 flex flex-col gap-2">
            <MergeButton
              disabled={busy}
              title={t.merge.localTitle}
              detail={t.merge.localDetail}
              onClick={() => onPick('local')}
            />
            <MergeButton
              disabled={busy}
              title={t.merge.cloudTitle}
              detail={t.merge.cloudDetail}
              onClick={() => onPick('cloud')}
            />
            <MergeButton
              disabled={busy}
              title={t.merge.bothTitle}
              detail={t.merge.bothDetail}
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
