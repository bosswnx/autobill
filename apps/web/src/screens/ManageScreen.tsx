import type { Book, Category, Tag } from '@autobill/shared'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { useSubscriptions } from '../hooks/useLedger'
import { CategoriesScreen } from './CategoriesScreen'
import { SubscriptionsScreen } from './SubscriptionsScreen'
import { TagsScreen } from './TagsScreen'

type Tab = 'categories' | 'tags' | 'subscriptions'

type Props = {
  book: Book
  tags: Tag[]
  categories: Category[]
  usage: Record<string, number>
  categoryUsage: Record<string, number>
  onFilterTag: (id: string) => void
  onFilterCategory: (id: string) => void
}

export function ManageScreen({
  book,
  tags,
  categories,
  usage,
  categoryUsage,
  onFilterTag,
  onFilterCategory,
}: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('categories')
  const subscriptions = useSubscriptions(book.id)
  const tabs = [
    { id: 'categories' as const, label: t.manage.categories },
    { id: 'tags' as const, label: t.manage.tags },
    { id: 'subscriptions' as const, label: t.manage.subscriptions },
  ]
  const index = Math.max(
    0,
    tabs.findIndex((item) => item.id === tab),
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
          {t.manage.title}
        </h1>
        <div className="self-start overflow-hidden rounded-md bg-hover p-[3px]">
          <div className="relative grid grid-cols-3">
            <span
              className="pointer-events-none absolute inset-y-0 w-1/3 rounded bg-page transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {tabs.map((item) => (
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

      {tab === 'categories' ? (
        <CategoriesScreen
          bookId={book.id}
          categories={categories}
          usage={categoryUsage}
          onFilterCategory={onFilterCategory}
        />
      ) : tab === 'tags' ? (
        <TagsScreen bookId={book.id} tags={tags} usage={usage} onFilterTag={onFilterTag} />
      ) : (
        <SubscriptionsScreen book={book} tags={tags} usage={usage} subscriptions={subscriptions} />
      )}
    </div>
  )
}
