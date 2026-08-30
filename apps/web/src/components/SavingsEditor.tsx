import { useState } from 'react'
import { setSavings } from '../db/mutations'
import { centsToYuanInput, formatYuan, yuanToCents } from '../lib/money'
import { Overlay } from './Overlay'

type Props = {
  bookId: string
  savings: number
  onClose: () => void
}

export function SavingsEditor({ bookId, savings, onClose }: Props) {
  const [value, setValue] = useState(centsToYuanInput(savings))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const cents = yuanToCents(value)
    if (cents === null) {
      setError('请输入金额')
      return false
    }
    setSaving(true)
    try {
      await setSavings(bookId, cents)
      return true
    } finally {
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      {(close) => (
        <div
          data-overlay-scroll
          className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
        >
          <h2 className="text-lg font-semibold">现在的存款</h2>
          <p className="mt-1 text-sm text-muted">填你手头现在有多少。之后记账会自动加减。</p>
          <div className="mt-4 flex items-baseline gap-1 border-b border-line pb-2">
            <span className="text-xl text-faint">¥</span>
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-full bg-transparent text-3xl font-semibold tracking-tight"
            />
          </div>
          {error && <p className="mt-2 text-sm text-expense">{error}</p>}
          <div className="mt-5 flex justify-end gap-1">
            <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
              onClick={() =>
                void submit().then((ok) => {
                  if (ok) close()
                })
              }
            >
              保存
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

export function SavingsButton({
  savings,
  onClick,
}: {
  savings: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-baseline gap-2 rounded text-left transition-colors duration-150 hover:bg-hover"
    >
      <span className="text-faint">存款</span>
      <span className="font-medium tabular-nums">{formatYuan(savings)}</span>
    </button>
  )
}
