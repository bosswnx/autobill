import type { Book, Tag } from '@tagbill/shared'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { useSubscriptions } from '../hooks/useLedger'
import { SubscriptionsScreen } from './SubscriptionsScreen'
import { TagsScreen } from './TagsScreen'

type Tab = 'tags' | 'subscriptions'

type Props = {
  book: Book
  tags: Tag[]
  usage: Record<string, number>
  onFilterTag: (id: string) => void
}

export function ManageScreen({ book, tags, usage, onFilterTag }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('tags')
  const subscriptions = useSubscriptions(book.id)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
          {t.manage.title}
        </h1>
        <div className="self-start overflow-hidden rounded-md bg-hover p-[3px]">
          <div className="relative grid grid-cols-2">
            <span
              className="pointer-events-none absolute inset-y-0 w-1/2 rounded bg-page transition-transform duration-200 ease-out"
              style={{ transform: tab === 'subscriptions' ? 'translateX(100%)' : 'translateX(0)' }}
            />
            {(
              [
                { id: 'tags', label: t.manage.tags },
                { id: 'subscriptions', label: t.manage.subscriptions },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative z-10 whitespace-nowrap px-4 py-1.5 text-sm transition-colors duration-200 ${
                  tab === item.id ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === 'tags' ? (
        <TagsScreen bookId={book.id} tags={tags} usage={usage} onFilterTag={onFilterTag} />
      ) : (
        <SubscriptionsScreen book={book} tags={tags} usage={usage} subscriptions={subscriptions} />
      )}
    </div>
  )
}
