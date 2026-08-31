import { useEffect, useState } from 'react'
import { setSavings } from '../db/mutations'
import { useI18n } from '../i18n'
import { centsToYuanInput, yuanToCents } from '../lib/money'

export function SavingsSection({ bookId, savings }: { bookId: string; savings: number }) {
  const { t } = useI18n()
  const [value, setValue] = useState(centsToYuanInput(savings))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(centsToYuanInput(savings))
  }, [savings])

  async function submit() {
    const cents = yuanToCents(value)
    if (cents === null) {
      setError(t.savings.amountRequired)
      setSaved(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await setSavings(bookId, cents)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted">{t.savings.title}</h2>
      <div className="flex items-center gap-2">
        <span className="text-sm text-faint">¥</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setSaved(false)
            setError('')
          }}
          className="w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
        />
      </div>
      {error ? <p className="text-sm text-expense">{error}</p> : null}
      {saved ? <p className="text-sm text-income">{t.common.saved}</p> : null}
      <div>
        <button
          type="button"
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
          onClick={() => void submit()}
        >
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>
    </section>
  )
}
